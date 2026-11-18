import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Wallet, type BaseWallet } from 'ethers';
import { createDemoSigner, DemoLedger, LedgerDuplicateError, type LedgerStore } from './demoLedger';
import { GENESIS_HASH, type StoredLedgerEntry } from './hashChain';
import { LedgerConflictError, LedgerError, normalizeDocumentHash, type LedgerRegistration } from './types';

class MemoryStore implements LedgerStore {
  readonly entries = new Map<string, StoredLedgerEntry>();

  async findByVerificationId(verificationId: string) {
    const entry = this.entries.get(verificationId);
    return entry ? { ...entry } : null;
  }

  async insert(entry: StoredLedgerEntry) {
    const clash = [...this.entries.values()].some(
      (existing) =>
        existing.verificationId === entry.verificationId ||
        (existing.passportId === entry.passportId && existing.version === entry.version),
    );
    if (clash) throw new LedgerDuplicateError();
    this.entries.set(entry.verificationId, { ...entry });
  }

  async setLatest(verificationId: string, isLatest: boolean) {
    const entry = this.entries.get(verificationId);
    if (entry) entry.isLatest = isLatest;
  }
}

const hashOf = (character: string) => `0x${character.repeat(64)}`;

function registration(overrides: Partial<LedgerRegistration> = {}): LedgerRegistration {
  return {
    passportId: 'PASS-1',
    verificationId: 'VER-ONE',
    documentHash: hashOf('a'),
    version: 1,
    previousVerificationId: '',
    ...overrides,
  };
}

function createLedger(store = new MemoryStore(), signer = createDemoSigner({ payloadSecret: 'unit-test-secret-value' })) {
  return { store, signer, ledger: new DemoLedger({ store, signer, now: () => new Date('2026-01-15T10:00:00.000Z') }) };
}

describe('DemoLedger', () => {
  it('registers a first version that verifies as latest and signed by the issuer', async () => {
    const { ledger, signer } = createLedger();

    const receipt = await ledger.register(registration());
    const lookup = await ledger.lookup('VER-ONE');

    assert.equal(receipt.mode, 'demo');
    assert.match(receipt.transactionHash, /^0x[0-9a-f]{64}$/);
    assert.ok(lookup.exists);
    assert.equal(lookup.issuerAuthenticity, 'VERIFIED');
    assert.equal(lookup.isLatest, true);
    assert.equal(lookup.version, 1);
    assert.equal(lookup.documentHash, hashOf('a'));
    assert.equal(ledger.issuerAddress(), signer.address);
  });

  it('reports unknown verification IDs as missing', async () => {
    const { ledger } = createLedger();
    assert.deepEqual(await ledger.lookup('VER-NOPE'), { exists: false });
  });

  it('links a second version to the first and demotes the first from latest', async () => {
    const { ledger, store } = createLedger();
    await ledger.register(registration());
    await ledger.register(registration({
      verificationId: 'VER-TWO',
      documentHash: hashOf('b'),
      version: 2,
      previousVerificationId: 'VER-ONE',
    }));

    const first = store.entries.get('VER-ONE');
    const second = store.entries.get('VER-TWO');
    assert.ok(first && second);
    assert.equal(first.isLatest, false);
    assert.equal(second.isLatest, true);
    assert.equal(second.previousEntryHash, first.entryHash);
    assert.equal(first.previousEntryHash, GENESIS_HASH);

    const older = await ledger.lookup('VER-ONE');
    const newer = await ledger.lookup('VER-TWO');
    assert.ok(older.exists && newer.exists);
    assert.equal(older.isLatest, false);
    assert.equal(older.issuerAuthenticity, 'VERIFIED');
    assert.equal(newer.issuerAuthenticity, 'VERIFIED');
  });

  it('treats re-registering identical data as idempotent', async () => {
    const { ledger, store } = createLedger();
    const first = await ledger.register(registration());
    const again = await ledger.register(registration());

    assert.equal(again.transactionHash, first.transactionHash);
    assert.equal(store.entries.size, 1);
  });

  it('rejects re-registering a verification ID with different data', async () => {
    const { ledger } = createLedger();
    await ledger.register(registration());

    await assert.rejects(ledger.register(registration({ documentHash: hashOf('c') })), LedgerConflictError);
  });

  it('enforces the same version rules as the contract', async () => {
    const { ledger } = createLedger();

    await assert.rejects(ledger.register(registration({ version: 2 })), /Initial version must be one/);
    await ledger.register(registration());

    await assert.rejects(
      ledger.register(registration({ verificationId: 'VER-X', version: 2, previousVerificationId: 'VER-MISSING' })),
      /Previous version does not exist/,
    );
    await assert.rejects(
      ledger.register(registration({ verificationId: 'VER-X', version: 3, previousVerificationId: 'VER-ONE' })),
      /Version must increment by one/,
    );
    await assert.rejects(
      ledger.register(registration({ verificationId: 'VER-X', passportId: 'PASS-2', version: 2, previousVerificationId: 'VER-ONE' })),
      /another passport/,
    );

    await ledger.register(registration({ verificationId: 'VER-TWO', documentHash: hashOf('b'), version: 2, previousVerificationId: 'VER-ONE' }));
    await assert.rejects(
      ledger.register(registration({ verificationId: 'VER-FORK', documentHash: hashOf('d'), version: 2, previousVerificationId: 'VER-ONE' })),
      /not latest/,
    );
  });

  it('repairs a half-finished registration when the same version is submitted again', async () => {
    const { ledger, store } = createLedger();
    await ledger.register(registration());
    const second = registration({ verificationId: 'VER-TWO', documentHash: hashOf('b'), version: 2, previousVerificationId: 'VER-ONE' });
    await ledger.register(second);

    await store.setLatest('VER-ONE', true);
    await ledger.register(second);

    assert.equal(store.entries.get('VER-ONE')?.isLatest, false);
  });

  describe('when another request registers the same verification ID first', () => {
    // The loser's first lookup misses, then the winner commits before the loser inserts.
    function racingLoser(store: MemoryStore, signer: BaseWallet, winnerInput: LedgerRegistration) {
      const clock = () => new Date('2026-01-15T10:00:00.000Z');
      const winner = new DemoLedger({ store, signer, now: clock });
      let lookups = 0;
      const racing: LedgerStore = {
        findByVerificationId: async (verificationId) => {
          lookups += 1;
          return lookups === 1 ? null : store.findByVerificationId(verificationId);
        },
        insert: async (entry) => {
          await winner.register(winnerInput);
          return store.insert(entry);
        },
        setLatest: (verificationId, isLatest) => store.setLatest(verificationId, isLatest),
      };
      return new DemoLedger({ store: racing, signer, now: clock });
    }

    it('accepts the winner when the data is identical', async () => {
      const { store, signer } = createLedger();
      const loser = racingLoser(store, signer, registration());

      const receipt = await loser.register(registration());

      assert.equal(receipt.transactionHash, store.entries.get('VER-ONE')?.entryHash);
      assert.equal(store.entries.size, 1);
    });

    it('rejects the loser when the winner registered different data', async () => {
      const { store, signer } = createLedger();
      const loser = racingLoser(store, signer, registration({ documentHash: hashOf('c') }));

      await assert.rejects(loser.register(registration()), LedgerConflictError);
      assert.equal(store.entries.get('VER-ONE')?.documentHash, hashOf('c'));
    });
  });

  it('flags entries whose contents were altered after registration', async () => {
    const { ledger, store } = createLedger();
    await ledger.register(registration());

    const stored = store.entries.get('VER-ONE');
    assert.ok(stored);
    stored.documentHash = hashOf('f');

    const lookup = await ledger.lookup('VER-ONE');
    assert.ok(lookup.exists);
    assert.equal(lookup.issuerAuthenticity, 'UNVERIFIED');
  });

  it('flags entries signed by a different key', async () => {
    const { store } = createLedger();
    const forger = new DemoLedger({ store, signer: Wallet.createRandom() });
    await forger.register(registration());

    const { ledger } = createLedger(store);
    const lookup = await ledger.lookup('VER-ONE');
    assert.ok(lookup.exists);
    assert.equal(lookup.issuerAuthenticity, 'UNVERIFIED');
  });

  it('flags a version whose link to the previous entry was broken', async () => {
    const { ledger, store } = createLedger();
    await ledger.register(registration());
    await ledger.register(registration({ verificationId: 'VER-TWO', documentHash: hashOf('b'), version: 2, previousVerificationId: 'VER-ONE' }));

    store.entries.delete('VER-ONE');

    const lookup = await ledger.lookup('VER-TWO');
    assert.ok(lookup.exists);
    assert.equal(lookup.issuerAuthenticity, 'UNVERIFIED');
  });
});

describe('ledger helpers', () => {
  it('normalizes document hashes and rejects malformed ones', () => {
    assert.equal(normalizeDocumentHash('A'.repeat(64)), `0x${'a'.repeat(64)}`);
    assert.equal(normalizeDocumentHash(`0x${'B'.repeat(64)}`), `0x${'b'.repeat(64)}`);
    assert.throws(() => normalizeDocumentHash('0x1234'), LedgerError);
  });

  it('derives a stable signer from the secret and prefers an explicit key', () => {
    const derived = createDemoSigner({ payloadSecret: 'secret-one-secret-one' });
    assert.equal(createDemoSigner({ payloadSecret: 'secret-one-secret-one' }).address, derived.address);
    assert.notEqual(createDemoSigner({ payloadSecret: 'secret-two-secret-two' }).address, derived.address);

    const explicit = Wallet.createRandom();
    assert.equal(createDemoSigner({ signingKey: explicit.privateKey, payloadSecret: 'ignored-ignored' }).address, explicit.address);
  });
});
