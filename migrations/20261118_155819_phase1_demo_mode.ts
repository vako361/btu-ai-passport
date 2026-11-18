import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Phase 1 (demo mode): role-based users, the demo ledger table, and the pending Passports schema changes.
 *
 * Written to be safe on a database that already has some of these objects (for example one synced with
 * schema push during development): every statement is guarded, so re-running it is a no-op.
 */
export async function up({ db, payload }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  DO $$ BEGIN
    CREATE TYPE "public"."enum_users_role" AS ENUM('admin', 'student');
  EXCEPTION WHEN duplicate_object THEN NULL;
  END $$;

  CREATE TABLE IF NOT EXISTS "passports_acquired_skills" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"skill_id" varchar NOT NULL,
  	"skill_name" varchar NOT NULL,
  	"date_earned" timestamp(3) with time zone NOT NULL
  );

  CREATE TABLE IF NOT EXISTS "ledger_entries" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"verification_id" varchar NOT NULL,
  	"passport_id" varchar NOT NULL,
  	"document_hash" varchar NOT NULL,
  	"version" numeric NOT NULL,
  	"previous_verification_id" varchar,
  	"previous_entry_hash" varchar NOT NULL,
  	"registered_at" timestamp(3) with time zone NOT NULL,
  	"entry_hash" varchar NOT NULL,
  	"signature" varchar NOT NULL,
  	"issuer_address" varchar NOT NULL,
  	"is_latest" boolean DEFAULT true,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  -- Databases still on the earlier schema store the student relation in passports.student_id (integer).
  -- Move it to student_record_id and replace it with the student's business ID before changing the type.
  DO $$ BEGIN
    IF (SELECT data_type FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'passports' AND column_name = 'student_id') = 'integer' THEN
      ALTER TABLE "passports" ADD COLUMN IF NOT EXISTS "student_record_id" integer;
      UPDATE "passports" SET "student_record_id" = "student_id" WHERE "student_record_id" IS NULL;
      ALTER TABLE "passports" DROP CONSTRAINT IF EXISTS "passports_student_id_students_id_fk";
      DROP INDEX IF EXISTS "passports_student_idx";
      ALTER TABLE "passports" ALTER COLUMN "student_id" SET DATA TYPE varchar USING "student_id"::varchar;
      UPDATE "passports" AS p SET "student_id" = s."student_id" FROM "students" AS s WHERE s."id" = p."student_record_id";
    END IF;
  END $$;
  ALTER TABLE "passports" DROP CONSTRAINT IF EXISTS "passports_student_id_students_id_fk";
  DROP INDEX IF EXISTS "passports_student_idx";
  ALTER TABLE "passports" ALTER COLUMN "passport_id" DROP NOT NULL;
  ALTER TABLE "passports" ALTER COLUMN "first_issued_at" DROP NOT NULL;

  ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "role" "enum_users_role" DEFAULT 'student' NOT NULL;
  ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "student_id" integer;
  ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "is_demo" boolean DEFAULT false;
  ALTER TABLE "passports" ADD COLUMN IF NOT EXISTS "email" varchar;
  ALTER TABLE "passports" ADD COLUMN IF NOT EXISTS "student_record_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "ledger_entries_id" integer;

  DO $$ BEGIN
    ALTER TABLE "passports_acquired_skills" ADD CONSTRAINT "passports_acquired_skills_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."passports"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END $$;
  DO $$ BEGIN
    ALTER TABLE "users" ADD CONSTRAINT "users_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END $$;
  DO $$ BEGIN
    ALTER TABLE "passports" ADD CONSTRAINT "passports_student_record_id_students_id_fk" FOREIGN KEY ("student_record_id") REFERENCES "public"."students"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END $$;
  DO $$ BEGIN
    ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_ledger_entries_fk" FOREIGN KEY ("ledger_entries_id") REFERENCES "public"."ledger_entries"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END $$;

  CREATE INDEX IF NOT EXISTS "passports_acquired_skills_order_idx" ON "passports_acquired_skills" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "passports_acquired_skills_parent_id_idx" ON "passports_acquired_skills" USING btree ("_parent_id");
  CREATE UNIQUE INDEX IF NOT EXISTS "ledger_entries_verification_id_idx" ON "ledger_entries" USING btree ("verification_id");
  CREATE INDEX IF NOT EXISTS "ledger_entries_passport_id_idx" ON "ledger_entries" USING btree ("passport_id");
  CREATE UNIQUE INDEX IF NOT EXISTS "ledger_entries_entry_hash_idx" ON "ledger_entries" USING btree ("entry_hash");
  CREATE INDEX IF NOT EXISTS "ledger_entries_updated_at_idx" ON "ledger_entries" USING btree ("updated_at");
  CREATE INDEX IF NOT EXISTS "ledger_entries_created_at_idx" ON "ledger_entries" USING btree ("created_at");
  CREATE UNIQUE INDEX IF NOT EXISTS "passportId_version_idx" ON "ledger_entries" USING btree ("passport_id","version");
  CREATE INDEX IF NOT EXISTS "users_student_idx" ON "users" USING btree ("student_id");
  CREATE UNIQUE INDEX IF NOT EXISTS "passports_student_id_idx" ON "passports" USING btree ("student_id");
  CREATE UNIQUE INDEX IF NOT EXISTS "passports_student_record_idx" ON "passports" USING btree ("student_record_id");
  CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_ledger_entries_id_idx" ON "payload_locked_documents_rels" USING btree ("ledger_entries_id");`)

  // Existing accounts default to the student role, so the configured administrator must be promoted
  // here or they would lose access to the admin panel.
  const adminEmail = process.env.PAYLOAD_ADMIN_EMAIL?.trim().toLowerCase()
  if (adminEmail) {
    await db.execute(sql`UPDATE "users" SET "role" = 'admin' WHERE lower("email") = ${adminEmail}`)
  } else {
    payload.logger.warn(
      'PAYLOAD_ADMIN_EMAIL is not set, so no existing user was promoted to administrator. ' +
        'Run `npm run bootstrap:admin` afterwards to restore admin access.',
    )
  }
}

/**
 * Reverts the Phase 1 additions only. The Passports reconciliation in `up` is deliberately not reversed:
 * converting those columns back could fail or lose data once real values exist.
 */
export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_ledger_entries_fk";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_ledger_entries_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "ledger_entries_id";
  DROP TABLE IF EXISTS "ledger_entries" CASCADE;
  ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_student_id_students_id_fk";
  DROP INDEX IF EXISTS "users_student_idx";
  ALTER TABLE "users" DROP COLUMN IF EXISTS "role";
  ALTER TABLE "users" DROP COLUMN IF EXISTS "student_id";
  ALTER TABLE "users" DROP COLUMN IF EXISTS "is_demo";
  DROP TYPE IF EXISTS "public"."enum_users_role";`)
}
