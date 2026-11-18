import type { Payload } from 'payload';
import { getLedgerEnv } from '../env';
import { AmoyLedger } from './amoyLedger';
import { createDemoSigner, DemoLedger } from './demoLedger';
import { PayloadLedgerStore } from './payloadStore';
import type { LedgerProvider } from './types';

export * from './types';

/** Returns the ledger selected by LEDGER_MODE (defaults to the Postgres-backed demo ledger). */
export function getLedger(payload: Payload): LedgerProvider {
  const env = getLedgerEnv();
  if (env.mode === 'amoy') return new AmoyLedger(env);

  return new DemoLedger({
    store: new PayloadLedgerStore(payload),
    signer: createDemoSigner({ signingKey: env.signingKey, payloadSecret: env.payloadSecret }),
  });
}
