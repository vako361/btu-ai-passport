import { NextResponse } from 'next/server';
import { getPayload } from 'payload';
import config from '@payload-config';
import { renderStoredVersionPdf } from '@/lib/issuance/regenerate';
import { readOrCreatePassportPdf } from '@/lib/passportStorage';

export const runtime = 'nodejs';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ verificationId: string }> | { verificationId: string } },
) {
  const resolvedParams = await params;
  const verificationId = resolvedParams.verificationId;

  if (!/^VER-[A-Z0-9-]{1,80}$/i.test(verificationId)) {
    return NextResponse.json({ error: 'Passport not found.' }, { status: 404 });
  }

  const payload = await getPayload({ config });

  // Look up the passport version by its public Verification ID.
  const versions = await payload.find({
    collection: 'passport-versions',
    where: {
      verificationId: { equals: verificationId },
      issuanceStatus: { equals: 'ISSUED' },
    },
    limit: 1,
    depth: 1,
    overrideAccess: true,
  });

  const version = versions.docs[0];
  if (!version) return NextResponse.json({ error: 'Passport not found.' }, { status: 404 });

  try {
    const storedVerificationId = version.verificationId;
    const pdf = await readOrCreatePassportPdf(payload, storedVerificationId, version.documentHash, () => {
      // Never guess the origin: a different one changes the QR and therefore the hash.
      if (!version.verifyBaseUrl) throw new Error(`No verifyBaseUrl recorded for ${storedVerificationId}.`);
      return renderStoredVersionPdf(version, version.verifyBaseUrl);
    });
    const filename = `${storedVerificationId}-v${version.version}.pdf`;
    const download = new URL(request.url).searchParams.get('download') === '1';
    const disposition = download ? 'attachment' : 'inline';
    return new Response(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `${disposition}; filename="${filename}"`,
        'Cache-Control': 'public, max-age=3600',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    console.error('Passport file could not be served', error);
    return NextResponse.json({ error: 'Passport file is unavailable.' }, { status: 500 });
  }
}