import type { Payload } from 'payload';
import { ValidationError } from 'payload';
import type { Skill, Student } from '../../payload-types';
import type { LedgerProvider } from '../ledger';
import { readPassportPdf, storePassportPdf } from '../passportStorage';
import { registerAndFinalizePassportVersion } from './finalize';
import { renderPassportPdf, skillsFromSnapshot } from './pdf';
import type { IssuedVersion, PassportHolder, SnapshotSkill } from './types';
import { dateOnly, derivePassportId, relationId, sha256Hex, verificationIdForRecord } from './utils';

export interface IssuePassportVersionParams {
  payload: Payload;
  ledger: LedgerProvider;
  student: Student;
  /** The source record that triggered this version. Retrying the same record is idempotent. */
  recordId: string;
  verifiedSkillId: number;
  /** Fixes the issue timestamp so seed data is reproducible; defaults to now. */
  issuedAt?: string;
  verifyBaseUrl?: string;
}

function isPopulatedSkill(value: unknown): value is Skill {
  return typeof value === 'object' && value !== null && 'skillCode' in value && 'name' in value;
}

function isMissingFile(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}

/** Another request took the next version number for this passport first; retrying picks up its result. */
export class VersionRaceError extends Error {
  constructor() {
    super('Another version of this passport is being issued at the same time.');
    this.name = 'VersionRaceError';
  }
}

export async function issuePassportVersion(params: IssuePassportVersionParams): Promise<IssuedVersion> {
  const { payload, ledger, student, recordId, verifiedSkillId, verifyBaseUrl } = params;
  const now = params.issuedAt ?? new Date().toISOString();

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
  if (existingPassports.docs.length > 1) throw new Error('Student has multiple passports.');
  const existingPassport = existingPassports.docs[0];

  const passportId = existingPassport?.passportId || derivePassportId(student.studentId);
  const firstIssuedAt = existingPassport?.firstIssuedAt || existingPassport?.createdAt || now;
  // The holder name is permanent once a passport exists, so it takes precedence over later edits.
  const firstName = existingPassport?.firstName ?? student.firstName;
  const lastName = existingPassport?.lastName ?? student.lastName;

  const needsPassportUpdate = existingPassport && (
    !existingPassport.passportId ||
    !existingPassport.firstIssuedAt ||
    relationId(existingPassport.studentRecord) !== String(student.id)
  );
  const passport = !existingPassport
    ? await createPassport()
    : needsPassportUpdate
      ? await payload.update({
          collection: 'passports',
          id: existingPassport.id,
          overrideAccess: true,
          data: { passportId, studentRecord: student.id, firstName, lastName, firstIssuedAt },
        })
      : existingPassport;

  async function createPassport() {
    try {
      return await payload.create({
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
    } catch (error) {
      if (error instanceof ValidationError) {
        const created = await payload.count({
          collection: 'passports',
          where: { studentRecord: { equals: student.id } },
          overrideAccess: true,
        });
        if (created.totalDocs > 0) throw new VersionRaceError();
      }
      throw error;
    }
  }

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
      where: { sourceRecordId: { equals: recordId } },
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
      // recordId breaks ties so regenerated PDFs list skills in the same order.
      sort: ['earnedAt', 'recordId'],
      limit: 1000,
      depth: 2,
      overrideAccess: true,
    }),
  ]);

  const latestVersion = latestVersionResult.docs[0];
  const sourceVersion = sourceVersionResult.docs[0];

  if (sourceVersion && relationId(sourceVersion.passport) !== String(passport.id)) {
    throw new Error('Record ID is already assigned to another passport version.');
  }

  const markProcessed = () =>
    payload.update({
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
  const advanceLatest = async (versionId: number, version: number) => {
    if (latestVersion && version <= latestVersion.version) return;
    await payload.update({
      collection: 'passports',
      id: passport.id,
      overrideAccess: true,
      data: { latestVersion: versionId },
    });
  };

  if (sourceVersion?.issuanceStatus === 'ISSUED') {
    await advanceLatest(sourceVersion.id, sourceVersion.version);
    await markProcessed();
    return {
      passportId,
      verificationId: sourceVersion.verificationId,
      version: sourceVersion.version,
      transactionHash: sourceVersion.transactionHash ?? undefined,
      ledgerMode: ledger.mode,
    };
  }

  if (sourceVersion && latestVersion && sourceVersion.version <= latestVersion.version) {
    throw new Error('A failed draft is older than the latest issued version and requires reconciliation.');
  }

  const confirmedSkills: SnapshotSkill[] = confirmedSkillsResult.docs.map((verified) => {
    if (!isPopulatedSkill(verified.skill)) throw new Error('A confirmed skill relation is missing.');
    return {
      recordId: verified.recordId,
      skillCode: verified.skill.skillCode,
      skillName: verified.skill.name,
      badgeId: verified.skill.badgeId,
      earnedAt: dateOnly(verified.earnedAt),
      description: verified.skill.description ?? '',
    };
  });

  const version = sourceVersion?.version ?? (latestVersion?.version ?? 0) + 1;
  const verificationId = sourceVersion?.verificationId ?? verificationIdForRecord(recordId);
  const skills: SnapshotSkill[] = sourceVersion?.skillsSnapshot
    ? skillsFromSnapshot(sourceVersion.skillsSnapshot)
    : confirmedSkills;
  const issuedAt = sourceVersion?.issuedAt ?? now;

  const holder: PassportHolder = {
    studentId: student.studentId,
    firstName: passport.firstName,
    lastName: passport.lastName,
    passportId,
    firstIssuedAt: passport.firstIssuedAt || firstIssuedAt,
  };
  const render = () => renderPassportPdf({ holder, version, issuedAt, verificationId, skills, verifyBaseUrl });

  let pdfBuffer: Buffer;
  if (sourceVersion) {
    try {
      pdfBuffer = await readPassportPdf(sourceVersion.verificationId, sourceVersion.documentHash);
    } catch (error) {
      if (!isMissingFile(error)) throw error;
      pdfBuffer = await render();
    }
  } else {
    pdfBuffer = await render();
  }

  const documentHash = sha256Hex(pdfBuffer);
  if (sourceVersion && sourceVersion.documentHash.toLowerCase() !== documentHash) {
    throw new Error('Prepared PDF bytes changed and the stored version is unavailable; manual reconciliation is required.');
  }

  const versionData = {
    passport: passport.id,
    version,
    sourceRecordId: recordId,
    verificationId,
    documentHash,
    issuanceStatus: 'PREPARED' as const,
    skillsSnapshot: skills.map((skill) => ({
      ...skill,
      earnedAt: new Date(skill.earnedAt).toISOString(),
    })),
    issuerAddress: ledger.issuerAddress(),
    issuedAt: new Date(issuedAt).toISOString(),
  };

  await storePassportPdf(verificationId, pdfBuffer, documentHash);

  const versionDoc = sourceVersion
    ? await payload.update({
        collection: 'passport-versions',
        id: sourceVersion.id,
        overrideAccess: true,
        data: versionData,
      })
    : await createVersion();

  async function createVersion() {
    try {
      return await payload.create({ collection: 'passport-versions', overrideAccess: true, data: versionData });
    } catch (error) {
      if (error instanceof ValidationError) {
        const taken = await payload.count({
          collection: 'passport-versions',
          where: { and: [{ passport: { equals: passport.id } }, { version: { equals: version } }] },
          overrideAccess: true,
        });
        if (taken.totalDocs > 0) throw new VersionRaceError();
      }
      throw error;
    }
  }

  const transactionHash = await registerAndFinalizePassportVersion(
    async () => {
      const receipt = await ledger.register({
        passportId,
        verificationId,
        documentHash,
        version,
        previousVerificationId: latestVersion?.verificationId ?? '',
      });
      return receipt.transactionHash;
    },
    async (hash) => {
      const issued = await payload.update({
        collection: 'passport-versions',
        id: versionDoc.id,
        overrideAccess: true,
        data: { issuanceStatus: 'ISSUED', transactionHash: hash },
      });
      if (issued.issuanceStatus !== 'ISSUED') throw new Error('Version could not be marked issued.');
    },
    () => advanceLatest(versionDoc.id, versionDoc.version),
  );

  await markProcessed();

  return { passportId, verificationId, version, transactionHash, ledgerMode: ledger.mode };
}
