import { ValidationError, type Payload } from 'payload';
import type { LedgerEntry } from '../../payload-types';
import { LedgerDuplicateError, type LedgerStore } from './demoLedger';
import type { StoredLedgerEntry } from './hashChain';

const COLLECTION = 'ledger-entries' as const;

function toStored(doc: LedgerEntry): StoredLedgerEntry {
  return {
    verificationId: doc.verificationId,
    passportId: doc.passportId,
    documentHash: doc.documentHash,
    version: doc.version,
    previousVerificationId: doc.previousVerificationId ?? '',
    previousEntryHash: doc.previousEntryHash,
    registeredAt: new Date(doc.registeredAt).toISOString(),
    entryHash: doc.entryHash,
    signature: doc.signature,
    issuerAddress: doc.issuerAddress,
    isLatest: doc.isLatest ?? true,
  };
}

export class PayloadLedgerStore implements LedgerStore {
  constructor(private readonly payload: Payload) {}

  async findByVerificationId(verificationId: string): Promise<StoredLedgerEntry | null> {
    const result = await this.payload.find({
      collection: COLLECTION,
      where: { verificationId: { equals: verificationId } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    });
    const doc = result.docs[0];
    return doc ? toStored(doc) : null;
  }

  async insert(entry: StoredLedgerEntry): Promise<void> {
    try {
      await this.payload.create({
        collection: COLLECTION,
        overrideAccess: true,
        data: entry,
      });
    } catch (error) {
      if (error instanceof ValidationError) throw new LedgerDuplicateError();
      throw error;
    }
  }

  async setLatest(verificationId: string, isLatest: boolean): Promise<void> {
    await this.payload.update({
      collection: COLLECTION,
      where: { verificationId: { equals: verificationId } },
      data: { isLatest },
      overrideAccess: true,
    });
  }
}
