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
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
  },
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
    },
  }),
  sharp,
  plugins: [],
});
