import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getPayload } from 'payload';
import { PDFDocument } from 'pdf-lib';
import config from '@payload-config';
import { EnvConfigError } from '@/lib/env';
import { getLedger, LedgerConfigError } from '@/lib/ledger';
import { isValidVerificationId, verifyCredential } from '@/lib/verification';

export const runtime = 'nodejs';

const MAX_PDF_BYTES = 10 * 1024 * 1024;
const MAX_REQUEST_BYTES = MAX_PDF_BYTES + 256 * 1024;

async function publicStatus(verificationId: string, documentHash?: string) {
  const payload = await getPayload({ config });
  const result = await verifyCredential(payload, getLedger(payload), verificationId, documentHash);
  return { success: true as const, ...result };
}

export async function POST(request: Request) {
  try {
    const contentLength = Number(request.headers.get('content-length'));
    if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES) {
      return NextResponse.json({ success: false, error: 'PDF must be no larger than 10 MB.' }, { status: 413 });
    }

    const formData = await request.formData();
    const fileEntry = formData.get('file');
    const verificationIdEntry = formData.get('verificationId');

    if (fileEntry instanceof File) {
      if (fileEntry.type !== 'application/pdf' || fileEntry.size === 0 || fileEntry.size > MAX_PDF_BYTES) {
        return NextResponse.json({ success: false, error: 'PDF must be valid and no larger than 10 MB.' }, { status: 400 });
      }

      const buffer = Buffer.from(await fileEntry.arrayBuffer());
      const pdf = await PDFDocument.load(buffer, { updateMetadata: false });
      const verificationId = pdf.getSubject()?.trim();
      if (!verificationId || !isValidVerificationId(verificationId)) {
        return NextResponse.json({ success: false, error: 'PDF has no valid Verification ID.' }, { status: 400 });
      }

      const hash = `0x${createHash('sha256').update(buffer).digest('hex')}`;
      return NextResponse.json(await publicStatus(verificationId, hash));
    }

    if (typeof verificationIdEntry === 'string') {
      const verificationId = verificationIdEntry.trim();
      if (!isValidVerificationId(verificationId)) {
        return NextResponse.json({ success: false, error: 'Invalid Verification ID.' }, { status: 400 });
      }
      return NextResponse.json(await publicStatus(verificationId));
    }

    return NextResponse.json({ success: false, error: 'Provide a Verification ID or PDF.' }, { status: 400 });
  } catch (error) {
    console.error('Public passport verification failed', error);
    if (error instanceof LedgerConfigError || error instanceof EnvConfigError) {
      return NextResponse.json({ success: false, error: 'Public verification is not configured.' }, { status: 503 });
    }
    return NextResponse.json({ success: false, error: 'Unable to verify this submission.' }, { status: 500 });
  }
}