import { randomUUID } from 'node:crypto';
import { getPayload, type Payload } from 'payload';
import { NextResponse } from 'next/server';
import config from '@payload-config';
import { writeIntegrationLog } from '@/lib/integrationLog';
import { SheetsIngestionError, processSheetsVerifiedSkill } from '@/lib/sheetsIngestion';
import { parseSheetsVerifiedSkillEvent } from '@/lib/passportTypes';
import { verifySheetsWebhookSignature } from '@/lib/sheetsWebhook';

export const runtime = 'nodejs';

const MAX_BODY_BYTES = 16 * 1024;
const TRANSIENT_DATABASE_CODES = new Set([
  'ECONNRESET',
  'ECONNREFUSED',
  'ETIMEDOUT',
  'ENETUNREACH',
  'EHOSTUNREACH',
  'EAI_AGAIN',
]);

function isTransientDatabaseError(error: unknown, seen = new Set<unknown>()): boolean {
  if (typeof error !== 'object' || error === null || seen.has(error)) return false;
  seen.add(error);

  const candidate = error as { code?: unknown; cause?: unknown; errors?: unknown };
  if (typeof candidate.code === 'string' && TRANSIENT_DATABASE_CODES.has(candidate.code)) return true;
  if (isTransientDatabaseError(candidate.cause, seen)) return true;
  return Array.isArray(candidate.errors) && candidate.errors.some((nested) => isTransientDatabaseError(nested, seen));
}

export async function POST(request: Request) {
  const requestId = randomUUID();
  let payload: Payload | undefined;
  let recordId: string | undefined;

  const log = async (
    stage: 'AUTHENTICATION' | 'VALIDATION' | 'LOOKUP' | 'INGESTION',
    outcome: 'ACCEPTED' | 'DUPLICATE' | 'SKIPPED' | 'REJECTED' | 'FAILED',
    message: string,
  ) => {
    try {
      payload ??= await getPayload({ config });
      await writeIntegrationLog(payload, { requestId, recordId, stage, outcome, message });
    } catch (error) {
      console.error(`[${requestId}] Could not initialize integration audit log`, error);
    }
  };

  try {
    const rawBody = await request.text();

    if (Buffer.byteLength(rawBody, 'utf8') > MAX_BODY_BYTES) {
      await log('VALIDATION', 'REJECTED', 'Request body exceeded the size limit.');
      return NextResponse.json({ success: false, requestId, error: 'Request body is too large.' }, { status: 413 });
    }

    const secret = process.env.SHEETS_WEBHOOK_SECRET;
    if (!secret || secret.length < 32) {
      await log('AUTHENTICATION', 'FAILED', 'Webhook secret is missing or too short.');
      return NextResponse.json({ success: false, requestId, error: 'Webhook is not configured.' }, { status: 503 });
    }

    const authenticated = verifySheetsWebhookSignature(
      rawBody,
      request.headers.get('x-sheets-timestamp'),
      request.headers.get('x-sheets-signature'),
      secret,
    );
    if (!authenticated) {
      await log('AUTHENTICATION', 'REJECTED', 'Signature is invalid or timestamp has expired.');
      return NextResponse.json({ success: false, requestId, error: 'Unauthorized.' }, { status: 401 });
    }

    let body: unknown;
    try {
      body = JSON.parse(rawBody);
    } catch {
      await log('VALIDATION', 'REJECTED', 'Request body is not valid JSON.');
      return NextResponse.json({ success: false, requestId, error: 'Invalid JSON.' }, { status: 400 });
    }

    // The body contains student PII, so it is only logged outside production.
    if (process.env.NODE_ENV !== 'production') console.log('Received payload:', body);

    const event = parseSheetsVerifiedSkillEvent(body);
    if (!event) {
      const candidate = typeof body === 'object' && body !== null ? (body as Record<string, unknown>).recordId : undefined;
      recordId = typeof candidate === 'string' ? candidate.slice(0, 200) : undefined;
      await log('VALIDATION', 'REJECTED', 'Required fields or field formats are invalid.');
      return NextResponse.json({ success: false, requestId, error: 'Invalid Sheets record.' }, { status: 400 });
    }
    recordId = event.recordId;

    payload ??= await getPayload({ config });
    const result = await processSheetsVerifiedSkill(payload, event);

    if (result.kind === 'skipped') {
      await log('INGESTION', 'SKIPPED', result.message);
      return NextResponse.json({ success: true, requestId, skipped: true, message: result.message }, { status: 202 });
    }
    if (result.kind === 'duplicate') {
      await log('INGESTION', 'DUPLICATE', result.message);
      return NextResponse.json({ success: true, requestId, duplicate: true, message: result.message }, { status: 200 });
    }

    await log('INGESTION', 'ACCEPTED', `Passport version ${result.version} issued; tx ${result.txHash}.`);
    return NextResponse.json({ success: true, requestId, ...result }, { status: 200 });
  } catch (error) {
    const transientDatabaseFailure = isTransientDatabaseError(error);
    const status = error instanceof SheetsIngestionError ? error.status : transientDatabaseFailure ? 503 : 500;
    const stage = error instanceof SheetsIngestionError ? error.stage : 'INGESTION';
    const outcome = error instanceof SheetsIngestionError ? error.outcome : 'FAILED';
    const message = error instanceof Error
      ? `${error.name}: ${error.message}`.slice(0, 500)
      : 'Unknown ingestion failure.';
    const responseMessage = error instanceof SheetsIngestionError
      ? error.message
      : transientDatabaseFailure
        ? 'Database connection temporarily unavailable. Retry this row.'
        : 'Unexpected ingestion failure. Check the request ID in integration logs.';

    console.error(`[${requestId}] Google Sheets ingestion failed`, error);
    await log(stage, outcome, message);

    return NextResponse.json({ success: false, requestId, error: responseMessage }, { status });
  }
}