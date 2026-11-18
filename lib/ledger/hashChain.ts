import { createHash } from 'node:crypto';
import { getBytes, verifyMessage, type Signer } from 'ethers';

export const GENESIS_HASH = `0x${'0'.repeat(64)}`;

/** The fields an entry hash commits to. Mutable state such as `isLatest` is deliberately excluded. */
export interface LedgerEntryPayload {
  verificationId: string;
  passportId: string;
  documentHash: string;
  version: number;
  previousVerificationId: string;
  /** Hash of the previous version's entry, or GENESIS_HASH for version 1. */
  previousEntryHash: string;
  registeredAt: string;
}

export interface StoredLedgerEntry extends LedgerEntryPayload {
  entryHash: string;
  signature: string;
  issuerAddress: string;
  isLatest: boolean;
}

export interface EntryCheck {
  valid: boolean;
  reason?: string;
}

// Fixed key order keeps the hash independent of object construction order.
function canonicalize(entry: LedgerEntryPayload): string {
  return JSON.stringify([
    entry.verificationId,
    entry.passportId,
    entry.documentHash.toLowerCase(),
    entry.version,
    entry.previousVerificationId,
    entry.previousEntryHash.toLowerCase(),
    new Date(entry.registeredAt).toISOString(),
  ]);
}

export function computeEntryHash(entry: LedgerEntryPayload): string {
  return `0x${createHash('sha256').update(canonicalize(entry)).digest('hex')}`;
}

export function signEntryHash(signer: Pick<Signer, 'signMessage'>, entryHash: string): Promise<string> {
  return signer.signMessage(getBytes(entryHash));
}

export function recoverEntrySigner(entryHash: string, signature: string): string | null {
  try {
    return verifyMessage(getBytes(entryHash), signature);
  } catch {
    return null;
  }
}

/** Checks an entry's hash, signature and link to its predecessor. */
export function checkEntry(
  entry: StoredLedgerEntry,
  expectedIssuer: string,
  predecessor: StoredLedgerEntry | null,
): EntryCheck {
  if (computeEntryHash(entry).toLowerCase() !== entry.entryHash.toLowerCase()) {
    return { valid: false, reason: 'Entry contents do not match their hash.' };
  }

  const signer = recoverEntrySigner(entry.entryHash, entry.signature);
  if (!signer || signer.toLowerCase() !== expectedIssuer.toLowerCase()) {
    return { valid: false, reason: 'Entry signature was not produced by the ledger issuer.' };
  }

  if (!entry.previousVerificationId) {
    if (entry.previousEntryHash.toLowerCase() !== GENESIS_HASH) {
      return { valid: false, reason: 'First version must link to the genesis hash.' };
    }
    return { valid: true };
  }

  if (!predecessor || predecessor.entryHash.toLowerCase() !== entry.previousEntryHash.toLowerCase()) {
    return { valid: false, reason: 'Link to the previous version is broken.' };
  }
  return { valid: true };
}
