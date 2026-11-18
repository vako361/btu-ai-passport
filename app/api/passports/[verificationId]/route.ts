import { NextResponse } from 'next/server';
import { getPayload } from 'payload';
import config from '@payload-config';
import { getAppEnv } from '@/lib/env';
import { renderPassportPdf, skillsFromSnapshot } from '@/lib/issuance/pdf';
import { derivePassportId } from '@/lib/issuance/utils';
import { readOrCreatePassportPdf } from '@/lib/passportStorage';

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
    const pdf = await readOrCreatePassportPdf(storedVerificationId, version.documentHash, async () => {
      const passport = typeof version.passport === 'object' && version.passport !== null
        ? version.passport
        : null;
      if (!passport) throw new Error('Passport relation is unavailable for PDF regeneration.');

      return renderPassportPdf({
        holder: {
          studentId: passport.studentId,
          firstName: passport.firstName,
          lastName: passport.lastName,
          passportId: passport.passportId || derivePassportId(passport.studentId),
          firstIssuedAt: passport.firstIssuedAt ?? version.issuedAt,
        },
        version: version.version,
        issuedAt: version.issuedAt,
        verificationId: storedVerificationId,
        skills: skillsFromSnapshot(version.skillsSnapshot),
        verifyBaseUrl: getAppEnv().appUrl,
      });
    });
    const filename = `${storedVerificationId}-v${version.version}.pdf`;
    return new Response(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${filename}"`,
        'Cache-Control': 'public, max-age=3600',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    console.error('Passport file could not be served', error);
    return NextResponse.json({ error: 'Passport file is unavailable.' }, { status: 500 });
  }
}