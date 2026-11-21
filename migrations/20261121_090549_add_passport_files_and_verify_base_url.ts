import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "passport_files" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"verification_id" varchar NOT NULL,
  	"document_hash" varchar NOT NULL,
  	"encrypted_pdf" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "passport_versions" ADD COLUMN "verify_base_url" varchar;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "passport_files_id" integer;
  CREATE UNIQUE INDEX "passport_files_verification_id_idx" ON "passport_files" USING btree ("verification_id");
  CREATE INDEX "passport_files_updated_at_idx" ON "passport_files" USING btree ("updated_at");
  CREATE INDEX "passport_files_created_at_idx" ON "passport_files" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_passport_files_fk" FOREIGN KEY ("passport_files_id") REFERENCES "public"."passport_files"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_passport_files_id_idx" ON "payload_locked_documents_rels" USING btree ("passport_files_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "passport_files" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "passport_files" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_passport_files_fk";
  
  DROP INDEX "payload_locked_documents_rels_passport_files_id_idx";
  ALTER TABLE "passport_versions" DROP COLUMN "verify_base_url";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "passport_files_id";`)
}
