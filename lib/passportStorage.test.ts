import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import { createFakePayload } from './testing/fakePayload';
import { PassportFileMissingError, readOrCreatePassportPdf, readPassportPdf, storePassportPdf } from './passportStorage';

const STORAGE_KEY = 'ab'.repeat(32);

function hashOf(content: Buffer) {
  return `0x${createHash('sha256').update(content).digest('hex')}`;
}

function verificationIdForTest() {
  return `VER-STORAGE-${randomUUID().replaceAll('-', '').toUpperCase()}`;
}

describe('passport PDF storage', () => {
  let previousKey: string | undefined;

  before(() => {
    previousKey = process.env.PASSPORT_STORAGE_KEY;
    process.env.PASSPORT_STORAGE_KEY = STORAGE_KEY;
  });

  after(() => {
    if (previousKey === undefined) delete process.env.PASSPORT_STORAGE_KEY;
    else process.env.PASSPORT_STORAGE_KEY = previousKey;
  });

  it('stores the PDF encrypted in the database and reads back identical bytes', async () => {
    const payload = createFakePayload();
    const verificationId = verificationIdForTest();
    const pdf = Buffer.from('%PDF-1.4 passport bytes');
    const expectedHash = hashOf(pdf);

    await storePassportPdf(payload, verificationId, pdf, expectedHash);

    const [row] = payload.dump('passport-files');
    assert.equal(row.verificationId, verificationId);
    assert.equal(row.documentHash, expectedHash);
    assert.equal(Buffer.from(row.encryptedPdf as string, 'base64').includes(pdf), false);
    assert.deepEqual(await readPassportPdf(payload, verificationId, expectedHash), pdf);
  });

  it('rejects PDF bytes that do not match the expected hash', async () => {
    const payload = createFakePayload();

    await assert.rejects(
      storePassportPdf(payload, verificationIdForTest(), Buffer.from('passport bytes'), hashOf(Buffer.from('other bytes'))),
      /does not match/,
    );
    assert.equal(payload.dump('passport-files').length, 0);
  });

  it('reports a PDF that was never stored as missing', async () => {
    const payload = createFakePayload();

    await assert.rejects(
      readPassportPdf(payload, verificationIdForTest(), hashOf(Buffer.from('passport bytes'))),
      PassportFileMissingError,
    );
  });

  it('rejects a stored PDF whose bytes no longer match the recorded hash', async () => {
    const payload = createFakePayload();
    const verificationId = verificationIdForTest();
    const pdf = Buffer.from('passport bytes');
    await storePassportPdf(payload, verificationId, pdf, hashOf(pdf));

    await assert.rejects(
      readPassportPdf(payload, verificationId, hashOf(Buffer.from('tampered bytes'))),
      /failed integrity verification/,
    );
  });

  it('replaces a row left behind by an attempt that never produced a version', async () => {
    const payload = createFakePayload();
    const verificationId = verificationIdForTest();
    const orphan = Buffer.from('orphaned draft');
    const issued = Buffer.from('issued passport');

    await storePassportPdf(payload, verificationId, orphan, hashOf(orphan));
    await storePassportPdf(payload, verificationId, issued, hashOf(issued));

    assert.equal(payload.dump('passport-files').length, 1);
    assert.deepEqual(await readPassportPdf(payload, verificationId, hashOf(issued)), issued);
  });

  it('regenerates a missing PDF once and serves the stored copy afterwards', async () => {
    const payload = createFakePayload();
    const verificationId = verificationIdForTest();
    const pdf = Buffer.from('regenerated passport PDF');
    const expectedHash = hashOf(pdf);
    let regenerateCalls = 0;
    const regenerate = async () => {
      regenerateCalls += 1;
      return pdf;
    };

    assert.deepEqual(await readOrCreatePassportPdf(payload, verificationId, expectedHash, regenerate), pdf);
    assert.deepEqual(await readOrCreatePassportPdf(payload, verificationId, expectedHash, regenerate), pdf);

    assert.equal(regenerateCalls, 1);
    assert.equal(payload.dump('passport-files').length, 1);
  });

  it('rejects a regenerated PDF whose hash differs from the version', async () => {
    const payload = createFakePayload();

    await assert.rejects(
      readOrCreatePassportPdf(payload, verificationIdForTest(), hashOf(Buffer.from('issued')), async () =>
        Buffer.from('regenerated with a different QR origin'),
      ),
      /does not match/,
    );
  });
});