import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_passport_versions_issuance_status" AS ENUM('PREPARED', 'FAILED', 'ISSUED');
  ALTER TABLE "verified_skills" ADD COLUMN "processing_started_at" timestamp(3) with time zone;
  ALTER TABLE "passport_versions" ADD COLUMN "source_record_id" varchar;
  UPDATE "passport_versions" SET "source_record_id" = 'LEGACY-PV-' || "id"::text WHERE "source_record_id" IS NULL;
  ALTER TABLE "passport_versions" ALTER COLUMN "source_record_id" SET NOT NULL;
  ALTER TABLE "passport_versions" ADD COLUMN "issuance_status" "public"."enum_passport_versions_issuance_status" DEFAULT 'ISSUED' NOT NULL;
  ALTER TABLE "passport_versions" ALTER COLUMN "issuance_status" DROP DEFAULT;
  CREATE UNIQUE INDEX "passport_versions_source_record_id_idx" ON "passport_versions" USING btree ("source_record_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX "passport_versions_source_record_id_idx";
  ALTER TABLE "verified_skills" DROP COLUMN "processing_started_at";
  ALTER TABLE "passport_versions" DROP COLUMN "source_record_id";
  ALTER TABLE "passport_versions" DROP COLUMN "issuance_status";
  DROP TYPE "public"."enum_passport_versions_issuance_status";`)
}
