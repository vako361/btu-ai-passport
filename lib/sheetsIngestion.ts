import { createHash } from 'node:crypto';
import type { Payload } from 'payload';
import type { Skill, Student } from '../payload-types';
import { getAppEnv } from './env';
import { issuePassportVersion } from './issuance/issuePassportVersion';
import { dateOnly, passportDownloadPath, relationId } from './issuance/utils';
import { getLedger, type LedgerProvider } from './ledger';
import type { SheetsVerifiedSkillEvent } from './passportTypes';

const PROCESSING_LEASE_MS = 10 * 60 * 1000;

export class SheetsIngestionError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly stage: 'LOOKUP' | 'INGESTION',
    readonly outcome: 'REJECTED' | 'FAILED',
    cause?: unknown,
  ) {
    super(message, cause === undefined ? undefined : { cause });
  }
}

type IngestionResult =
  | { kind: 'skipped'; message: string }
  | { kind: 'duplicate'; message: string }
  | {
      kind: 'processed';
      passportId: string;
      verificationId: string;
      version: number;
      txHash?: string;
      downloadPath: string;
    };

export interface SheetsIngestionOptions {
  ledger?: LedgerProvider;
}

function badgeCorrectionRecordId(recordId: string, badgeId: string) {
  const correctionKey = createHash('sha256')
    .update(`${recordId}\0${badgeId.trim().toUpperCase()}`)
    .digest('hex')
    .slice(0, 32)
    .toUpperCase();
  return `BADGE-REISSUE-${correctionKey}`;
}

async function issuedBadgeIdForRecord(payload: Payload, recordId: string) {
  const result = await payload.find({
    collection: 'passport-versions',
    where: {
      and: [
        { 'skillsSnapshot.recordId': { equals: recordId } },
        { issuanceStatus: { equals: 'ISSUED' } },
      ],
    },
    sort: '-version',
    limit: 1,
    depth: 0,
    overrideAccess: true,
  });
  return result.docs[0]?.skillsSnapshot?.find((item) => item.recordId === recordId)?.badgeId;
}

export async function processSheetsVerifiedSkill(
  payload: Payload,
  event: SheetsVerifiedSkillEvent,
  options: SheetsIngestionOptions = {},
): Promise<IngestionResult> {
  const [studentResult, skillResult, existingResult] = await Promise.all([
    payload.find({
      collection: 'students',
      where: { studentId: { equals: event.studentId } },
      limit: 2,
      depth: 0,
      overrideAccess: true,
    }),
    payload.find({
      collection: 'skills',
      where: { skillCode: { equals: event.skillCode } },
      limit: 2,
      depth: 0,
      overrideAccess: true,
    }),
    payload.find({
      collection: 'verified-skills',
      where: { recordId: { equals: event.recordId } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    }),
  ]);

  if (studentResult.docs.length > 1) {
    throw new SheetsIngestionError('Student ID is ambiguous.', 422, 'LOOKUP', 'REJECTED');
  }
  if (skillResult.docs.length > 1) {
    throw new SheetsIngestionError('Skill Code is ambiguous.', 422, 'LOOKUP', 'REJECTED');
  }

  const student = studentResult.docs[0];
  if (!student && (!event.firstName?.trim() || !event.lastName?.trim() || !event.email?.trim())) {
    throw new SheetsIngestionError(
      'Student not found. Creating one requires firstName, lastName, and email in the Sheets payload.',
      422,
      'LOOKUP',
      'REJECTED',
    );
  }
  if (!skillResult.docs[0] && !event.skillName?.trim()) {
    throw new SheetsIngestionError(
      'Skill not found. Creating one requires skillName in the Sheets payload.',
      422,
      'LOOKUP',
      'REJECTED',
    );
  }

  const resolvedStudent = student ?? await createStudentFromEvent(payload, event);
  let skill = skillResult.docs[0] ?? await createSkillFromEvent(payload, event);

  const existing = existingResult.docs[0];
  if (existing) {
    const changedFields = [
      relationId(existing.student) !== String(resolvedStudent.id) && 'student',
      relationId(existing.skill) !== String(skill.id) && 'skill',
      dateOnly(existing.earnedAt) !== event.earnedAt && 'earnedAt',
    ].filter(Boolean);
    if (changedFields.length) {
      throw new SheetsIngestionError(
        `Record ID already exists with different source data (${changedFields.join(', ')}); use a new Record ID.`,
        409,
        'INGESTION',
        'REJECTED',
      );
    }
  }

  if (event.badgeId?.trim() && skill.badgeId !== event.badgeId.trim()) {
    skill = await payload.update({
      collection: 'skills',
      id: skill.id,
      overrideAccess: true,
      data: { badgeId: event.badgeId.trim() },
    });
  }

  let issuanceRecordId = event.recordId;

  if (existing) {
    if (existing.processingStatus === 'PROCESSED') {
      if (existing.status !== event.status) {
        throw new SheetsIngestionError('A processed record cannot change status; issue a new Record ID.', 409, 'INGESTION', 'REJECTED');
      }
      const requestedBadgeId = event.badgeId?.trim();
      if (!requestedBadgeId) return { kind: 'duplicate', message: 'Record ID has already been processed.' };

      const issuedBadgeId = await issuedBadgeIdForRecord(payload, event.recordId);
      if (issuedBadgeId?.trim().toUpperCase() === requestedBadgeId.toUpperCase()) {
        return { kind: 'duplicate', message: 'Record ID has already been processed.' };
      }
      issuanceRecordId = badgeCorrectionRecordId(event.recordId, requestedBadgeId);
    }
    if (existing.processingStatus === 'QUEUED') {
      return { kind: 'duplicate', message: 'Record ID is already being processed.' };
    }
    if (existing.processingStatus === 'PROCESSING' && existing.processingStartedAt) {
      const age = Date.now() - new Date(existing.processingStartedAt).getTime();
      if (Number.isFinite(age) && age < PROCESSING_LEASE_MS) {
        return { kind: 'duplicate', message: 'Record ID is already being processed.' };
      }
    }
  }

  if (event.status !== 'CONFIRMED') {
    if (existing) {
      await payload.update({
        collection: 'verified-skills',
        id: existing.id,
        overrideAccess: true,
        data: { status: event.status, processingStatus: 'SKIPPED', processingError: null },
      });
    } else {
      await payload.create({
        collection: 'verified-skills',
        overrideAccess: true,
        data: {
          recordId: event.recordId,
          student: resolvedStudent.id,
          skill: skill.id,
          earnedAt: event.earnedAt,
          status: event.status,
          processingStatus: 'SKIPPED',
        },
      });
    }
    return { kind: 'skipped', message: `Record status ${event.status} is not eligible for issuance.` };
  }

  const verifiedSkill = existing
    ? await payload.update({
        collection: 'verified-skills',
        id: existing.id,
        overrideAccess: true,
        data: {
          status: 'CONFIRMED',
          processingStatus: 'PROCESSING',
          processingStartedAt: new Date().toISOString(),
          processingError: null,
        },
      })
    : await payload.create({
        collection: 'verified-skills',
        overrideAccess: true,
        data: {
          recordId: event.recordId,
          student: resolvedStudent.id,
          skill: skill.id,
          earnedAt: event.earnedAt,
          status: 'CONFIRMED',
          processingStatus: 'PROCESSING',
          processingStartedAt: new Date().toISOString(),
        },
      });

  try {
    const issued = await issuePassportVersion({
      payload,
      ledger: options.ledger ?? getLedger(payload),
      student: resolvedStudent,
      recordId: issuanceRecordId,
      verifiedSkillId: verifiedSkill.id,
      verifyBaseUrl: getAppEnv().appUrl,
    });
    return {
      kind: 'processed',
      passportId: issued.passportId,
      verificationId: issued.verificationId,
      version: issued.version,
      txHash: issued.transactionHash,
      downloadPath: passportDownloadPath(issued.verificationId),
    };
  } catch (error) {
    console.error(
      `Passport issuance failed for record ${issuanceRecordId}:`,
      error instanceof Error ? error.stack ?? error.message : error,
    );
    await payload.update({
      collection: 'verified-skills',
      id: verifiedSkill.id,
      overrideAccess: true,
      data: {
        processingStatus: 'FAILED',
        processingStartedAt: null,
        processingError: error instanceof Error
          ? `${error.name}: ${error.message}`.slice(0, 500)
          : 'Unknown processing error',
      },
    });
    throw new SheetsIngestionError(
      'Passport issuance failed; see the integration log for this request.',
      500,
      'INGESTION',
      'FAILED',
      error,
    );
  }
}

async function createStudentFromEvent(payload: Payload, event: SheetsVerifiedSkillEvent): Promise<Student> {
  const firstName = event.firstName?.trim();
  const lastName = event.lastName?.trim();
  const email = event.email?.trim().toLowerCase();

  if (!firstName || !lastName || !email) {
    throw new SheetsIngestionError(
      'Student not found. Creating one requires firstName, lastName, and email in the Sheets payload.',
      422,
      'LOOKUP',
      'REJECTED',
    );
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new SheetsIngestionError('Student email is invalid.', 422, 'LOOKUP', 'REJECTED');
  }

  try {
    return await payload.create({
      collection: 'students',
      overrideAccess: true,
      draft: false,
      data: { studentId: event.studentId, firstName, lastName, email },
    });
  } catch (error) {
    try {
      const result = await payload.find({
        collection: 'students',
        where: { studentId: { equals: event.studentId } },
        limit: 2,
        depth: 0,
        overrideAccess: true,
      });
      if (result.docs.length === 1) return result.docs[0];
      if (result.docs.length > 1) {
        throw new SheetsIngestionError('Student ID is ambiguous.', 422, 'LOOKUP', 'REJECTED');
      }
    } catch (lookupError) {
      if (lookupError instanceof SheetsIngestionError) throw lookupError;
    }
    throw error;
  }
}

async function createSkillFromEvent(payload: Payload, event: SheetsVerifiedSkillEvent): Promise<Skill> {
  const name = event.skillName?.trim();
  if (!name) {
    throw new SheetsIngestionError(
      'Skill not found. Creating one requires skillName in the Sheets payload.',
      422,
      'LOOKUP',
      'REJECTED',
    );
  }

  try {
    return await payload.create({
      collection: 'skills',
      overrideAccess: true,
      draft: false,
      data: {
        skillCode: event.skillCode,
        name,
        badgeId: event.badgeId?.trim() || `BDG-${event.skillCode}`,
      },
    });
  } catch (error) {
    try {
      const result = await payload.find({
        collection: 'skills',
        where: { skillCode: { equals: event.skillCode } },
        limit: 2,
        depth: 0,
        overrideAccess: true,
      });
      if (result.docs.length === 1) return result.docs[0];
      if (result.docs.length > 1) {
        throw new SheetsIngestionError('Skill Code is ambiguous.', 422, 'LOOKUP', 'REJECTED');
      }
    } catch (lookupError) {
      if (lookupError instanceof SheetsIngestionError) throw lookupError;
    }
    throw error;
  }
}
