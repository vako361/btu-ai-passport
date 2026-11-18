import type { LedgerMode } from '../ledger';

export type IssuanceErrorCode = 'NOT_FOUND' | 'CONFLICT' | 'LIMIT_REACHED';

/** An expected business failure whose message is safe to show to the person who triggered issuance. */
export class IssuanceError extends Error {
  constructor(message: string, readonly code: IssuanceErrorCode) {
    super(message);
    this.name = 'IssuanceError';
  }
}

export interface PassportHolder {
  studentId: string;
  firstName: string;
  lastName: string;
  passportId: string;
  firstIssuedAt: string;
}

export interface SnapshotSkill {
  recordId: string;
  skillCode: string;
  skillName: string;
  badgeId: string;
  /** ISO timestamp or YYYY-MM-DD date. */
  earnedAt: string;
  description: string;
}

export interface IssuedVersion {
  passportId: string;
  verificationId: string;
  version: number;
  transactionHash?: string;
  ledgerMode: LedgerMode;
}
