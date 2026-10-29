import { createHash } from 'node:crypto';
import type { Payload } from 'payload';
import type { Skill, Student } from '../payload-types';
import { getIssuerAddress } from './blockchain';
import { generatePassportPDF } from './pdfGenerator';
import { preparePassportRegistration, registerAndFinalizePassportVersion, registerPassportVersionOnChain } from './passportService';
import { readPassportPdf, storePassportPdf } from './passportStorage';
import type { PassportInput, SheetsVerifiedSkillEvent } from './passportTypes';

const PROCESSING_LEASE_MS = 10 * 60 * 1000;

export class SheetsIngestionError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly stage: 'LOOKUP' | 'INGESTION',
    readonly outcome: 'REJECTED' | 'FAILED',
  ) {
    super(message);
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

function relationId(value: unknown): string | undefined {
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (typeof value !== 'object' || value === null) return undefined;

  const relation = value as { id?: unknown; value?: unknown };
  const id = relation.id ?? relation.value;
  return typeof id === 'string' || typeof id === 'number' ? String(id) : undefined;
}

function isPopulatedSkill(value: unknown): value is Skill {
  return typeof value === 'object' && value !== null && 'skillCode' in value && 'name' in value;
}

function dateOnly(value: string) {
  return new Date(value).toISOString().slice(0, 10);
}

function verificationIdForRecord(recordId: string) {
  return `VER-${createHash('sha256').update(recordId).digest('hex').slice(0, 24).toUpperCase()}`;
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

  let issuanceEvent = event;

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
      issuanceEvent = {
        ...event,
        recordId: badgeCorrectionRecordId(event.recordId, requestedBadgeId),
      };
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
        return await issuePassportVersion(payload, issuanceEvent, resolvedStudent, skill, verifiedSkill.id);
  } catch (error) {
    console.error("🔥 PDF გენერირების ნამდვილი ერორი:", error);
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
    throw new SheetsIngestionError('Passport issuance failed; see the integration log for this request.', 500, 'INGESTION', 'FAILED');
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

async function issuePassportVersion(
  payload: Payload,
  event: SheetsVerifiedSkillEvent,
  student: Student,
  currentSkill: Skill,
  verifiedSkillId: number,
): Promise<IngestionResult> {
  const existingPassports = await payload.find({
    collection: 'passports',
    where: {
      or: [
        { studentRecord: { equals: student.id } },
        { studentId: { equals: student.studentId } },
      ],
    },
    limit: 2,
    depth: 0,
    overrideAccess: true,
  });
  
  if (existingPassports.docs.length > 1) {
    throw new Error('Student has multiple passports.');
  }

  const existingPassport = existingPassports.docs[0];
  
  const cleanStudentId = student.studentId.startsWith('BTU-AI-')
    ? student.studentId
    : `BTU-AI-${student.studentId.replace(/^BTU-?/i, '')}`;

  const passportId = existingPassport?.passportId || cleanStudentId;
  const firstIssuedAt = existingPassport?.firstIssuedAt || existingPassport?.createdAt || new Date().toISOString();
  
  const firstName = (student.firstName && student.firstName !== 'New') 
    ? student.firstName 
    : (existingPassport?.firstName || 'New');

  const lastName = (student.lastName && student.lastName !== 'Student') 
    ? student.lastName 
    : (existingPassport?.lastName || 'Student');

  const passport = existingPassport
    ? await payload.update({
        collection: 'passports',
        id: existingPassport.id,
        overrideAccess: true,
        data: {
          passportId,
          studentRecord: student.id,
          firstName,
          lastName,
          firstIssuedAt,
        },
      })
    : await payload.create({
        collection: 'passports',
        overrideAccess: true,
        data: {
          studentId: student.studentId,
          email: student.email,
          passportId,
          studentRecord: student.id,
          firstName,
          lastName,
          firstIssuedAt,
        },
      });

  const [latestVersionResult, sourceVersionResult, confirmedSkillsResult] = await Promise.all([
    payload.find({
      collection: 'passport-versions',
      where: {
        and: [
          { passport: { equals: passport.id } },
          { issuanceStatus: { equals: 'ISSUED' } },
        ],
      },
      sort: '-version',
      limit: 1,
      depth: 0,
      overrideAccess: true,
    }),
    payload.find({
      collection: 'passport-versions',
      where: { sourceRecordId: { equals: event.recordId } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    }),
    payload.find({
      collection: 'verified-skills',
      where: {
        and: [
          { student: { equals: student.id } },
          { status: { equals: 'CONFIRMED' } },
        ],
      },
      sort: 'earnedAt',
      limit: 1000,
      depth: 2,
      overrideAccess: true,
    }),
  ]);

  const confirmedSkills = confirmedSkillsResult.docs.map((verified) => {
    if (!isPopulatedSkill(verified.skill)) throw new Error('A confirmed skill relation is missing.');
    return {
      recordId: verified.recordId,
      skillCode: verified.skill.skillCode,
      skillName: verified.skill.name,
      badgeId: verified.skill.badgeId,
      earnedAt: dateOnly(verified.earnedAt),
      description: verified.skill.description ?? '',
      'Skill Name': verified.skill.name,
      'Date Earned': dateOnly(verified.earnedAt),
      'Skill Description': verified.skill.description ?? '',
      'Badge/Stamp': verified.skill.badgeId,
      'Skill Code': verified.skill.skillCode,
      'Record ID': verified.recordId,
    };
  });

  const latestVersion = latestVersionResult.docs[0];
  const sourceVersion = sourceVersionResult.docs[0];
  
  if (sourceVersion && relationId(sourceVersion.passport) !== String(passport.id)) {
    throw new Error('Record ID is already assigned to another passport version.');
  }
  
  if (sourceVersion?.issuanceStatus === 'ISSUED') {
    if (!latestVersion || sourceVersion.version > latestVersion.version) {
      await payload.update({
        collection: 'passports',
        id: passport.id,
        overrideAccess: true,
        data: { latestVersion: sourceVersion.id },
      });
    }
    await payload.update({
      collection: 'verified-skills',
      id: verifiedSkillId,
      overrideAccess: true,
      data: {
        processingStatus: 'PROCESSED',
        processingStartedAt: null,
        processingError: null,
        processedAt: new Date().toISOString(),
      },
    });
    return {
      kind: 'processed',
      passportId,
      verificationId: sourceVersion.verificationId,
      version: sourceVersion.version,
      txHash: sourceVersion.transactionHash ?? undefined,
      downloadPath: `/api/passports/${sourceVersion.verificationId}`,
    };
  }

  if (sourceVersion && latestVersion && sourceVersion.version <= latestVersion.version) {
    throw new Error('A failed draft is older than the latest issued version and requires reconciliation.');
  }

  // დავაზღვიოთ, რომ version აუცილებლად რიცხვია
  const version = Number(sourceVersion?.version ?? (latestVersion?.version ?? 0) + 1);
  const verificationId = sourceVersion?.verificationId ?? verificationIdForRecord(event.recordId);
  const skills = sourceVersion?.skillsSnapshot
    ? sourceVersion.skillsSnapshot.map((skill) => ({
        recordId: skill.recordId,
        skillCode: skill.skillCode,
        skillName: skill.skillName,
        badgeId: skill.badgeId,
        earnedAt: dateOnly(skill.earnedAt),
        description: skill.description ?? '',
        'Skill Name': skill.skillName,
        'Date Earned': dateOnly(skill.earnedAt),
        'Skill Description': skill.description ?? '',
        'Badge/Stamp': skill.badgeId,
        'Skill Code': skill.skillCode,
        'Record ID': skill.recordId,
      }))
    : confirmedSkills;
    
  const issuedAt = sourceVersion?.issuedAt ?? new Date().toISOString();
  
  const pdfStudentData = {
      'Student ID': student.studentId,
      'First Name': passport.firstName,
      'Last Name': passport.lastName,
      'Passport ID': passportId,
      'First Issued At': dateOnly(passport.firstIssuedAt || firstIssuedAt),
      'Passport Version': version,
      'Issued At': issuedAt,
    };

  let pdfBuffer: Buffer;
  const renderPassportPdf = async () => {
    console.log('PDF generation starting:', { recordId: event.recordId, verificationId, version, skillCount: skills.length });
    const generated = await generatePassportPDF(pdfStudentData, skills, verificationId);
    console.log('PDF generation finished:', { verificationId, bytes: generated.length });
    return generated;
  };
  if (sourceVersion) {
    try {
      pdfBuffer = await readPassportPdf(sourceVersion.verificationId, sourceVersion.documentHash);
      console.log('Reusing stored PDF for existing version:', { verificationId: sourceVersion.verificationId });
    } catch (error) {
      if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error;
      pdfBuffer = await renderPassportPdf();
    }
  } else {
    pdfBuffer = await renderPassportPdf();
  }

  const registration = preparePassportRegistration(
    {
      'Record ID': event.recordId,
      'Student ID': student.studentId,
      'First Name': passport.firstName,
      'Last Name': passport.lastName,
      'Passport ID (Existing)': passportId,
      'Skill Name': currentSkill.name,
      'Date Earned': event.earnedAt,
      status: 'CONFIRMED',
    } satisfies PassportInput,
    pdfBuffer,
    {
      passportId,
      verificationId,
      version,
      prevVerificationId: latestVersion?.verificationId ?? '',
    },
  );

  if (!registration.success) throw new Error(registration.error);

  if (sourceVersion && sourceVersion.documentHash.toLowerCase() !== registration.data.docHashHex.toLowerCase()) {
    throw new Error('Prepared PDF bytes changed and the stored version is unavailable; manual reconciliation is required.');
  }

  const versionData = {
    passport: passport.id,
    version: version,
    sourceRecordId: event.recordId,
    verificationId,
    documentHash: registration.data.docHashHex,
    issuanceStatus: 'PREPARED' as const,
    skillsSnapshot: skills.map(({ recordId, skillCode, skillName, badgeId, earnedAt, description }) => ({
      recordId,
      skillCode,
      skillName,
      badgeId,
      earnedAt: new Date(earnedAt).toISOString(),
      description,
    })),
    issuerAddress: getIssuerAddress(),
    issuedAt: new Date(issuedAt).toISOString(),
  };

  await storePassportPdf(verificationId, pdfBuffer, registration.data.docHashHex);

  const versionDoc = sourceVersion
    ? await payload.update({
        collection: 'passport-versions',
        id: sourceVersion.id,
        overrideAccess: true,
        data: versionData,
      })
    : await payload.create({
        collection: 'passport-versions',
        overrideAccess: true,
        data: versionData,
      });

  let txHash: string | undefined = versionDoc.transactionHash ?? undefined;
  
  if (versionDoc.issuanceStatus !== 'ISSUED') {
    txHash = await registerAndFinalizePassportVersion(
      () => registerPassportVersionOnChain(registration.data),
      async (transactionHash) => {
        const issuedVersion = await payload.update({
          collection: 'passport-versions',
          id: versionDoc.id,
          overrideAccess: true,
          data: { issuanceStatus: 'ISSUED', transactionHash },
        });
        if (issuedVersion.issuanceStatus !== 'ISSUED') throw new Error('Version could not be marked issued.');
      },
      async () => {
        if (!latestVersion || versionDoc.version > latestVersion.version) {
          await payload.update({
            collection: 'passports',
            id: passport.id,
            overrideAccess: true,
            data: { latestVersion: versionDoc.id },
          });
        }
      },
    );
  } else if (!latestVersion || versionDoc.version > latestVersion.version) {
    await payload.update({
      collection: 'passports',
      id: passport.id,
      overrideAccess: true,
      data: { latestVersion: versionDoc.id },
    });
  }
  
  await payload.update({
    collection: 'verified-skills',
    id: verifiedSkillId,
    overrideAccess: true,
    data: {
      processingStatus: 'PROCESSED',
      processingStartedAt: null,
      processingError: null,
      processedAt: new Date().toISOString(),
    },
  });

  return {
    kind: 'processed',
    passportId,
    verificationId,
    version,
    txHash,
    downloadPath: `/api/passports/${verificationId}`,
  };
}