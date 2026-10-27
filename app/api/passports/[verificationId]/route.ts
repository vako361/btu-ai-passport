import { NextResponse } from 'next/server';
import { getPayload } from 'payload';
import config from '@payload-config';
import { readPassportPdf } from '@/lib/passportStorage';

export const runtime = 'nodejs';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ verificationId: string }> | { verificationId: string } },
) {
  const resolvedParams = await params;
  const verificationId = resolvedParams.verificationId;

  if (!/^VER-[A-Z0-9-]{1,80}$/i.test(verificationId)) {
    return NextResponse.json({ error: 'Passport not found.' }, { status: 404 });
  }

  const payload = await getPayload({ config });

  // მოვძებნოთ პასპორტის ვერსია Verification ID-ით საჯაროდ
  const versions = await payload.find({
    collection: 'passport-versions',
    where: {
      verificationId: { equals: verificationId },
      issuanceStatus: { equals: 'ISSUED' },
    },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  });

  const version = versions.docs[0];
  if (!version) return NextResponse.json({ error: 'Passport not found.' }, { status: 404 });

  try {
    const pdf = await readPassportPdf(verificationId, version.documentHash);
    const filename = `${verificationId}-v${version.version}.pdf`;
    return new Response(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(filename)}`,
        'Cache-Control': 'public, max-age=3600',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    console.error('Passport file could not be served', error);
    return NextResponse.json({ error: 'Passport file is unavailable.' }, { status: 404 });
  }
}