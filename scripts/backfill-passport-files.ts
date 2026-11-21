import dotenv from 'dotenv';
import { renderStoredVersionPdf } from '../lib/issuance/regenerate';
import { sha256Hex } from '../lib/issuance/utils';
import { storePassportPdf } from '../lib/passportStorage';

dotenv.config({ path: ['.env.local', '.env'] });

// Loaded after dotenv because the Payload config reads the environment on import.
const [{ default: config }, { getPayload }] = await Promise.all([import('../payload.config'), import('payload')]);

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const includeNoQr = args.includes('--no-qr');
const unknown = args.filter((arg) => arg !== '--apply' && arg !== '--no-qr' && !arg.startsWith('--origin='));
if (unknown.length) {
  throw new Error(`Unknown option(s): ${unknown.join(', ')}. Supported: --origin=<url> (repeatable), --no-qr, --apply`);
}

const origins = args
  .filter((arg) => arg.startsWith('--origin='))
  .map((arg) => new URL(arg.slice('--origin='.length)).origin);
if (origins.length === 0 && !includeNoQr) {
  throw new Error('Pass at least one candidate origin (--origin=http://localhost:3000) or --no-qr.');
}

const payload = await getPayload({ config });

try {
  const { docs: versions } = await payload.find({
    collection: 'passport-versions',
    where: { issuanceStatus: { equals: 'ISSUED' } },
    depth: 1,
    pagination: false,
    overrideAccess: true,
  });

  const candidateLabels = [...origins, ...(includeNoQr ? ['no QR'] : [])];
  console.log(`${apply ? 'Applying' : 'Dry run'}: ${versions.length} issued versions, candidates: ${candidateLabels.join(', ')}`);

  const unmatched: string[] = [];
  let repaired = 0;

  for (const version of versions) {
    const { id, verificationId, documentHash } = version;
    const label = `${verificationId} v${version.version}`;

    const stored = await payload.count({
      collection: 'passport-files',
      where: { verificationId: { equals: verificationId } },
      overrideAccess: true,
    });
    if (version.verifyBaseUrl && stored.totalDocs > 0) {
      console.log(`skip    ${label} already recorded (${version.verifyBaseUrl})`);
      continue;
    }

    // A recorded origin is authoritative; otherwise try each candidate and accept only an exact hash match.
    const candidates: (string | null)[] = version.verifyBaseUrl
      ? [version.verifyBaseUrl]
      : [...origins, ...(includeNoQr ? [null] : [])];
    let match: { origin: string | null; pdf: Buffer } | null = null;
    for (const origin of candidates) {
      const pdf = await renderStoredVersionPdf(version, origin);
      if (sha256Hex(pdf).toLowerCase() === documentHash.toLowerCase()) {
        match = { origin, pdf };
        break;
      }
    }

    if (!match) {
      unmatched.push(label);
      console.log(`no match ${label}: stored hash ${documentHash} matches no candidate origin`);
      continue;
    }

    console.log(`match   ${label} -> ${match.origin ?? 'no QR (issued without an origin)'}`);
    if (!apply) continue;

    if (match.origin && version.verifyBaseUrl !== match.origin) {
      await payload.update({
        collection: 'passport-versions',
        id,
        data: { verifyBaseUrl: match.origin },
        overrideAccess: true,
      });
    }
    await storePassportPdf(payload, verificationId, match.pdf, documentHash);
    repaired += 1;
  }

  if (apply) {
    console.log(`\nRepaired ${repaired} version(s).`);
  } else {
    console.log('\nNothing was written. Re-run with --apply to record origins and store PDFs.');
  }
  if (unmatched.length) {
    console.error(`Unmatched (left untouched): ${unmatched.join(', ')}`);
    process.exitCode = 1;
  }
} finally {
  await payload.destroy();
}
