import { postgresAdapter } from "@payloadcms/db-postgres";
import { lexicalEditor } from "@payloadcms/richtext-lexical";
import path from "path";
import { buildConfig } from "payload";
import { fileURLToPath } from "url";
import sharp from "sharp";

import { Users } from "./collections/Users";
import { Media } from "./collections/Media";
import { Students } from "./collections/Students";
import { Skills } from "./collections/Skills";
import { VerifiedSkills } from "./collections/VerifiedSkills";
import { Passports } from "./collections/Passports";
import { PassportVersions } from "./collections/PassportVersions";
import { LedgerEntries } from "./collections/LedgerEntries";
import { getAppEnv, getCoreEnv } from "./lib/env";

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);

const env = { ...getAppEnv(), ...getCoreEnv() };

export default buildConfig({
  serverURL: env.appUrl,
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
  },
  cors: env.trustedOrigins,
  csrf: env.trustedOrigins,
  collections: [
    Users,
    Media,
    Students,
    Skills,
    VerifiedSkills,
    Passports,
    PassportVersions,
    LedgerEntries,
  ],
  editor: lexicalEditor(),
  secret: env.payloadSecret,
  typescript: {
    outputFile: path.resolve(dirname, "payload-types.ts"),
  },
  db: postgresAdapter({
    push: false,
    pool: {
      connectionString: env.databaseUrl,
      max: 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 15_000,
      keepAlive: true,
    },
  }),
  sharp,
  plugins: [],
})