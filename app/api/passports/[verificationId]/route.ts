import { NextResponse } from 'next/server';
import { getPayload } from 'payload';
import config from '@payload-config';
import { readPassportPdf } from '@/lib/passportStorage';

export const runtime = 'nodejs';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ verificationId: string }> },
) {
  const { verificationId } = await params;
  if (!/^VER-[A-Z0-9-]{1,80}$/i.test(verificationId)) {
    return NextResponse.json({ error: 'Passport not found.' }, { status: 404 });
  }

  const payload = await getPayload({ config });
  const { user } = await payload.auth({ headers: request.headers });
  const email = typeof user?.email === 'string' ? user.email : null;
  if (!email) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

  const students = await payload.find({
    collection: 'students',
    where: { email: { equals: email.toLowerCase() } },
    limit: 2,
    depth: 0,
    overrideAccess: true,
  });
  if (students.docs.length !== 1) return NextResponse.json({ error: 'Passport not found.' }, { status: 404 });

  const passports = await payload.find({
    collection: 'passports',
    where: { studentRecord: { equals: students.docs[0].id } },
    limit: 2,
    depth: 0,
    overrideAccess: true,
  });
  if (passports.docs.length !== 1) return NextResponse.json({ error: 'Passport not found.' }, { status: 404 });

  const versions = await payload.find({
    collection: 'passport-versions',
    where: {
      and: [
        { passport: { equals: passports.docs[0].id } },
        { verificationId: { equals: verificationId } },
        { issuanceStatus: { equals: 'ISSUED' } },
      ],
    },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  });
  const version = versions.docs[0];
  if (!version) return NextResponse.json({ error: 'Passport not found.' }, { status: 404 });

  try {
    const pdf = await readPassportPdf(verificationId, version.documentHash);
    const filename = `${passports.docs[0].passportId}-v${version.version}.pdf`;
    return new Response(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    console.error('Private passport file could not be served', error);
    return NextResponse.json({ error: 'Passport file is unavailable.' }, { status: 404 });
  }
}