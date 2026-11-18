import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "integration_logs" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_integration_logs_fk";
  DROP INDEX "payload_locked_documents_rels_integration_logs_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "integration_logs_id";
  DROP TABLE "integration_logs";
  DROP TYPE "public"."enum_integration_logs_source";
  DROP TYPE "public"."enum_integration_logs_stage";
  DROP TYPE "public"."enum_integration_logs_outcome";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_integration_logs_source" AS ENUM('GOOGLE_SHEETS');
  CREATE TYPE "public"."enum_integration_logs_stage" AS ENUM('AUTHENTICATION', 'VALIDATION', 'LOOKUP', 'INGESTION');
  CREATE TYPE "public"."enum_integration_logs_outcome" AS ENUM('ACCEPTED', 'DUPLICATE', 'SKIPPED', 'REJECTED', 'FAILED');
  CREATE TABLE "integration_logs" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"request_id" varchar NOT NULL,
  	"source" "enum_integration_logs_source" NOT NULL,
  	"record_id" varchar,
  	"stage" "enum_integration_logs_stage" NOT NULL,
  	"outcome" "enum_integration_logs_outcome" NOT NULL,
  	"message" varchar NOT NULL,
  	"logged_at" timestamp(3) with time zone NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "integration_logs_id" integer;
  CREATE UNIQUE INDEX "integration_logs_request_id_idx" ON "integration_logs" USING btree ("request_id");
  CREATE INDEX "integration_logs_record_id_idx" ON "integration_logs" USING btree ("record_id");
  CREATE INDEX "integration_logs_updated_at_idx" ON "integration_logs" USING btree ("updated_at");
  CREATE INDEX "integration_logs_created_at_idx" ON "integration_logs" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_integration_logs_fk" FOREIGN KEY ("integration_logs_id") REFERENCES "public"."integration_logs"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_integration_logs_id_idx" ON "payload_locked_documents_rels" USING btree ("integration_logs_id");`)
}
