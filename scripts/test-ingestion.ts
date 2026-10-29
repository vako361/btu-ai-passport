import assert from 'node:assert/strict';
import type { Payload } from 'payload';
import { registerAndFinalizePassportVersion } from '../lib/passportService';
import { processSheetsVerifiedSkill, SheetsIngestionError } from '../lib/sheetsIngestion';
import { parseSheetsVerifiedSkillEvent, type SheetsVerifiedSkillEvent } from '../lib/passportTypes';

const event: SheetsVerifiedSkillEvent = {
  recordId: 'ROW-TEST-1',
  studentId: 'STUDENT-TEST-1',
  skillCode: 'SKILL-TEST-1',
  badgeId: 'BDG-AI-001',
  firstName: 'Test',
  lastName: 'Student',
  email: 'test.student@example.edu',
  skillName: 'Test Skill',
  earnedAt: '2026-10-28',
  status: 'PENDING',
};

async function assertUpsertCreatesMissingStudentAndSkill() {
  const createdRecords: Record<string, Record<string, unknown>> = {};
  const payload = {
    find: async () => ({ docs: [] }),
    create: async ({ collection, data }: { collection: string; data: Record<string, unknown> }) => {
      createdRecords[collection] = data;
      if (collection === 'students') return { id: 1, ...data };
      if (collection === 'skills') return { id: 2, ...data };
      return { id: 3, ...data, processingStatus: 'SKIPPED' };
    },
    update: async () => { throw new Error('Unexpected update'); },
  } as unknown as Payload;

  const result = await processSheetsVerifiedSkill(payload, event);
  assert.equal(result.kind, 'skipped');
  assert.deepEqual(createdRecords.students, {
    studentId: event.studentId,
    firstName: event.firstName,
    lastName: event.lastName,
    email: event.email,
  });
  assert.deepEqual(createdRecords.skills, {
    skillCode: event.skillCode,
    name: event.skillName,
    badgeId: event.badgeId,
  });
}

function assertBadgeIdSurvivesParsing() {
  const parsed = parseSheetsVerifiedSkillEvent({
    recordId: 'ROW-1', studentId: 'S-1', skillCode: 'SKL-001', badgeId: '  BDG-AI-002 ',
    earnedAt: '2026-10-28', status: 'CONFIRMED',
  });
  assert.equal(parsed?.badgeId, 'BDG-AI-002');
}

function processedRecordPayload(issuedBadgeId: string, operations: string[]) {
  const docs: Record<string, unknown[]> = {
    students: [{ id: 1, studentId: event.studentId }],
    skills: [{ id: 2, skillCode: event.skillCode, name: 'Existing', badgeId: 'BDG-SKL-001' }],
    'verified-skills': [{
      id: 3, student: 1, skill: 2, earnedAt: '2026-10-28', status: 'CONFIRMED', processingStatus: 'PROCESSED',
    }],
    'passport-versions': [{ skillsSnapshot: [{ recordId: event.recordId, badgeId: issuedBadgeId }] }],
  };
  return {
    find: async ({ collection }: { collection: string }) => {
      if (collection === 'passports') throw new Error('reissue reached passport lookup');
      return { docs: docs[collection] ?? [] };
    },
    update: async ({ collection, data }: { collection: string; data: Record<string, unknown> }) => {
      operations.push(`${collection}:${JSON.stringify(data)}`);
      return { id: 2, ...data };
    },
  } as unknown as Payload;
}

async function assertBadgeIdReplacesPlaceholderAndReissuesOnlyOnChange() {
  const confirmed = { ...event, status: 'CONFIRMED' as const };

  const unchangedOperations: string[] = [];
  const unchanged = await processSheetsVerifiedSkill(processedRecordPayload('bdg-ai-001', unchangedOperations), confirmed);
  assert.equal(unchanged.kind, 'duplicate');
  assert.deepEqual(unchangedOperations, [`skills:${JSON.stringify({ badgeId: 'BDG-AI-001' })}`]);

  const changedOperations: string[] = [];
  const originalConsoleError = console.error;
  console.error = () => undefined;
  try {
    await assert.rejects(processSheetsVerifiedSkill(processedRecordPayload('BDG-SKL-001', changedOperations), confirmed));
  } finally {
    console.error = originalConsoleError;
  }
  assert.ok(changedOperations.some((operation) => operation.includes('"processingStatus":"PROCESSING"')));
}

async function assertRecordIdConflictNamesChangedFields() {
  const payload = {
    find: async ({ collection }: { collection: string }) => ({
      docs: ({
        students: [{ id: 1, studentId: event.studentId }],
        skills: [{ id: 2, skillCode: event.skillCode, name: 'Existing', badgeId: 'BDG-AI-001' }],
        'verified-skills': [{ id: 3, student: 1, skill: 99, earnedAt: '2026-10-01', status: 'CONFIRMED', processingStatus: 'PROCESSED' }],
      } as Record<string, unknown[]>)[collection] ?? [],
    }),
  } as unknown as Payload;

  await assert.rejects(
    processSheetsVerifiedSkill(payload, { ...event, status: 'CONFIRMED' }),
    (error: unknown) => error instanceof SheetsIngestionError
      && error.status === 409
      && error.message.includes('(skill, earnedAt)'),
  );
}

async function assertStudentCreationRequiresPayloadFields() {
  const mutations: string[] = [];
  const payload = {
    find: async () => ({ docs: [] }),
    create: async () => { mutations.push('create'); throw new Error('Must not create when creation fields are incomplete'); },
  } as unknown as Payload;

  await assert.rejects(
    processSheetsVerifiedSkill(payload, { ...event, firstName: null, lastName: null, email: null }),
    (error: unknown) => error instanceof SheetsIngestionError
      && error.status === 422
      && error.message.includes('firstName, lastName, and email'),
  );
  assert.deepEqual(mutations, []);

  await assert.rejects(
    processSheetsVerifiedSkill(payload, { ...event, skillName: null }),
    (error: unknown) => error instanceof SheetsIngestionError
      && error.status === 422
      && error.message.includes('skillName'),
  );
  assert.deepEqual(mutations, [], 'incomplete skill data must not partially create a student');
}

async function main() {
  await assertUpsertCreatesMissingStudentAndSkill();
  assertBadgeIdSurvivesParsing();
  await assertBadgeIdReplacesPlaceholderAndReissuesOnlyOnChange();
  await assertRecordIdConflictNamesChangedFields();
  await assertStudentCreationRequiresPayloadFields();

  const operations: string[] = [];
  const transactionHash = await registerAndFinalizePassportVersion(
    async () => { operations.push('chain'); return '0xTEST'; },
    async () => { operations.push('issued'); },
    async () => { operations.push('latest'); },
  );
  assert.equal(transactionHash, '0xTEST');
  assert.deepEqual(operations, ['chain', 'issued', 'latest']);

  const failedOperations: string[] = [];
  await assert.rejects(registerAndFinalizePassportVersion(
    async () => { failedOperations.push('chain'); throw new Error('chain rejected'); },
    async () => { failedOperations.push('issued'); },
    async () => { failedOperations.push('latest'); },
  ));
  assert.deepEqual(failedOperations, ['chain']);

  const persistenceFailureOperations: string[] = [];
  await assert.rejects(registerAndFinalizePassportVersion(
    async () => { persistenceFailureOperations.push('chain'); return '0xTEST'; },
    async () => { persistenceFailureOperations.push('issued'); throw new Error('Payload update failed'); },
    async () => { persistenceFailureOperations.push('latest'); },
  ));
  assert.deepEqual(persistenceFailureOperations, ['chain', 'issued']);

  console.log('PASS  unknown student and skill are created from Sheets payload data');
  console.log('PASS  badgeId survives payload parsing');
  console.log('PASS  Record ID conflicts name the changed fields');
  console.log('PASS  Sheets badgeId replaces the placeholder and reissues only when the issued badge differs');
  console.log('PASS  incomplete student creation data is rejected clearly');
  console.log('PASS  latest pointer updates only after chain registration and ISSUED persistence');
  console.log('PASS  failed chain registration does not mark the version or advance latest');
  console.log('PASS  failed ISSUED persistence does not advance latest');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});