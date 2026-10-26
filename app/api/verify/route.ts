import { timingSafeEqual, createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { PDFDocument } from 'pdf-lib';
import { verifyDocumentOnChain } from '@/lib/blockchain';

export const runtime = 'nodejs';

const MAX_PDF_BYTES = 10 * 1024 * 1024;
const MAX_REQUEST_BYTES = MAX_PDF_BYTES + 256 * 1024;

type PublicVerificationResult = {
  success: true;
  verificationId: string;
  recordExists: boolean;
  documentIntegrity: 'VERIFIED' | 'FAILED' | 'NOT_CHECKED';
  issuerAuthenticity: 'VERIFIED' | 'UNVERIFIED' | 'NOT_CONFIGURED' | 'NOT_CHECKED';
  latestStatus: 'LATEST' | 'SUPERSEDED' | 'NOT_CHECKED' | 'UNKNOWN';
  version: number | null;
};

function safeHashEquals(left: string, right: string) {
  const normalize = (value: string) => value.toLowerCase().replace(/^0x/, '');
  const leftBytes = Buffer.from(normalize(left), 'hex');
  const rightBytes = Buffer.from(normalize(right), 'hex');
  return leftBytes.length === 32 && rightBytes.length === 32 && timingSafeEqual(leftBytes, rightBytes);
}

async function publicStatus(
  verificationId: string,
  documentHash?: string,
): Promise<PublicVerificationResult> {
  const record = await verifyDocumentOnChain(verificationId);
  if (!record.recordExists) {
    return {
      success: true,
      verificationId,
      recordExists: false,
      documentIntegrity: 'NOT_CHECKED',
      issuerAuthenticity: 'NOT_CHECKED',
      latestStatus: 'UNKNOWN',
      version: null,
    };
  }

  return {
    success: true,
    verificationId,
    recordExists: true,
    documentIntegrity: documentHash
      ? safeHashEquals(documentHash, record.documentHash) ? 'VERIFIED' : 'FAILED'
      : 'NOT_CHECKED',
    issuerAuthenticity: record.issuerAuthenticity,
    latestStatus: record.isLatest ? 'LATEST' : 'SUPERSEDED',
    version: record.version,
  };
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
      if (!verificationId || !/^VER-[A-Z0-9-]{1,80}$/i.test(verificationId)) {
        return NextResponse.json({ success: false, error: 'PDF has no valid Verification ID.' }, { status: 400 });
      }

      const hash = `0x${createHash('sha256').update(buffer).digest('hex')}`;
      return NextResponse.json(await publicStatus(verificationId, hash));
    }

    if (typeof verificationIdEntry === 'string') {
      const verificationId = verificationIdEntry.trim();
      if (!/^VER-[A-Z0-9-]{1,80}$/i.test(verificationId)) {
        return NextResponse.json({ success: false, error: 'Invalid Verification ID.' }, { status: 400 });
      }
      return NextResponse.json(await publicStatus(verificationId));
    }

    return NextResponse.json({ success: false, error: 'Provide a Verification ID or PDF.' }, { status: 400 });
  } catch (error) {
    console.error('Public passport verification failed', error);
    if (error instanceof Error && error.message.includes('not configured')) {
      return NextResponse.json({ success: false, error: 'Public blockchain verification is not configured.' }, { status: 503 });
    }
    return NextResponse.json({ success: false, error: 'Unable to verify this submission.' }, { status: 500 });
  }
}