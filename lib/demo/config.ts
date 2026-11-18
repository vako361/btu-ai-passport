import { getDemoEnv, type DemoEnv } from '../env';

export type DemoEnabled = Extract<DemoEnv, { enabled: true }>;

/** Prefixes that let cleanup tell visitor-created records from seeded ones. */
export const VISITOR_RECORD_PREFIX = 'LIVE-';
export const SEED_RECORD_PREFIX = 'SEED-';

/** For UI decisions: a misconfigured demo is reported in the logs and treated as disabled. */
export function isDemoEnabled(): boolean {
  try {
    return getDemoEnv().enabled;
  } catch (error) {
    console.error('Demo mode is misconfigured and has been disabled.', error);
    return false;
  }
}
