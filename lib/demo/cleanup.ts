import type { Payload } from 'payload';
import type { PassportVersion } from '../../payload-types';
import { deletePassportPdf } from '../passportStorage';
import { VISITOR_RECORD_PREFIX } from './config';

export interface CleanupResult {
  /** True when nothing was removed because the oldest visitor record is still within its allowed age. */
  skipped: boolean;
  verifiedSkills: number;
  versions: number;
  passports: number;
}

export interface CleanupOptions {
  /** Only clean up when the oldest visitor record is at least this old. Omit to clean up immediately. */
  olderThanMs?: number;
  now?: () => number;
}

const isVisitorRecord = (recordId: string | null | undefined) => recordId?.startsWith(VISITOR_RECORD_PREFIX) === true;

async function removeVersion(payload: Payload, version: PassportVersion): Promise<void> {
  await payload.delete({ collection: 'ledger-entries', where: { verificationId: { equals: version.verificationId } }, overrideAccess: true });
  await payload.delete({ collection: 'passport-versions', where: { id: { equals: version.id } }, overrideAccess: true });
  await deletePassportPdf(version.verificationId).catch((error: unknown) => {
    console.error(`Could not remove stored PDF for ${version.verificationId}`, error);
  });
}

/**
 * Removes visitor-issued credentials and puts each affected passport back to its last seeded state.
 * Safe to run concurrently with itself: every delete is keyed by a where clause and is idempotent.
 */
export async function cleanupVisitorData(payload: Payload, options: CleanupOptions = {}): Promise<CleanupResult> {
  const now = options.now ?? Date.now;
  const result: CleanupResult = { skipped: false, verifiedSkills: 0, versions: 0, passports: 0 };

  const found = await payload.find({
    collection: 'verified-skills',
    where: { recordId: { like: VISITOR_RECORD_PREFIX } },
    sort: 'createdAt',
    limit: 1000,
    depth: 0,
    overrideAccess: true,
  });
  const visitorSkills = found.docs.filter((doc) => isVisitorRecord(doc.recordId));
  if (visitorSkills.length === 0) return result;

  if (options.olderThanMs !== undefined) {
    const oldest = new Date(visitorSkills[0].createdAt).getTime();
    if (Number.isFinite(oldest) && now() - oldest < options.olderThanMs) return { ...result, skipped: true };
  }

  const triggered = await payload.find({
    collection: 'passport-versions',
    where: { sourceRecordId: { like: VISITOR_RECORD_PREFIX } },
    limit: 1000,
    depth: 0,
    overrideAccess: true,
  });
  const passportIds = new Set(
    triggered.docs
      .filter((version) => isVisitorRecord(version.sourceRecordId))
      .map((version) => (typeof version.passport === 'object' ? version.passport.id : version.passport)),
  );

  const retainedRecordIds = new Set<string>();

  for (const passportId of passportIds) {
    const history = await payload.find({
      collection: 'passport-versions',
      where: { passport: { equals: passportId } },
      sort: '-version',
      limit: 1000,
      depth: 0,
      overrideAccess: true,
    });

    // Only the visitor-issued tail is removed; a later non-visitor version depends on everything before it.
    const removable: PassportVersion[] = [];
    for (const version of history.docs) {
      if (!isVisitorRecord(version.sourceRecordId)) break;
      removable.push(version);
    }
    for (const version of history.docs.slice(removable.length)) {
      if (isVisitorRecord(version.sourceRecordId)) retainedRecordIds.add(version.sourceRecordId);
    }
    if (removable.length === 0) continue;

    const survivors = history.docs.slice(removable.length);
    const newLatest = survivors.find((version) => version.issuanceStatus === 'ISSUED') ?? null;

    // The passport and ledger must stop pointing at removed versions before those versions are deleted.
    await payload.update({
      collection: 'passports',
      id: passportId,
      data: { latestVersion: newLatest ? newLatest.id : null },
      overrideAccess: true,
    });
    if (newLatest) {
      await payload.update({
        collection: 'ledger-entries',
        where: { verificationId: { equals: newLatest.verificationId } },
        data: { isLatest: true },
        overrideAccess: true,
      });
    }

    for (const version of removable) {
      await removeVersion(payload, version);
      result.versions += 1;
    }

    if (survivors.length === 0) {
      await payload.delete({ collection: 'passports', where: { id: { equals: passportId } }, overrideAccess: true });
      result.passports += 1;
    }
  }

  for (const skill of visitorSkills) {
    if (retainedRecordIds.has(skill.recordId)) continue;
    await payload.delete({ collection: 'verified-skills', where: { id: { equals: skill.id } }, overrideAccess: true });
    result.verifiedSkills += 1;
  }

  return result;
}

/** Cleanup that never throws, for opportunistic calls on request paths. */
export async function tryCleanupVisitorData(payload: Payload, olderThanMs: number): Promise<void> {
  try {
    await cleanupVisitorData(payload, { olderThanMs });
  } catch (error) {
    console.error('Demo cleanup failed', error);
  }
}
