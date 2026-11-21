import type { PassportVersion } from '../../payload-types';
import { renderPassportPdf, skillsFromSnapshot } from './pdf';
import { derivePassportId } from './utils';

/**
 * `verifyBaseUrl` must match issuance: a different origin changes the QR and the document hash. Null renders without a QR.
 */
export function renderStoredVersionPdf(version: PassportVersion, verifyBaseUrl: string | null): Promise<Buffer> {
  const passport = typeof version.passport === 'object' && version.passport !== null ? version.passport : null;
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
    verificationId: version.verificationId,
    skills: skillsFromSnapshot(version.skillsSnapshot),
    verifyBaseUrl: verifyBaseUrl ?? undefined,
  });
}
