import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import { readOrCreatePassportPdf, readPassportPdf, storePassportPdf } from './passportStorage';

const STORAGE_KEY = 'ab'.repeat(32);

function hashOf(content: Buffer) {
  return `0x${createHash('sha256').update(content).digest('hex')}`;
}

function verificationIdForTest() {
  return `VER-STORAGE-${randomUUID().replaceAll('-', '').toUpperCase()}`;
}

function restoreEnvironment(values: Record<string, string | undefined>) {
  for (const [name, value] of Object.entries(values)) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
}

describe('passport PDF storage', () => {
  it('uses the temporary directory on Vercel even when a storage directory is configured', async () => {
    const baseDirectory = await mkdtemp(path.join(os.tmpdir(), 'passport-storage-test-'));
    const previousEnvironment = {
      PASSPORT_STORAGE_DIR: process.env.PASSPORT_STORAGE_DIR,
      PASSPORT_STORAGE_KEY: process.env.PASSPORT_STORAGE_KEY,
      TMPDIR: process.env.TMPDIR,
      VERCEL: process.env.VERCEL,
    };
    const configuredDirectory = path.join(baseDirectory, 'configured-storage');
    const verificationId = verificationIdForTest();
    const pdf = Buffer.from('regenerated passport PDF');
    const expectedHash = hashOf(pdf);

    try {
      process.env.PASSPORT_STORAGE_DIR = configuredDirectory;
      process.env.PASSPORT_STORAGE_KEY = STORAGE_KEY;
      process.env.TMPDIR = baseDirectory;
      process.env.VERCEL = '1';

      await storePassportPdf(verificationId, pdf, expectedHash);

      assert.deepEqual(await readPassportPdf(verificationId, expectedHash), pdf);
      await assert.rejects(readdir(configuredDirectory), { code: 'ENOENT' });
    } finally {
      restoreEnvironment(previousEnvironment);
      await rm(baseDirectory, { recursive: true, force: true });
    }
  });

  it('returns a regenerated PDF when its optional disk cache cannot be written', async () => {
    const baseDirectory = await mkdtemp(path.join(os.tmpdir(), 'passport-storage-test-'));
    const previousEnvironment = {
      PASSPORT_STORAGE_DIR: process.env.PASSPORT_STORAGE_DIR,
      PASSPORT_STORAGE_KEY: process.env.PASSPORT_STORAGE_KEY,
      VERCEL: process.env.VERCEL,
    };
    const unavailableDirectory = path.join(baseDirectory, 'not-a-directory');
    const verificationId = verificationIdForTest();
    const pdf = Buffer.from('regenerated passport PDF');
    const expectedHash = hashOf(pdf);

    try {
      await writeFile(unavailableDirectory, 'file prevents directory creation');
      process.env.PASSPORT_STORAGE_DIR = unavailableDirectory;
      process.env.PASSPORT_STORAGE_KEY = STORAGE_KEY;
      delete process.env.VERCEL;

      const result = await readOrCreatePassportPdf(verificationId, expectedHash, async () => pdf);

      assert.deepEqual(result, pdf);
    } finally {
      restoreEnvironment(previousEnvironment);
      await rm(baseDirectory, { recursive: true, force: true });
    }
  });
});