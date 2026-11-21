import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import type { Payload } from 'payload';
import { getStorageEnv } from './env';

const FILE_MAGIC = Buffer.from('BTUPDF01');

/** Thrown when no PDF has been stored for a Verification ID yet. */
export class PassportFileMissingError extends Error {
  constructor(verificationId: string) {
    super(`No stored passport PDF for ${verificationId}.`);
    this.name = 'PassportFileMissingError';
  }
}

function encryptionKey() {
  return getStorageEnv().encryptionKey;
}

function assertVerificationId(verificationId: string) {
  if (!/^VER-[A-Z0-9-]{1,80}$/i.test(verificationId)) throw new Error('Invalid Verification ID.');
}

async function findStoredFile(payload: Payload, verificationId: string) {
  assertVerificationId(verificationId);
  const result = await payload.find({
    collection: 'passport-files',
    where: { verificationId: { equals: verificationId } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  });
  return result.docs[0] ?? null;
}

function hashDocument(buffer: Buffer) {
  return `0x${createHash('sha256').update(buffer).digest('hex')}`;
}

function encryptPdf(buffer: Buffer) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
  return Buffer.concat([FILE_MAGIC, iv, cipher.getAuthTag(), encrypted]);
}

function decryptPdf(envelope: Buffer) {
  if (envelope.length < FILE_MAGIC.length + 12 + 16 || !envelope.subarray(0, FILE_MAGIC.length).equals(FILE_MAGIC)) {
    throw new Error('Stored passport file has an invalid format.');
  }

  const ivStart = FILE_MAGIC.length;
  const tagStart = ivStart + 12;
  const dataStart = tagStart + 16;
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), envelope.subarray(ivStart, tagStart));
  decipher.setAuthTag(envelope.subarray(tagStart, dataStart));
  return Buffer.concat([decipher.update(envelope.subarray(dataStart)), decipher.final()]);
}

/** Stores the encrypted PDF in Postgres so every serverless instance serves the same bytes. */
export async function storePassportPdf(payload: Payload, verificationId: string, pdf: Buffer, expectedHash: string) {
  if (hashDocument(pdf).toLowerCase() !== expectedHash.toLowerCase()) {
    throw new Error('Generated PDF hash does not match the PassportVersion hash.');
  }

  const existing = await findStoredFile(payload, verificationId);
  if (existing && existing.documentHash.toLowerCase() === expectedHash.toLowerCase()) return;

  const data = {
    verificationId,
    documentHash: expectedHash,
    encryptedPdf: encryptPdf(pdf).toString('base64'),
  };
  if (existing) {
    // Replaces a row left by an earlier attempt that never produced a version.
    await payload.update({ collection: 'passport-files', id: existing.id, data, overrideAccess: true });
    return;
  }
  await payload.create({ collection: 'passport-files', data, overrideAccess: true });
}

export async function deletePassportPdf(payload: Payload, verificationId: string) {
  assertVerificationId(verificationId);
  await payload.delete({
    collection: 'passport-files',
    where: { verificationId: { equals: verificationId } },
    overrideAccess: true,
  });
}

export async function readPassportPdf(payload: Payload, verificationId: string, expectedHash: string) {
  const stored = await findStoredFile(payload, verificationId);
  if (!stored) throw new PassportFileMissingError(verificationId);

  const pdf = decryptPdf(Buffer.from(stored.encryptedPdf, 'base64'));
  if (hashDocument(pdf).toLowerCase() !== expectedHash.toLowerCase()) {
    throw new Error('Stored passport PDF failed integrity verification.');
  }
  return pdf;
}

export async function readOrCreatePassportPdf(
  payload: Payload,
  verificationId: string,
  expectedHash: string,
  createPdf: () => Promise<Buffer>,
) {
  try {
    return await readPassportPdf(payload, verificationId, expectedHash);
  } catch (error) {
    if (!(error instanceof PassportFileMissingError)) throw error;
  }

  const pdf = await createPdf();
  if (hashDocument(pdf).toLowerCase() !== expectedHash.toLowerCase()) {
    throw new Error('Generated PDF hash does not match the PassportVersion hash.');
  }

  try {
    await storePassportPdf(payload, verificationId, pdf, expectedHash);
  } catch (error) {
    console.warn('Regenerated passport PDF could not be stored.', error);
  }
  return pdf;
}