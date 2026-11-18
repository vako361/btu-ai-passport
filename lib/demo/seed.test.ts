import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { createHarness, muteConsoleLog, useTemporaryStorage, VERIFY_BASE_URL } from '../testing/harness';
import { verifyCredential } from '../verification';
import { ensureDemoAccounts } from './accounts';
import type { DemoEnabled } from './config';
import { seedDemoData } from './seed';
import { SEED_CREDENTIALS, SEED_SKILLS, SEED_STUDENTS } from './seedData';

let restoreConsole: () => void;

before(async () => {
  restoreConsole = muteConsoleLog();
  await useTemporaryStorage();
});

after(() => restoreConsole());

const demo: DemoEnabled = {
  enabled: true,
  admin: { email: 'demo.admin@example.com', password: 'admin-password-123' },
  student: { email: 'demo.student@example.com', password: 'student-password-123' },
  resetAfterMs: 60 * 60 * 1000,
  cronSecret: undefined,
};

describe('demo accounts', () => {
  it('creates a read-only demo admin and a demo student linked to a student record', async () => {
    const { payload } = createHarness();

    const { student } = await ensureDemoAccounts(payload, demo);

    const users = payload.dump('users');
    const admin = users.find((user) => user.email === demo.admin.email);
    const demoStudent = users.find((user) => user.email === demo.student.email);
    assert.equal(admin?.role, 'admin');
    assert.equal(admin?.isDemo, true);
    assert.equal(demoStudent?.role, 'student');
    assert.equal(demoStudent?.isDemo, true);
    assert.equal(demoStudent?.student, student.id);
    assert.equal(student.email, demo.student.email);
  });

  it('is idempotent', async () => {
    const { payload } = createHarness();
    await ensureDemoAccounts(payload, demo);
    await ensureDemoAccounts(payload, demo);

    assert.equal(payload.dump('users').length, 2);
    assert.equal(payload.dump('students').length, 1);
  });

  it('refuses to take over a real account that shares a demo address', async () => {
    const { payload } = createHarness();
    await payload.create({
      collection: 'users',
      overrideAccess: true,
      data: { email: demo.admin.email, password: 'real-owner-password', role: 'admin' },
    });

    await assert.rejects(ensureDemoAccounts(payload, demo), /not marked as one/);
    assert.equal(payload.dump('users')[0].isDemo, false);
  });
});

describe('seedDemoData', () => {
  it('loads the full dataset and every seeded credential verifies', async () => {
    const { payload, ledger } = createHarness();

    const summary = await seedDemoData({ payload, ledger, verifyBaseUrl: VERIFY_BASE_URL, demo });

    assert.deepEqual(summary.skills, { created: SEED_SKILLS.length, existing: 0 });
    assert.deepEqual(summary.students, { created: SEED_STUDENTS.length, existing: 0 });
    assert.deepEqual(summary.credentials, { issued: SEED_CREDENTIALS.length, existing: 0 });
    assert.equal(payload.dump('users').length, 2);
    assert.equal(payload.dump('students').length, SEED_STUDENTS.length + 1);

    const demoStudent = payload.dump('students').find((student) => student.studentId === 'DEMO-2026-0001');
    const demoPassport = payload.dump('passports').find((passport) => passport.studentRecord === demoStudent?.id);
    const latest = payload.dump('passport-versions').find((version) => version.id === demoPassport?.latestVersion);
    assert.equal(latest?.version, 3);
    assert.equal((latest?.skillsSnapshot as unknown[]).length, 3);

    for (const { verificationId } of summary.verificationIds) {
      const result = await verifyCredential(payload, ledger, verificationId);
      assert.equal(result.issuerAuthenticity, 'VERIFIED', verificationId);
      assert.ok(result.credential, verificationId);
    }
  });

  it('is idempotent when run again', async () => {
    const { payload, ledger } = createHarness();
    await seedDemoData({ payload, ledger, verifyBaseUrl: VERIFY_BASE_URL, demo });

    const again = await seedDemoData({ payload, ledger, verifyBaseUrl: VERIFY_BASE_URL, demo });

    assert.deepEqual(again.skills, { created: 0, existing: SEED_SKILLS.length });
    assert.deepEqual(again.students, { created: 0, existing: SEED_STUDENTS.length });
    assert.deepEqual(again.credentials, { issued: 0, existing: SEED_CREDENTIALS.length });
    assert.equal(payload.dump('passport-versions').length, SEED_CREDENTIALS.length);
    assert.equal(payload.dump('ledger-entries').length, SEED_CREDENTIALS.length);
  });

  it('produces the same verification IDs and document hashes on a fresh database', async () => {
    const first = createHarness();
    const second = createHarness();

    const one = await seedDemoData({ payload: first.payload, ledger: first.ledger, verifyBaseUrl: VERIFY_BASE_URL, demo });
    const two = await seedDemoData({ payload: second.payload, ledger: second.ledger, verifyBaseUrl: VERIFY_BASE_URL, demo });

    assert.deepEqual(one.verificationIds, two.verificationIds);
    const hashes = (payload: typeof first.payload) =>
      payload.dump('passport-versions').map((version) => `${version.verificationId}:${version.documentHash}`).sort();
    assert.deepEqual(hashes(first.payload), hashes(second.payload));
  });

  it('seeds the data without demo accounts when demo mode is off', async () => {
    const { payload, ledger } = createHarness();

    const summary = await seedDemoData({ payload, ledger, verifyBaseUrl: VERIFY_BASE_URL });

    assert.equal(payload.dump('users').length, 0);
    assert.equal(summary.credentials.issued, SEED_CREDENTIALS.length);
    assert.ok(payload.dump('students').some((student) => student.studentId === 'DEMO-2026-0001'));
  });
});
