import assert from 'node:assert/strict';
import { access } from 'node:fs/promises';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import { issueCredential } from '../issuance/issueCredential';
import { addSkill, addStudent, createHarness, muteConsoleLog, useTemporaryStorage, VERIFY_BASE_URL, type Harness } from '../testing/harness';
import { verifyCredential } from '../verification';
import { cleanupVisitorData } from './cleanup';
import { VISITOR_RECORD_PREFIX } from './config';

let restoreConsole: () => void;
let storageDirectory: string;

before(async () => {
  restoreConsole = muteConsoleLog();
  storageDirectory = await useTemporaryStorage();
});

after(() => restoreConsole());

const exists = (verificationId: string) =>
  access(path.join(storageDirectory, `${verificationId}.pdf.enc`)).then(() => true, () => false);

async function issue(harness: Harness, studentId: number, skillId: number, earnedAt: string, visitor: boolean, recordId?: string) {
  return issueCredential({
    payload: harness.payload,
    ledger: harness.ledger,
    verifyBaseUrl: VERIFY_BASE_URL,
    recordPrefix: visitor ? VISITOR_RECORD_PREFIX : undefined,
    input: { studentId, skillId, earnedAt, recordId },
  });
}

describe('cleanupVisitorData', () => {
  it('restores a seeded passport to its last seeded version', async () => {
    const harness = createHarness();
    const student = await addStudent(harness.payload);
    const [a, b, c] = [await addSkill(harness.payload, 'S-1'), await addSkill(harness.payload, 'S-2'), await addSkill(harness.payload, 'S-3')];

    const seeded = await issue(harness, student.id, a.id, '2026-01-10', false, 'SEED-1');
    const visitorOne = await issue(harness, student.id, b.id, '2026-02-10', true);
    const visitorTwo = await issue(harness, student.id, c.id, '2026-03-10', true);
    assert.equal(visitorTwo.version, 3);
    assert.equal(await exists(visitorTwo.verificationId), true);

    const result = await cleanupVisitorData(harness.payload);

    assert.deepEqual(result, { skipped: false, verifiedSkills: 2, versions: 2, passports: 0 });
    assert.equal(harness.payload.dump('passport-versions').length, 1);
    assert.equal(harness.payload.dump('verified-skills').length, 1);
    assert.equal(harness.payload.dump('ledger-entries').length, 1);
    assert.equal(harness.payload.dump('passports')[0].latestVersion, harness.payload.dump('passport-versions')[0].id);

    const restored = await verifyCredential(harness.payload, harness.ledger, seeded.verificationId);
    assert.equal(restored.latestStatus, 'LATEST');
    assert.equal(restored.issuerAuthenticity, 'VERIFIED');
    assert.equal((await verifyCredential(harness.payload, harness.ledger, visitorOne.verificationId)).recordExists, false);
    assert.equal(await exists(visitorOne.verificationId), false);
    assert.equal(await exists(visitorTwo.verificationId), false);
    assert.equal(await exists(seeded.verificationId), true);

    // The restored latest version can be extended again, proving the chain is intact.
    const next = await issue(harness, student.id, b.id, '2026-04-10', true);
    assert.equal(next.version, 2);
  });

  it('removes a passport that exists only because of visitor activity', async () => {
    const harness = createHarness();
    const student = await addStudent(harness.payload);
    const skill = await addSkill(harness.payload, 'S-1');
    await issue(harness, student.id, skill.id, '2026-01-10', true);

    const result = await cleanupVisitorData(harness.payload);

    assert.deepEqual(result, { skipped: false, verifiedSkills: 1, versions: 1, passports: 1 });
    for (const collection of ['passports', 'passport-versions', 'verified-skills', 'ledger-entries']) {
      assert.equal(harness.payload.dump(collection).length, 0, collection);
    }
    assert.equal(harness.payload.dump('students').length, 1);
  });

  it('keeps visitor data that is newer than the allowed age and removes it once expired', async () => {
    const harness = createHarness();
    const student = await addStudent(harness.payload);
    const skill = await addSkill(harness.payload, 'S-1');
    await issue(harness, student.id, skill.id, '2026-01-10', true);
    const hour = 60 * 60 * 1000;

    const early = await cleanupVisitorData(harness.payload, { olderThanMs: hour, now: () => Date.now() + 10 * 60 * 1000 });
    assert.equal(early.skipped, true);
    assert.equal(harness.payload.dump('passport-versions').length, 1);

    const late = await cleanupVisitorData(harness.payload, { olderThanMs: hour, now: () => Date.now() + 2 * hour });
    assert.equal(late.skipped, false);
    assert.equal(harness.payload.dump('passport-versions').length, 0);
  });

  it('never removes a visitor version that a later non-visitor version builds on', async () => {
    const harness = createHarness();
    const student = await addStudent(harness.payload);
    const [a, b] = [await addSkill(harness.payload, 'S-1'), await addSkill(harness.payload, 'S-2')];
    await issue(harness, student.id, a.id, '2026-01-10', true);
    await issue(harness, student.id, b.id, '2026-02-10', false, 'REC-ADMIN-1');

    const result = await cleanupVisitorData(harness.payload);

    assert.deepEqual(result, { skipped: false, verifiedSkills: 0, versions: 0, passports: 0 });
    assert.equal(harness.payload.dump('passport-versions').length, 2);
    assert.equal(harness.payload.dump('verified-skills').length, 2);
  });

  it('is idempotent and does nothing when there is no visitor data', async () => {
    const harness = createHarness();
    const student = await addStudent(harness.payload);
    const skill = await addSkill(harness.payload, 'S-1');
    await issue(harness, student.id, skill.id, '2026-01-10', false, 'SEED-1');

    const first = await cleanupVisitorData(harness.payload);
    const second = await cleanupVisitorData(harness.payload);

    assert.deepEqual(first, { skipped: false, verifiedSkills: 0, versions: 0, passports: 0 });
    assert.deepEqual(second, first);
    assert.equal(harness.payload.dump('passport-versions').length, 1);
  });
});
