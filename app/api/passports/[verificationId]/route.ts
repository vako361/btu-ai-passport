import { NextResponse } from 'next/server';
import { getPayload } from 'payload';
import config from '@payload-config';
import { generatePassportPDF } from '@/lib/pdfGenerator';
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

  // მოვძებნოთ პასპორტის ვერსია Verification ID-ით საჯაროდ
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
    const pdf = await readOrCreatePassportPdf(verificationId, version.documentHash, async () => {
      const passport = typeof version.passport === 'object' && version.passport !== null
        ? version.passport
        : null;
      if (!passport) throw new Error('Passport relation is unavailable for PDF regeneration.');

      const passportId = passport.passportId || (
        passport.studentId.startsWith('BTU-AI-')
          ? passport.studentId
          : `BTU-AI-${passport.studentId.replace(/^BTU-?/i, '')}`
      );
      const skills = (version.skillsSnapshot ?? []).map((skill) => ({
        recordId: skill.recordId,
        skillCode: skill.skillCode,
        skillName: skill.skillName,
        badgeId: skill.badgeId,
        earnedAt: skill.earnedAt,
        description: skill.description ?? '',
        'Skill Code': skill.skillCode,
        'Skill Name': skill.skillName,
        'Date Earned': skill.earnedAt,
        'Skill Description': skill.description ?? '',
        'Badge/Stamp': skill.badgeId,
        'Record ID': skill.recordId,
      }));

      return generatePassportPDF({
        'Student ID': passport.studentId,
        'First Name': passport.firstName,
        'Last Name': passport.lastName,
        'Passport ID': passportId,
        'First Issued At': passport.firstIssuedAt ?? version.issuedAt,
        'Passport Version': version.version,
        'Issued At': version.issuedAt,
      }, skills, verificationId);
    });
    const filename = `${verificationId}-v${version.version}.pdf`;
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