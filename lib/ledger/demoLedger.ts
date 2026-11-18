import { Wallet, id as keccakId, type BaseWallet } from 'ethers';
import {
  checkEntry,
  computeEntryHash,
  GENESIS_HASH,
  signEntryHash,
  type LedgerEntryPayload,
  type StoredLedgerEntry,
} from './hashChain';
import {
  LedgerConflictError,
  LedgerError,
  normalizeDocumentHash,
  type LedgerLookup,
  type LedgerProvider,
  type LedgerReceipt,
  type LedgerRegistration,
} from './types';

/** Thrown by a store when `insert` violates the verification ID or (passport, version) uniqueness. */
export class LedgerDuplicateError extends Error {
  constructor() {
    super('Ledger entry already exists.');
    this.name = 'LedgerDuplicateError';
  }
}

export interface LedgerStore {
  findByVerificationId(verificationId: string): Promise<StoredLedgerEntry | null>;
  insert(entry: StoredLedgerEntry): Promise<void>;
  setLatest(verificationId: string, isLatest: boolean): Promise<void>;
}

export interface DemoLedgerOptions {
  store: LedgerStore;
  signer: BaseWallet;
  now?: () => Date;
}

export class DemoLedger implements LedgerProvider {
  readonly mode = 'demo' as const;
  readonly label = 'Demo ledger (simulated)';

  private readonly store: LedgerStore;
  private readonly signer: BaseWallet;
  private readonly now: () => Date;

  constructor(options: DemoLedgerOptions) {
    this.store = options.store;
    this.signer = options.signer;
    this.now = options.now ?? (() => new Date());
  }

  issuerAddress(): string {
    return this.signer.address;
  }

  transactionUrl(): string | null {
    return null;
  }

  async register(registration: LedgerRegistration): Promise<LedgerReceipt> {
    const documentHash = normalizeDocumentHash(registration.documentHash);
    const normalized = { ...registration, documentHash };

    const existing = await this.store.findByVerificationId(registration.verificationId);
    if (existing) return this.confirmExisting(existing, normalized);

    const previous = await this.resolvePrevious(normalized);
    const payload: LedgerEntryPayload = {
      verificationId: normalized.verificationId,
      passportId: normalized.passportId,
      documentHash,
      version: normalized.version,
      previousVerificationId: normalized.previousVerificationId,
      previousEntryHash: previous?.entryHash ?? GENESIS_HASH,
      registeredAt: this.now().toISOString(),
    };
    const entryHash = computeEntryHash(payload);
    const entry: StoredLedgerEntry = {
      ...payload,
      entryHash,
      signature: await signEntryHash(this.signer, entryHash),
      issuerAddress: this.signer.address,
      isLatest: true,
    };

    try {
      await this.store.insert(entry);
    } catch (error) {
      if (!(error instanceof LedgerDuplicateError)) throw error;
      // A concurrent request registered the same version; accept it only if it is identical.
      const winner = await this.store.findByVerificationId(registration.verificationId);
      if (!winner) throw new LedgerConflictError('Another version was registered for this passport concurrently.');
      return this.confirmExisting(winner, normalized);
    }

    if (previous) await this.store.setLatest(previous.verificationId, false);
    return { transactionHash: entry.entryHash, mode: this.mode };
  }

  async lookup(verificationId: string): Promise<LedgerLookup> {
    const entry = await this.store.findByVerificationId(verificationId);
    if (!entry) return { exists: false };

    const predecessor = entry.previousVerificationId
      ? await this.store.findByVerificationId(entry.previousVerificationId)
      : null;
    const check = checkEntry(entry, this.signer.address, predecessor);

    return {
      exists: true,
      mode: this.mode,
      documentHash: entry.documentHash,
      version: entry.version,
      isLatest: entry.isLatest,
      issuerAuthenticity: check.valid ? 'VERIFIED' : 'UNVERIFIED',
      transactionHash: entry.entryHash,
      registeredAt: entry.registeredAt,
    };
  }

  // Mirrors the contract's idempotent re-registration, including repairing a half-finished earlier attempt.
  private async confirmExisting(
    existing: StoredLedgerEntry,
    registration: LedgerRegistration,
  ): Promise<LedgerReceipt> {
    const identical =
      existing.passportId === registration.passportId &&
      existing.documentHash.toLowerCase() === registration.documentHash.toLowerCase() &&
      existing.version === registration.version;
    if (!identical) throw new LedgerConflictError('Verification ID conflicts with existing record.');

    if (existing.previousVerificationId) await this.store.setLatest(existing.previousVerificationId, false);
    return { transactionHash: existing.entryHash, mode: this.mode };
  }

  private async resolvePrevious(registration: LedgerRegistration): Promise<StoredLedgerEntry | null> {
    if (!registration.previousVerificationId) {
      if (registration.version !== 1) throw new LedgerConflictError('Initial version must be one.');
      return null;
    }

    const previous = await this.store.findByVerificationId(registration.previousVerificationId);
    if (!previous) throw new LedgerConflictError('Previous version does not exist.');
    if (!previous.isLatest) throw new LedgerConflictError('Previous version is not latest.');
    if (previous.passportId !== registration.passportId) {
      throw new LedgerConflictError('Previous version belongs to another passport.');
    }
    if (registration.version !== previous.version + 1) {
      throw new LedgerConflictError('Version must increment by one.');
    }
    return previous;
  }
}

/** Uses the explicit key when given; otherwise derives a stable key from the application secret. */
export function createDemoSigner(options: { signingKey?: string; payloadSecret: string }): Wallet {
  const privateKey = options.signingKey ?? keccakId(`ai-passport/demo-ledger/v1:${options.payloadSecret}`);
  try {
    return new Wallet(privateKey);
  } catch (error) {
    throw new LedgerError('Demo ledger signing key is invalid.', { cause: error });
  }
}
