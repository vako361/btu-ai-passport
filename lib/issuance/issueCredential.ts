import { randomUUID } from 'node:crypto';
import type { Payload } from 'payload';
import type { LedgerProvider } from '../ledger';
import { issuePassportVersion, VersionRaceError } from './issuePassportVersion';
import { IssuanceError, type IssuedVersion } from './types';
import { passportDownloadPath } from './utils';

const PROCESSING_LEASE_MS = 10 * 60 * 1000;
const MAX_RACE_ATTEMPTS = 6;
const RACE_BACKOFF_MS = 300;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export interface IssueCredentialInput {
  studentId: number;
  skillId: number;
  /** YYYY-MM-DD. Ignored when resuming an earlier attempt for the same student and skill. */
  earnedAt: string;
  /** Provide for reproducible records (seed data); generated otherwise. */
  recordId?: string;
  issuedAt?: string;
}

export interface IssueCredentialParams {
  payload: Payload;
  ledger: LedgerProvider;
  verifyBaseUrl: string;
  input: IssueCredentialInput;
  /** Prefix for generated record IDs; lets cleanup tell visitor records apart. */
  recordPrefix?: string;
}

export interface IssuedCredential extends IssuedVersion {
  recordId: string;
  holderName: string;
  skillName: string;
  downloadPath: string;
}

// Each retry re-reads the passport, so it sees the winner's version and includes the winner's skills.
async function issueWithRetry<T>(attempt: () => Promise<T>): Promise<T> {
  for (let tries = 1; ; tries += 1) {
    try {
      return await attempt();
    } catch (error) {
      if (!(error instanceof VersionRaceError) || tries >= MAX_RACE_ATTEMPTS) throw error;
      await sleep(RACE_BACKOFF_MS * tries + Math.random() * RACE_BACKOFF_MS);
    }
  }
}

export async function issueCredential(params: IssueCredentialParams): Promise<IssuedCredential> {
  const { payload, ledger, verifyBaseUrl, input } = params;

  const [studentResult, skillResult, existingResult] = await Promise.all([
    payload.find({ collection: 'students', where: { id: { equals: input.studentId } }, limit: 1, depth: 0, overrideAccess: true }),
    payload.find({ collection: 'skills', where: { id: { equals: input.skillId } }, limit: 1, depth: 0, overrideAccess: true }),
    payload.find({
      collection: 'verified-skills',
      where: { and: [{ student: { equals: input.studentId } }, { skill: { equals: input.skillId } }] },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    }),
  ]);

  const student = studentResult.docs[0];
  const skill = skillResult.docs[0];
  if (!student) throw new IssuanceError('The selected student no longer exists.', 'NOT_FOUND');
  if (!skill) throw new IssuanceError('The selected skill no longer exists.', 'NOT_FOUND');

  const existing = existingResult.docs[0];
  if (existing?.processingStatus === 'PROCESSED' && existing.status === 'CONFIRMED') {
    throw new IssuanceError(`${skill.name} is already verified for ${student.firstName} ${student.lastName}.`, 'CONFLICT');
  }
  if (existing?.processingStatus === 'PROCESSING' && existing.processingStartedAt) {
    const age = Date.now() - new Date(existing.processingStartedAt).getTime();
    if (Number.isFinite(age) && age < PROCESSING_LEASE_MS) {
      throw new IssuanceError('This credential is already being issued. Try again in a moment.', 'CONFLICT');
    }
  }

  // Resuming reuses the original record ID so a half-finished version is completed, not duplicated.
  const recordId = existing?.recordId ?? input.recordId ?? `${params.recordPrefix ?? 'REC-'}${randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase()}`;
  const startedAt = new Date().toISOString();

  const verifiedSkill = existing
    ? await payload.update({
        collection: 'verified-skills',
        id: existing.id,
        overrideAccess: true,
        data: { status: 'CONFIRMED', processingStatus: 'PROCESSING', processingStartedAt: startedAt, processingError: null },
      })
    : await payload.create({
        collection: 'verified-skills',
        overrideAccess: true,
        data: {
          recordId,
          student: student.id,
          skill: skill.id,
          earnedAt: input.earnedAt,
          status: 'CONFIRMED',
          processingStatus: 'PROCESSING',
          processingStartedAt: startedAt,
        },
      });

  try {
    const issued = await issueWithRetry(() =>
      issuePassportVersion({
        payload,
        ledger,
        student,
        recordId,
        verifiedSkillId: verifiedSkill.id,
        issuedAt: input.issuedAt,
        verifyBaseUrl,
      }),
    );

    return {
      ...issued,
      recordId,
      holderName: `${student.firstName} ${student.lastName}`,
      skillName: skill.name,
      downloadPath: passportDownloadPath(issued.verificationId),
    };
  } catch (error) {
    await payload.update({
      collection: 'verified-skills',
      id: verifiedSkill.id,
      overrideAccess: true,
      data: {
        processingStatus: 'FAILED',
        processingStartedAt: null,
        processingError: error instanceof Error ? `${error.name}: ${error.message}`.slice(0, 500) : 'Unknown processing error',
      },
    });
    throw error;
  }
}
