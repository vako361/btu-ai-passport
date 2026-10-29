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
import { IntegrationLogs } from "./collections/IntegrationLogs";

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);

function getDatabaseConnectionString() {
  // ამოწმებს ცვლადის სამივე შესაძლო სახელს
  const connectionString =
    process.env.DATABASE_URL ||
    process.env.DATABASE_URI ||
    process.env.POSTGRES_URL;

  if (!connectionString) {
    console.error("❌ ERROR: No database connection string found in environment variables!");
    return "";
  }

  return connectionString;
}

const appUrl =
  process.env.PAYLOAD_PUBLIC_SERVER_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  "https://btu-ai-passport-gamma.vercel.app";

export default buildConfig({
  serverURL: appUrl,
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
  },
  cors: [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://btu-ai-passport-gamma.vercel.app",
    "https://*.vercel.app",
    "https://*.ngrok-free.dev",
    "https://*.lhr.life",
  ],
  csrf: [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://btu-ai-passport-gamma.vercel.app",
    "https://*.vercel.app",
    "https://*.ngrok-free.dev",
    "https://*.lhr.life",
  ],
  collections: [
    Users,
    Media,
    Students,
    Skills,
    VerifiedSkills,
    Passports,
    PassportVersions,
    IntegrationLogs,
  ],
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || (process.env.NODE_ENV === "production" ? "" : "dev-only-payload-secret"),
  typescript: {
    outputFile: path.resolve(dirname, "payload-types.ts"),
  },
  db: postgresAdapter({
    push: false,
    pool: {
      connectionString: getDatabaseConnectionString(),
      max: 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 15_000,
      keepAlive: true,
    },
  }),
  sharp,
  plugins: [],
})