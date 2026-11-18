import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createDemoSigner, DemoLedger } from '../ledger/demoLedger';
import { PayloadLedgerStore } from '../ledger/payloadStore';
import { createFakePayload, type FakePayload } from './fakePayload';

export const VERIFY_BASE_URL = 'https://demo.example.com';

/** The PDF generator logs every badge and image it draws; silence it for the duration of a test file. */
export function muteConsoleLog(): () => void {
  const original = console.log;
  console.log = () => undefined;
  return () => {
    console.log = original;
  };
}

/** Points PDF storage at a throwaway directory; call once per test file before issuing anything. */
export async function useTemporaryStorage(): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'passport-test-'));
  process.env.PASSPORT_STORAGE_DIR = directory;
  process.env.PASSPORT_STORAGE_KEY = 'ab'.repeat(32);
  return directory;
}

export interface Harness {
  payload: FakePayload;
  ledger: DemoLedger;
}

export function createHarness(): Harness {
  const payload = createFakePayload();
  const ledger = new DemoLedger({
    store: new PayloadLedgerStore(payload),
    signer: createDemoSigner({ payloadSecret: 'integration-test-secret-value' }),
  });
  return { payload, ledger };
}

export async function addStudent(
  payload: FakePayload,
  overrides: Partial<{ studentId: string; firstName: string; lastName: string; email: string }> = {},
) {
  const studentId = overrides.studentId ?? 'STU-TEST-1';
  return payload.create({
    collection: 'students',
    overrideAccess: true,
    data: {
      studentId,
      firstName: overrides.firstName ?? 'Ada',
      lastName: overrides.lastName ?? 'Lovelace',
      email: overrides.email ?? `${studentId.toLowerCase()}@example.com`,
    },
  });
}

export async function addSkill(
  payload: FakePayload,
  skillCode: string,
  name = `Skill ${skillCode}`,
  badgeId = 'BDG-AI-001',
) {
  return payload.create({
    collection: 'skills',
    overrideAccess: true,
    data: { skillCode, name, badgeId, category: 'Test', description: `${name} description.` },
  });
}
