import type { LedgerMode } from '../env';

export type { LedgerMode };

export type IssuerAuthenticity = 'VERIFIED' | 'UNVERIFIED' | 'NOT_CONFIGURED';

export interface LedgerRegistration {
  passportId: string;
  verificationId: string;
  /** 0x-prefixed SHA-256 of the issued PDF. */
  documentHash: string;
  version: number;
  /** Empty for a passport's first version. */
  previousVerificationId: string;
}

export interface LedgerReceipt {
  transactionHash: string;
  mode: LedgerMode;
}

export type LedgerLookup =
  | { exists: false }
  | {
      exists: true;
      mode: LedgerMode;
      documentHash: string;
      version: number;
      isLatest: boolean;
      issuerAuthenticity: IssuerAuthenticity;
      /** Present when the entry carries its own identifier (demo ledger). */
      transactionHash?: string;
      registeredAt?: string;
    };

export interface LedgerProvider {
  readonly mode: LedgerMode;
  /** Human-readable name shown in the UI. */
  readonly label: string;
  /** Address recorded as the issuer of new versions. */
  issuerAddress(): string;
  register(registration: LedgerRegistration): Promise<LedgerReceipt>;
  lookup(verificationId: string): Promise<LedgerLookup>;
  /** Block-explorer link for a receipt, when the ledger has one. */
  transactionUrl(transactionHash: string): string | null;
}

export class LedgerError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'LedgerError';
  }
}

export class LedgerConfigError extends LedgerError {
  constructor(message: string) {
    super(message);
    this.name = 'LedgerConfigError';
  }
}

export class LedgerConflictError extends LedgerError {
  constructor(message: string) {
    super(message);
    this.name = 'LedgerConflictError';
  }
}

const DOCUMENT_HASH = /^0x[0-9a-f]{64}$/;

export function normalizeDocumentHash(value: string): string {
  const prefixed = value.startsWith('0x') ? value : `0x${value}`;
  const lowered = prefixed.toLowerCase();
  if (!DOCUMENT_HASH.test(lowered)) throw new LedgerError('Document hash must be a 32-byte hex value.');
  return lowered;
}
