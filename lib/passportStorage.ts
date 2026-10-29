import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { chmod, mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';

const FILE_MAGIC = Buffer.from('BTUPDF01');

function storageDirectory() {
  const configuredDirectory = process.env.PASSPORT_STORAGE_DIR;
  if (!configuredDirectory) return path.join(process.cwd(), 'storage', 'passports');
  return path.resolve(/* turbopackIgnore: true */ configuredDirectory);
}

function encryptionKey() {
  const value = process.env.PASSPORT_STORAGE_KEY;
  if (!value || !/^[0-9a-f]{64}$/i.test(value)) {
    throw new Error('PASSPORT_STORAGE_KEY must be a 32-byte hexadecimal key.');
  }
  return Buffer.from(value, 'hex');
}

function filePath(verificationId: string) {
  if (!/^VER-[A-Z0-9-]{1,80}$/i.test(verificationId)) throw new Error('Invalid Verification ID.');
  return path.join(storageDirectory(), `${verificationId}.pdf.enc`);
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

async function verifyExisting(pathname: string, expectedHash: string) {
  try {
    const existingPdf = decryptPdf(await readFile(pathname));
    return hashDocument(existingPdf).toLowerCase() === expectedHash.toLowerCase();
  } catch {
    return false;
  }
}

export async function storePassportPdf(verificationId: string, pdf: Buffer, expectedHash: string) {
  if (hashDocument(pdf).toLowerCase() !== expectedHash.toLowerCase()) {
    throw new Error('Generated PDF hash does not match the PassportVersion hash.');
  }

  const directory = storageDirectory();
  await mkdir(directory, { recursive: true, mode: 0o700 });
  await chmod(directory, 0o700);
  const destination = filePath(verificationId);

  // თუ ზუსტად იგივე PDF უკვე არსებობს, ხელახლა აღარ გადავწერთ
  if (await verifyExisting(destination, expectedHash)) {
    return;
  }

  const temporary = path.join(directory, `.${verificationId}.${randomBytes(8).toString('hex')}.tmp`);
  try {
    await writeFile(temporary, encryptPdf(pdf), { flag: 'wx', mode: 0o600 });
    // rename უზრუნველყოფს არსებული ფაილის უსაფრთხო და ატომურ გადაწერას
    await rename(temporary, destination);
  } finally {
    await unlink(temporary).catch(() => undefined);
  }
}

export async function readPassportPdf(verificationId: string, expectedHash: string) {
  const pdf = decryptPdf(await readFile(filePath(verificationId)));
  if (hashDocument(pdf).toLowerCase() !== expectedHash.toLowerCase()) {
    throw new Error('Stored passport PDF failed integrity verification.');
  }
  return pdf;
}