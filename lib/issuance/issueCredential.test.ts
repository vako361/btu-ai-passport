import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import type { LedgerProvider } from '../ledger';
import { addSkill, addStudent, createHarness, muteConsoleLog, useTemporaryStorage, VERIFY_BASE_URL } from '../testing/harness';
import { hashesMatch, verifyCredential } from '../verification';
import { issueCredential } from './issueCredential';
import { IssuanceError } from './types';

let restoreConsole: () => void;

before(async () => {
  restoreConsole = muteConsoleLog();
  await useTemporaryStorage();
});

after(() => restoreConsole());

function flakyLedger(inner: LedgerProvider, failures: number): LedgerProvider {
  let remaining = failures;
  return {
    mode: inner.mode,
    label: inner.label,
    issuerAddress: () => inner.issuerAddress(),
    transactionUrl: (hash) => inner.transactionUrl(hash),
    lookup: (verificationId) => inner.lookup(verificationId),
    register: async (registration) => {
      if (remaining-- > 0) throw new Error('ledger temporarily unavailable');
      return inner.register(registration);
    },
  };
}

describe('issueCredential', () => {
  it('issues a first credential that is stored, registered and publicly verifiable', async () => {
    const { payload, ledger } = createHarness();
    const student = await addStudent(payload);
    const skill = await addSkill(payload, 'AI-101', 'Generative AI Fundamentals');

    const issued = await issueCredential({
      payload, ledger, verifyBaseUrl: VERIFY_BASE_URL,
      input: { studentId: student.id, skillId: skill.id, earnedAt: '2026-03-01' },
    });

    assert.equal(issued.version, 1);
    assert.match(issued.verificationId, /^VER-[A-F0-9]{24}$/);
    assert.equal(issued.holderName, 'Ada Lovelace');
    assert.equal(issued.downloadPath, `/api/passports/${issued.verificationId}`);

    const [version] = payload.dump('passport-versions');
    const [passport] = payload.dump('passports');
    const [verifiedSkill] = payload.dump('verified-skills');
    assert.equal(version.issuanceStatus, 'ISSUED');
    assert.equal(version.transactionHash, issued.transactionHash);
    assert.equal(passport.latestVersion, version.id);
    assert.equal(verifiedSkill.processingStatus, 'PROCESSED');
    assert.equal(payload.dump('ledger-entries').length, 1);

    const result = await verifyCredential(payload, ledger, issued.verificationId.toLowerCase());
    assert.equal(result.recordExists, true);
    assert.equal(result.issuerAuthenticity, 'VERIFIED');
    assert.equal(result.latestStatus, 'LATEST');
    assert.equal(result.credential?.holderName, 'Ada Lovelace');
    assert.deepEqual(result.credential?.skills.map((skill) => skill.skillCode), ['AI-101']);
    assert.equal(result.ledger.transactionHash, issued.transactionHash);
  });

  it('chains a second version that includes every verified skill and demotes the first', async () => {
    const { payload, ledger } = createHarness();
    const student = await addStudent(payload);
    const first = await addSkill(payload, 'AI-101');
    const second = await addSkill(payload, 'AI-102');

    const v1 = await issueCredential({
      payload, ledger, verifyBaseUrl: VERIFY_BASE_URL,
      input: { studentId: student.id, skillId: first.id, earnedAt: '2026-03-01' },
    });
    const v2 = await issueCredential({
      payload, ledger, verifyBaseUrl: VERIFY_BASE_URL,
      input: { studentId: student.id, skillId: second.id, earnedAt: '2026-04-01' },
    });

    assert.equal(v2.version, 2);
    assert.equal(payload.dump('passports').length, 1);

    const old = await verifyCredential(payload, ledger, v1.verificationId);
    const latest = await verifyCredential(payload, ledger, v2.verificationId);
    assert.equal(old.latestStatus, 'SUPERSEDED');
    assert.equal(old.issuerAuthenticity, 'VERIFIED');
    assert.equal(latest.latestStatus, 'LATEST');
    assert.deepEqual(latest.credential?.skills.map((skill) => skill.skillCode), ['AI-101', 'AI-102']);

    const [passport] = payload.dump('passports');
    const newest = payload.dump('passport-versions').find((version) => version.version === 2);
    assert.equal(passport.latestVersion, newest?.id);
  });

  it('rejects a skill that is already verified for the student', async () => {
    const { payload, ledger } = createHarness();
    const student = await addStudent(payload);
    const skill = await addSkill(payload, 'AI-101', 'Prompt Engineering');
    const input = { studentId: student.id, skillId: skill.id, earnedAt: '2026-03-01' };

    await issueCredential({ payload, ledger, verifyBaseUrl: VERIFY_BASE_URL, input });

    await assert.rejects(
      issueCredential({ payload, ledger, verifyBaseUrl: VERIFY_BASE_URL, input }),
      (error: unknown) => error instanceof IssuanceError && error.code === 'CONFLICT' && error.message.includes('Prompt Engineering'),
    );
    assert.equal(payload.dump('passport-versions').length, 1);
  });

  it('reports a missing student or skill as not found', async () => {
    const { payload, ledger } = createHarness();
    const student = await addStudent(payload);
    const skill = await addSkill(payload, 'AI-101');

    await assert.rejects(
      issueCredential({ payload, ledger, verifyBaseUrl: VERIFY_BASE_URL, input: { studentId: 999, skillId: skill.id, earnedAt: '2026-03-01' } }),
      (error: unknown) => error instanceof IssuanceError && error.code === 'NOT_FOUND',
    );
    await assert.rejects(
      issueCredential({ payload, ledger, verifyBaseUrl: VERIFY_BASE_URL, input: { studentId: student.id, skillId: 999, earnedAt: '2026-03-01' } }),
      (error: unknown) => error instanceof IssuanceError && error.code === 'NOT_FOUND',
    );
    assert.equal(payload.dump('verified-skills').length, 0);
  });

  it('resumes after a ledger failure without duplicating the version', async () => {
    const { payload, ledger } = createHarness();
    const student = await addStudent(payload);
    const skill = await addSkill(payload, 'AI-101');
    const input = { studentId: student.id, skillId: skill.id, earnedAt: '2026-03-01' };
    const flaky = flakyLedger(ledger, 1);

    await assert.rejects(issueCredential({ payload, ledger: flaky, verifyBaseUrl: VERIFY_BASE_URL, input }), /ledger temporarily unavailable/);

    const [failed] = payload.dump('verified-skills');
    assert.equal(failed.processingStatus, 'FAILED');
    assert.equal(payload.dump('passport-versions')[0].issuanceStatus, 'PREPARED');
    assert.equal(payload.dump('ledger-entries').length, 0);

    const issued = await issueCredential({ payload, ledger: flaky, verifyBaseUrl: VERIFY_BASE_URL, input });

    assert.equal(payload.dump('verified-skills').length, 1);
    assert.equal(payload.dump('passport-versions').length, 1);
    assert.equal(payload.dump('passport-versions')[0].issuanceStatus, 'ISSUED');
    assert.equal(payload.dump('verified-skills')[0].recordId, failed.recordId);
    assert.equal(issued.version, 1);
    assert.equal((await verifyCredential(payload, ledger, issued.verificationId)).issuerAuthenticity, 'VERIFIED');
  });

  it('checks an uploaded document hash against the registered one', async () => {
    const { payload, ledger } = createHarness();
    const student = await addStudent(payload);
    const skill = await addSkill(payload, 'AI-101');
    const issued = await issueCredential({
      payload, ledger, verifyBaseUrl: VERIFY_BASE_URL,
      input: { studentId: student.id, skillId: skill.id, earnedAt: '2026-03-01' },
    });
    const registered = payload.dump('passport-versions')[0].documentHash as string;

    assert.equal((await verifyCredential(payload, ledger, issued.verificationId, registered)).documentIntegrity, 'VERIFIED');
    assert.equal((await verifyCredential(payload, ledger, issued.verificationId, `0x${'0'.repeat(64)}`)).documentIntegrity, 'FAILED');
    assert.equal((await verifyCredential(payload, ledger, issued.verificationId)).documentIntegrity, 'NOT_CHECKED');
  });

  it('withholds holder details when the stored record disagrees with the ledger', async () => {
    const { payload, ledger } = createHarness();
    const student = await addStudent(payload);
    const skill = await addSkill(payload, 'AI-101');
    const issued = await issueCredential({
      payload, ledger, verifyBaseUrl: VERIFY_BASE_URL,
      input: { studentId: student.id, skillId: skill.id, earnedAt: '2026-03-01' },
    });
    const [version] = payload.dump('passport-versions');
    await payload.update({
      collection: 'passport-versions',
      id: version.id,
      data: { documentHash: `0x${'f'.repeat(64)}` },
      overrideAccess: true,
    });

    const result = await verifyCredential(payload, ledger, issued.verificationId);
    assert.equal(result.recordExists, true);
    assert.equal(result.credential, null);
  });

  it('reports unknown verification IDs as missing', async () => {
    const { payload, ledger } = createHarness();
    const result = await verifyCredential(payload, ledger, 'VER-DOESNOTEXIST');
    assert.equal(result.recordExists, false);
    assert.equal(result.credential, null);
  });

  it('chains concurrent issuances for an existing passport into consecutive versions', async () => {
    const { payload, ledger } = createHarness();
    const student = await addStudent(payload);
    const [base, a, b] = [await addSkill(payload, 'S-0'), await addSkill(payload, 'S-1'), await addSkill(payload, 'S-2')];
    await issueCredential({
      payload, ledger, verifyBaseUrl: VERIFY_BASE_URL,
      input: { studentId: student.id, skillId: base.id, earnedAt: '2026-01-01' },
    });

    const outcomes = await Promise.all([a, b].map((skill) =>
      issueCredential({
        payload, ledger, verifyBaseUrl: VERIFY_BASE_URL,
        input: { studentId: student.id, skillId: skill.id, earnedAt: '2026-02-01' },
      })));

    assert.deepEqual(outcomes.map((issued) => issued.version).sort(), [2, 3]);
    const versions = payload.dump('passport-versions').sort((x, y) => Number(x.version) - Number(y.version));
    assert.deepEqual(versions.map((version) => version.version), [1, 2, 3]);
    assert.equal((versions[2].skillsSnapshot as unknown[]).length, 3);
    for (const version of versions) {
      const result = await verifyCredential(payload, ledger, String(version.verificationId));
      assert.equal(result.issuerAuthenticity, 'VERIFIED');
    }
    assert.equal(payload.dump('passports')[0].latestVersion, versions[2].id);
  });

  it('creates a single passport when two first credentials are issued at the same time', async () => {
    const { payload, ledger } = createHarness();
    const student = await addStudent(payload);
    const [a, b] = [await addSkill(payload, 'S-1'), await addSkill(payload, 'S-2')];

    const outcomes = await Promise.all([a, b].map((skill) =>
      issueCredential({
        payload, ledger, verifyBaseUrl: VERIFY_BASE_URL,
        input: { studentId: student.id, skillId: skill.id, earnedAt: '2026-02-01' },
      })));

    assert.equal(payload.dump('passports').length, 1);
    assert.deepEqual(outcomes.map((issued) => issued.version).sort(), [1, 2]);
  });
});

describe('hashesMatch', () => {
  it('compares hashes case-insensitively with or without the 0x prefix', () => {
    const lower = 'a'.repeat(64);
    assert.equal(hashesMatch(`0x${lower}`, lower.toUpperCase()), true);
    assert.equal(hashesMatch(lower, 'b'.repeat(64)), false);
    assert.equal(hashesMatch('0x1234', '0x1234'), false);
  });
});
