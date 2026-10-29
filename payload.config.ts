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
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) return "";

  try {
    const databaseUrl = new URL(connectionString);
    const sslMode = databaseUrl.searchParams.get("sslmode")?.toLowerCase();
    if (sslMode && ["prefer", "require", "verify-ca"].includes(sslMode)) {
      databaseUrl.searchParams.set("sslmode", "verify-full");
    }
    return databaseUrl.toString();
  } catch {
    return connectionString;
  }
}

export default buildConfig({
  // ⚠️ serverURL უზრუნველყოფს ადმინ პანელის რესურსების სწორად ჩატვირთვას IP/დომენიდან
  serverURL: process.env.PAYLOAD_PUBLIC_SERVER_URL || 'http://192.168.100.5:3000',
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
  },
  // ⚠️ CORS და CSRF კონფიგურაცია გარე ბრაუზერებისა და IP/ტუნელებისთვის
  cors: [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://192.168.100.199:3000',
    'http://192.168.100.5:3000',
    'https://*.ngrok-free.dev',
    'https://*.lhr.life',
  ],
  csrf: [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://192.168.100.199:3000',
    'http://192.168.100.5:3000',
    'https://*.ngrok-free.dev',
    'https://*.lhr.life',
  ],
  collections: [Users, Media, Students, Skills, VerifiedSkills, Passports, PassportVersions, IntegrationLogs],
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || "",
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
});