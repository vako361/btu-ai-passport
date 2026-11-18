import { createHash } from 'node:crypto';

export function relationId(value: unknown): string | undefined {
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (typeof value !== 'object' || value === null) return undefined;

  const relation = value as { id?: unknown; value?: unknown };
  const id = relation.id ?? relation.value;
  return typeof id === 'string' || typeof id === 'number' ? String(id) : undefined;
}

export function dateOnly(value: string): string {
  return new Date(value).toISOString().slice(0, 10);
}

/** Stable per source record, so retries of the same record always target the same version. */
export function verificationIdForRecord(recordId: string): string {
  return `VER-${createHash('sha256').update(recordId).digest('hex').slice(0, 24).toUpperCase()}`;
}

export function derivePassportId(studentId: string): string {
  return studentId.startsWith('BTU-AI-') ? studentId : `BTU-AI-${studentId.replace(/^BTU-?/i, '')}`;
}

export function passportDownloadPath(verificationId: string): string {
  return `/api/passports/${encodeURIComponent(verificationId)}`;
}

export function sha256Hex(buffer: Buffer): string {
  return `0x${createHash('sha256').update(buffer).digest('hex')}`;
}
