import { timingSafeEqual } from 'node:crypto';
import type { Payload } from 'payload';
import type { PassportVersion } from '../payload-types';
import type { IssuerAuthenticity, LedgerMode, LedgerProvider } from './ledger';
import { passportDownloadPath } from './issuance/utils';

const VERIFICATION_ID = /^VER-[A-Z0-9-]{1,80}$/i;

export function isValidVerificationId(value: string): boolean {
  return VERIFICATION_ID.test(value);
}

export function normalizeVerificationId(value: string): string {
  return value.trim().toUpperCase();
}

export interface PublicCredential {
  holderName: string;
  passportId: string;
  version: number;
  issuedAt: string;
  skills: Array<{ skillName: string; skillCode: string; earnedAt: string; description: string }>;
  downloadPath: string;
}

export interface PublicVerification {
  verificationId: string;
  recordExists: boolean;
  documentIntegrity: 'VERIFIED' | 'FAILED' | 'NOT_CHECKED';
  issuerAuthenticity: IssuerAuthenticity | 'NOT_CHECKED';
  latestStatus: 'LATEST' | 'SUPERSEDED' | 'UNKNOWN';
  version: number | null;
  ledger: {
    mode: LedgerMode;
    label: string;
    transactionHash: string | null;
    transactionUrl: string | null;
    registeredAt: string | null;
  };
  /** Only present when the stored credential agrees with the ledger entry. */
  credential: PublicCredential | null;
}

export function hashesMatch(left: string, right: string): boolean {
  const normalize = (value: string) => value.toLowerCase().replace(/^0x/, '');
  const leftBytes = Buffer.from(normalize(left), 'hex');
  const rightBytes = Buffer.from(normalize(right), 'hex');
  return leftBytes.length === 32 && rightBytes.length === 32 && timingSafeEqual(leftBytes, rightBytes);
}

function toCredential(version: PassportVersion): PublicCredential | null {
  const passport = typeof version.passport === 'object' && version.passport !== null ? version.passport : null;
  if (!passport) return null;

  return {
    holderName: `${passport.firstName} ${passport.lastName}`,
    passportId: passport.passportId ?? passport.studentId,
    version: version.version,
    issuedAt: version.issuedAt,
    skills: (version.skillsSnapshot ?? []).map((skill) => ({
      skillName: skill.skillName,
      skillCode: skill.skillCode,
      earnedAt: skill.earnedAt,
      description: skill.description ?? '',
    })),
    downloadPath: passportDownloadPath(version.verificationId),
  };
}

export async function verifyCredential(
  payload: Payload,
  ledger: LedgerProvider,
  rawVerificationId: string,
  uploadedDocumentHash?: string,
): Promise<PublicVerification> {
  const verificationId = normalizeVerificationId(rawVerificationId);
  const record = await ledger.lookup(verificationId);

  const ledgerInfo = (transactionHash: string | null, registeredAt: string | null) => ({
    mode: ledger.mode,
    label: ledger.label,
    transactionHash,
    transactionUrl: transactionHash ? ledger.transactionUrl(transactionHash) : null,
    registeredAt,
  });

  if (!record.exists) {
    return {
      verificationId,
      recordExists: false,
      documentIntegrity: 'NOT_CHECKED',
      issuerAuthenticity: 'NOT_CHECKED',
      latestStatus: 'UNKNOWN',
      version: null,
      ledger: ledgerInfo(null, null),
      credential: null,
    };
  }

  const stored = await payload.find({
    collection: 'passport-versions',
    where: { and: [{ verificationId: { equals: verificationId } }, { issuanceStatus: { equals: 'ISSUED' } }] },
    limit: 1,
    depth: 1,
    overrideAccess: true,
  });
  const version = stored.docs[0];
  const agrees = version !== undefined && hashesMatch(version.documentHash, record.documentHash);

  return {
    verificationId,
    recordExists: true,
    documentIntegrity: uploadedDocumentHash
      ? hashesMatch(uploadedDocumentHash, record.documentHash) ? 'VERIFIED' : 'FAILED'
      : 'NOT_CHECKED',
    issuerAuthenticity: record.issuerAuthenticity,
    latestStatus: record.isLatest ? 'LATEST' : 'SUPERSEDED',
    version: record.version,
    ledger: ledgerInfo(record.transactionHash ?? version?.transactionHash ?? null, record.registeredAt ?? null),
    credential: agrees ? toCredential(version) : null,
  };
}
