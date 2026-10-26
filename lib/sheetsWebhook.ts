import { createHmac, timingSafeEqual } from 'node:crypto';

const MAX_TIMESTAMP_AGE_MS = 5 * 60 * 1000;

export function verifySheetsWebhookSignature(
  rawBody: string,
  timestampHeader: string | null,
  signatureHeader: string | null,
  secret: string | undefined,
  now = Date.now(),
): boolean {
  if (!secret || secret.length < 32 || !timestampHeader || !signatureHeader) return false;

  const timestamp = Number(timestampHeader);
  if (!Number.isSafeInteger(timestamp) || Math.abs(now - timestamp) > MAX_TIMESTAMP_AGE_MS) {
    return false;
  }

  const suppliedHex = signatureHeader.replace(/^sha256=/, '');
  if (!/^[0-9a-f]{64}$/i.test(suppliedHex)) return false;

  const expected = createHmac('sha256', secret)
    .update(`${timestampHeader}.${rawBody}`)
    .digest();
  const supplied = Buffer.from(suppliedHex, 'hex');

  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}