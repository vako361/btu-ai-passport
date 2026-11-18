import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Access, AccessArgs, FieldAccess, PayloadRequest } from 'payload';
import {
  canOpenAdminPanel,
  canWrite,
  canWriteField,
  isAdmin,
  isAuthenticated,
  readOwnIssuedVersion,
  readOwnPassport,
  readOwnStudent,
  readOwnVerifiedSkill,
  readSelf,
} from './access';

type FakeUser = { id: number; collection: 'users'; role: 'admin' | 'student'; isDemo?: boolean; student?: number | { id: number } | null };

const admin: FakeUser = { id: 1, collection: 'users', role: 'admin' };
const demoAdmin: FakeUser = { id: 2, collection: 'users', role: 'admin', isDemo: true };
const student: FakeUser = { id: 3, collection: 'users', role: 'student', student: 42 };
const populatedStudent: FakeUser = { id: 4, collection: 'users', role: 'student', student: { id: 77 } };
const unlinkedStudent: FakeUser = { id: 5, collection: 'users', role: 'student', student: null };

function request(user: FakeUser | null, passports: Array<{ id: number }> = []): PayloadRequest {
  return {
    user,
    payload: { find: async () => ({ docs: passports }) },
  } as unknown as PayloadRequest;
}

const run = (access: Access, user: FakeUser | null, passports?: Array<{ id: number }>) =>
  access({ req: request(user, passports) } as unknown as AccessArgs);

const runField = (access: FieldAccess, user: FakeUser | null) =>
  access({ req: request(user) } as unknown as Parameters<FieldAccess>[0]);

describe('role checks', () => {
  it('limits admin-only access to administrators', async () => {
    assert.equal(await run(isAdmin, admin), true);
    assert.equal(await run(isAdmin, demoAdmin), true);
    assert.equal(await run(isAdmin, student), false);
    assert.equal(await run(isAdmin, null), false);
  });

  it('keeps students out of the admin panel', () => {
    assert.equal(canOpenAdminPanel({ req: request(admin) }), true);
    assert.equal(canOpenAdminPanel({ req: request(student) }), false);
    assert.equal(canOpenAdminPanel({ req: request(null) }), false);
  });

  it('lets only non-demo administrators write', async () => {
    assert.equal(await run(canWrite, admin), true);
    assert.equal(await run(canWrite, demoAdmin), false);
    assert.equal(await run(canWrite, student), false);
    assert.equal(await run(canWrite, null), false);

    assert.equal(await runField(canWriteField, admin), true);
    assert.equal(await runField(canWriteField, demoAdmin), false);
    assert.equal(await runField(canWriteField, student), false);
  });

  it('requires a session for authenticated-only access', async () => {
    assert.equal(await run(isAuthenticated, student), true);
    assert.equal(await run(isAuthenticated, null), false);
  });

  it('ignores principals from other auth collections', async () => {
    const foreign = { id: 9, collection: 'media', role: 'admin' } as unknown as FakeUser;
    assert.equal(await run(isAdmin, foreign), false);
  });
});

describe('student-scoped reads', () => {
  it('lets administrators read everything', async () => {
    for (const access of [readOwnStudent, readOwnPassport, readOwnVerifiedSkill, readOwnIssuedVersion, readSelf]) {
      assert.equal(await run(access, admin), true);
      assert.equal(await run(access, demoAdmin), true);
    }
  });

  it('denies anonymous visitors', async () => {
    for (const access of [readOwnStudent, readOwnPassport, readOwnVerifiedSkill, readOwnIssuedVersion, readSelf]) {
      assert.equal(await run(access, null), false);
    }
  });

  it('scopes students to their linked record', async () => {
    assert.deepEqual(await run(readOwnStudent, student), { id: { equals: 42 } });
    assert.deepEqual(await run(readOwnPassport, student), { studentRecord: { equals: 42 } });
    assert.deepEqual(await run(readOwnVerifiedSkill, student), { student: { equals: 42 } });
  });

  it('resolves a populated student relationship', async () => {
    assert.deepEqual(await run(readOwnStudent, populatedStudent), { id: { equals: 77 } });
  });

  it('denies students that are not linked to a student record', async () => {
    for (const access of [readOwnStudent, readOwnPassport, readOwnVerifiedSkill, readOwnIssuedVersion]) {
      assert.equal(await run(access, unlinkedStudent), false);
    }
  });

  it('limits version reads to issued versions of the student\'s own passport', async () => {
    assert.deepEqual(await run(readOwnIssuedVersion, student, [{ id: 500 }]), {
      and: [{ passport: { equals: 500 } }, { issuanceStatus: { equals: 'ISSUED' } }],
    });
  });

  it('denies version reads when the student has no passport yet', async () => {
    assert.equal(await run(readOwnIssuedVersion, student, []), false);
  });

  it('lets users read only their own user document', async () => {
    assert.deepEqual(await run(readSelf, student), { id: { equals: 3 } });
  });
});
