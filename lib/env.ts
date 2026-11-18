import { z } from 'zod';

type RawEnv = Record<string, string | undefined>;

export class EnvConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EnvConfigError';
  }
}

const HEX_32_BYTES = /^[0-9a-fA-F]{64}$/;
const EVM_ADDRESS = /^0x[0-9a-fA-F]{40}$/;

// Accepts keys with or without the 0x prefix and always yields the prefixed form.
const privateKey = z
  .string()
  .regex(/^(0x)?[0-9a-fA-F]{64}$/, 'must be a 32-byte hex key')
  .transform((value) => (value.startsWith('0x') ? value : `0x${value}`));

// Empty `KEY=` lines in .env files are treated as unset.
function cleanEnv(source: RawEnv): RawEnv {
  const cleaned: RawEnv = {};
  for (const [key, value] of Object.entries(source)) {
    const trimmed = value?.trim();
    if (trimmed) cleaned[key] = trimmed;
  }
  return cleaned;
}

// Each section is validated when used so an unrelated missing variable never breaks a feature.
// Parsing is cheap and uncached so tests and scripts can change process.env between calls.
function section<Schema extends z.ZodTypeAny>(name: string, schema: Schema): () => z.output<Schema> {
  return () => {
    const result = schema.safeParse(cleanEnv(process.env));
    if (!result.success) {
      const issues = result.error.issues
        .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
        .join('\n');
      throw new EnvConfigError(`Invalid ${name} environment configuration:\n${issues}`);
    }
    return result.data;
  };
}

const flag = z.enum(['true', 'false']).default('false').transform((value) => value === 'true');

function originOf(value: string): string {
  return new URL(value).origin;
}

function splitList(value: string | undefined): string[] {
  return (value ?? '').split(',').map((item) => item.trim()).filter(Boolean);
}

const appSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    NEXT_PUBLIC_APP_URL: z.string().url().optional(),
    // Legacy name for NEXT_PUBLIC_APP_URL.
    PUBLIC_BASE_URL: z.string().url().optional(),
    EXTRA_ALLOWED_ORIGINS: z.string().optional(),
    VERCEL_ENV: z.string().optional(),
    VERCEL_PROJECT_PRODUCTION_URL: z.string().optional(),
    VERCEL_URL: z.string().optional(),
  })
  .transform((raw) => {
    const vercelHost = raw.VERCEL_ENV === 'production'
      ? raw.VERCEL_PROJECT_PRODUCTION_URL ?? raw.VERCEL_URL
      : raw.VERCEL_URL;
    const appUrl = originOf(
      raw.NEXT_PUBLIC_APP_URL ?? raw.PUBLIC_BASE_URL ?? (vercelHost ? `https://${vercelHost}` : 'http://localhost:3000'),
    );

    const isProduction = raw.NODE_ENV === 'production';
    const trustedOrigins = new Set<string>([appUrl]);
    if (raw.VERCEL_URL) trustedOrigins.add(`https://${raw.VERCEL_URL}`);
    if (!isProduction) {
      trustedOrigins.add('http://localhost:3000');
      trustedOrigins.add('http://127.0.0.1:3000');
    }
    for (const origin of splitList(raw.EXTRA_ALLOWED_ORIGINS)) trustedOrigins.add(originOf(origin));

    return { isProduction, appUrl, trustedOrigins: [...trustedOrigins] };
  });

const coreSchema = z
  .object({
    DATABASE_URL: z.string().optional(),
    // Accepted because Neon's Vercel integration and older deployments use these names.
    DATABASE_URI: z.string().optional(),
    POSTGRES_URL: z.string().optional(),
    PAYLOAD_SECRET: z.string().min(16, 'must be at least 16 characters (32+ recommended: `openssl rand -hex 32`)'),
  })
  .transform((raw, ctx) => {
    const databaseUrl = raw.DATABASE_URL ?? raw.DATABASE_URI ?? raw.POSTGRES_URL;
    if (!databaseUrl) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['DATABASE_URL'], message: 'is required' });
      return z.NEVER;
    }
    return { databaseUrl, payloadSecret: raw.PAYLOAD_SECRET };
  });

const storageSchema = z
  .object({
    PASSPORT_STORAGE_KEY: z.string().regex(HEX_32_BYTES, 'must be a 32-byte hex key (`openssl rand -hex 32`)'),
    PASSPORT_STORAGE_DIR: z.string().optional(),
    VERCEL: z.string().optional(),
  })
  .transform((raw) => ({
    encryptionKey: Buffer.from(raw.PASSPORT_STORAGE_KEY, 'hex'),
    directory: raw.PASSPORT_STORAGE_DIR,
    isVercel: Boolean(raw.VERCEL),
  }));

export type LedgerMode = 'demo' | 'amoy';

export type LedgerEnv =
  | { mode: 'demo'; signingKey: string | undefined; payloadSecret: string }
  | {
      mode: 'amoy';
      rpcUrl: string;
      contractAddress: string;
      issuerPrivateKey: string | undefined;
      expectedIssuerAddress: string | undefined;
    };

const ledgerSchema = z
  .object({
    LEDGER_MODE: z.enum(['demo', 'amoy']).default('demo'),
    LEDGER_SIGNING_KEY: privateKey.optional(),
    PAYLOAD_SECRET: z.string().optional(),
    BLOCKCHAIN_RPC_URL: z.string().url().optional(),
    ISSUER_PRIVATE_KEY: privateKey.optional(),
    NEXT_PUBLIC_CONTRACT_ADDRESS: z.string().regex(EVM_ADDRESS, 'must be a 0x-prefixed address').optional(),
    BTU_ISSUER_ADDRESS: z.string().regex(EVM_ADDRESS, 'must be a 0x-prefixed address').optional(),
  })
  .transform((raw, ctx): LedgerEnv => {
    if (raw.LEDGER_MODE === 'demo') {
      if (!raw.LEDGER_SIGNING_KEY && !raw.PAYLOAD_SECRET) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['LEDGER_SIGNING_KEY'], message: 'or PAYLOAD_SECRET is required in demo mode' });
        return z.NEVER;
      }
      return { mode: 'demo', signingKey: raw.LEDGER_SIGNING_KEY, payloadSecret: raw.PAYLOAD_SECRET ?? '' };
    }

    for (const [key, value] of [
      ['BLOCKCHAIN_RPC_URL', raw.BLOCKCHAIN_RPC_URL],
      ['NEXT_PUBLIC_CONTRACT_ADDRESS', raw.NEXT_PUBLIC_CONTRACT_ADDRESS],
    ] as const) {
      if (!value) ctx.addIssue({ code: z.ZodIssueCode.custom, path: [key], message: 'is required when LEDGER_MODE=amoy' });
    }
    if (!raw.BLOCKCHAIN_RPC_URL || !raw.NEXT_PUBLIC_CONTRACT_ADDRESS) return z.NEVER;

    return {
      mode: 'amoy',
      rpcUrl: raw.BLOCKCHAIN_RPC_URL,
      contractAddress: raw.NEXT_PUBLIC_CONTRACT_ADDRESS,
      issuerPrivateKey: raw.ISSUER_PRIVATE_KEY,
      expectedIssuerAddress: raw.BTU_ISSUER_ADDRESS,
    };
  });

export interface DemoCredentials {
  email: string;
  password: string;
}

export type DemoEnv =
  | { enabled: false }
  | {
      enabled: true;
      admin: DemoCredentials;
      student: DemoCredentials;
      resetAfterMs: number;
      cronSecret: string | undefined;
    };

const demoSchema = z
  .object({
    DEMO_MODE: flag,
    DEMO_ADMIN_EMAIL: z.string().email().default('demo.admin@example.com'),
    DEMO_ADMIN_PASSWORD: z.string().min(12, 'must be at least 12 characters').optional(),
    DEMO_STUDENT_EMAIL: z.string().email().default('demo.student@example.com'),
    DEMO_STUDENT_PASSWORD: z.string().min(12, 'must be at least 12 characters').optional(),
    DEMO_RESET_AFTER_MINUTES: z.coerce.number().int().min(1).max(1440).default(60),
    CRON_SECRET: z.string().min(16, 'must be at least 16 characters').optional(),
  })
  .transform((raw, ctx): DemoEnv => {
    if (!raw.DEMO_MODE) return { enabled: false };

    if (!raw.DEMO_ADMIN_PASSWORD) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['DEMO_ADMIN_PASSWORD'], message: 'is required when DEMO_MODE=true' });
    }
    if (!raw.DEMO_STUDENT_PASSWORD) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['DEMO_STUDENT_PASSWORD'], message: 'is required when DEMO_MODE=true' });
    }
    if (!raw.DEMO_ADMIN_PASSWORD || !raw.DEMO_STUDENT_PASSWORD) return z.NEVER;

    return {
      enabled: true,
      admin: { email: raw.DEMO_ADMIN_EMAIL.toLowerCase(), password: raw.DEMO_ADMIN_PASSWORD },
      student: { email: raw.DEMO_STUDENT_EMAIL.toLowerCase(), password: raw.DEMO_STUDENT_PASSWORD },
      resetAfterMs: raw.DEMO_RESET_AFTER_MINUTES * 60_000,
      cronSecret: raw.CRON_SECRET,
    };
  });

const adminBootstrapSchema = z.object({
  PAYLOAD_ADMIN_EMAIL: z.string().email(),
  PAYLOAD_ADMIN_PASSWORD: z.string().min(12, 'must be at least 12 characters'),
});

export const getAppEnv = section('app', appSchema);
export const getCoreEnv = section('core', coreSchema);
export const getStorageEnv = section('passport storage', storageSchema);
export const getLedgerEnv = section('ledger', ledgerSchema);
export const getDemoEnv = section('demo mode', demoSchema);
export const getAdminBootstrapEnv = section('admin bootstrap', adminBootstrapSchema);
