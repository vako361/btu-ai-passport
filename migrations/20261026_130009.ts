import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_verified_skills_status" AS ENUM('CONFIRMED', 'PENDING', 'REJECTED');
  CREATE TYPE "public"."enum_verified_skills_processing_status" AS ENUM('QUEUED', 'SKIPPED', 'PROCESSING', 'PROCESSED', 'FAILED');
  CREATE TYPE "public"."enum_integration_logs_source" AS ENUM('GOOGLE_SHEETS');
  CREATE TYPE "public"."enum_integration_logs_stage" AS ENUM('AUTHENTICATION', 'VALIDATION', 'LOOKUP', 'INGESTION');
  CREATE TYPE "public"."enum_integration_logs_outcome" AS ENUM('ACCEPTED', 'DUPLICATE', 'SKIPPED', 'REJECTED', 'FAILED');
  CREATE TABLE "users_sessions" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"created_at" timestamp(3) with time zone,
  	"expires_at" timestamp(3) with time zone NOT NULL
  );
  
  CREATE TABLE "users" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"email" varchar NOT NULL,
  	"reset_password_token" varchar,
  	"reset_password_expiration" timestamp(3) with time zone,
  	"salt" varchar,
  	"hash" varchar,
  	"reset_password_requested_at" timestamp(3) with time zone,
  	"login_attempts" numeric DEFAULT 0,
  	"lock_until" timestamp(3) with time zone
  );
  
  CREATE TABLE "media" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"alt" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"url" varchar,
  	"thumbnail_u_r_l" varchar,
  	"filename" varchar,
  	"mime_type" varchar,
  	"filesize" numeric,
  	"width" numeric,
  	"height" numeric,
  	"focal_x" numeric,
  	"focal_y" numeric
  );
  
  CREATE TABLE "students" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"student_id" varchar NOT NULL,
  	"first_name" varchar NOT NULL,
  	"last_name" varchar NOT NULL,
  	"email" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "skills" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"skill_code" varchar NOT NULL,
  	"name" varchar NOT NULL,
  	"category" varchar,
  	"description" varchar,
  	"badge_id" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "verified_skills" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"record_id" varchar NOT NULL,
  	"student_id" integer NOT NULL,
  	"skill_id" integer NOT NULL,
  	"earned_at" timestamp(3) with time zone NOT NULL,
  	"status" "enum_verified_skills_status" DEFAULT 'PENDING' NOT NULL,
  	"processing_status" "enum_verified_skills_processing_status" NOT NULL,
  	"processing_error" varchar,
  	"processed_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "passports" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"passport_id" varchar NOT NULL,
  	"student_id" integer NOT NULL,
  	"first_name" varchar NOT NULL,
  	"last_name" varchar NOT NULL,
  	"first_issued_at" timestamp(3) with time zone NOT NULL,
  	"latest_version_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "passport_versions_skills_snapshot" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"record_id" varchar NOT NULL,
  	"skill_code" varchar NOT NULL,
  	"skill_name" varchar NOT NULL,
  	"badge_id" varchar NOT NULL,
  	"earned_at" timestamp(3) with time zone NOT NULL,
  	"description" varchar
  );
  
  CREATE TABLE "passport_versions" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"passport_id" integer NOT NULL,
  	"version" numeric NOT NULL,
  	"verification_id" varchar NOT NULL,
  	"document_hash" varchar NOT NULL,
  	"issuer_address" varchar NOT NULL,
  	"transaction_hash" varchar,
  	"issued_at" timestamp(3) with time zone NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
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
  
  CREATE TABLE "payload_kv" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar NOT NULL,
  	"data" jsonb NOT NULL
  );
  
  CREATE TABLE "payload_locked_documents" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"global_slug" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_locked_documents_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer,
  	"media_id" integer,
  	"students_id" integer,
  	"skills_id" integer,
  	"verified_skills_id" integer,
  	"passports_id" integer,
  	"passport_versions_id" integer,
  	"integration_logs_id" integer
  );
  
  CREATE TABLE "payload_preferences" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar,
  	"value" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_preferences_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer
  );
  
  CREATE TABLE "payload_migrations" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"batch" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "users_sessions" ADD CONSTRAINT "users_sessions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "verified_skills" ADD CONSTRAINT "verified_skills_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "verified_skills" ADD CONSTRAINT "verified_skills_skill_id_skills_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."skills"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "passports" ADD CONSTRAINT "passports_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "passports" ADD CONSTRAINT "passports_latest_version_id_passport_versions_id_fk" FOREIGN KEY ("latest_version_id") REFERENCES "public"."passport_versions"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "passport_versions_skills_snapshot" ADD CONSTRAINT "passport_versions_skills_snapshot_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."passport_versions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "passport_versions" ADD CONSTRAINT "passport_versions_passport_id_passports_id_fk" FOREIGN KEY ("passport_id") REFERENCES "public"."passports"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_locked_documents"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_students_fk" FOREIGN KEY ("students_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_skills_fk" FOREIGN KEY ("skills_id") REFERENCES "public"."skills"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_verified_skills_fk" FOREIGN KEY ("verified_skills_id") REFERENCES "public"."verified_skills"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_passports_fk" FOREIGN KEY ("passports_id") REFERENCES "public"."passports"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_passport_versions_fk" FOREIGN KEY ("passport_versions_id") REFERENCES "public"."passport_versions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_integration_logs_fk" FOREIGN KEY ("integration_logs_id") REFERENCES "public"."integration_logs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_preferences"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "users_sessions_order_idx" ON "users_sessions" USING btree ("_order");
  CREATE INDEX "users_sessions_parent_id_idx" ON "users_sessions" USING btree ("_parent_id");
  CREATE INDEX "users_updated_at_idx" ON "users" USING btree ("updated_at");
  CREATE INDEX "users_created_at_idx" ON "users" USING btree ("created_at");
  CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");
  CREATE INDEX "media_updated_at_idx" ON "media" USING btree ("updated_at");
  CREATE INDEX "media_created_at_idx" ON "media" USING btree ("created_at");
  CREATE UNIQUE INDEX "media_filename_idx" ON "media" USING btree ("filename");
  CREATE UNIQUE INDEX "students_student_id_idx" ON "students" USING btree ("student_id");
  CREATE UNIQUE INDEX "students_email_idx" ON "students" USING btree ("email");
  CREATE INDEX "students_updated_at_idx" ON "students" USING btree ("updated_at");
  CREATE INDEX "students_created_at_idx" ON "students" USING btree ("created_at");
  CREATE UNIQUE INDEX "skills_skill_code_idx" ON "skills" USING btree ("skill_code");
  CREATE INDEX "skills_updated_at_idx" ON "skills" USING btree ("updated_at");
  CREATE INDEX "skills_created_at_idx" ON "skills" USING btree ("created_at");
  CREATE UNIQUE INDEX "verified_skills_record_id_idx" ON "verified_skills" USING btree ("record_id");
  CREATE INDEX "verified_skills_student_idx" ON "verified_skills" USING btree ("student_id");
  CREATE INDEX "verified_skills_skill_idx" ON "verified_skills" USING btree ("skill_id");
  CREATE INDEX "verified_skills_updated_at_idx" ON "verified_skills" USING btree ("updated_at");
  CREATE INDEX "verified_skills_created_at_idx" ON "verified_skills" USING btree ("created_at");
  CREATE UNIQUE INDEX "passports_passport_id_idx" ON "passports" USING btree ("passport_id");
  CREATE UNIQUE INDEX "passports_student_idx" ON "passports" USING btree ("student_id");
  CREATE INDEX "passports_latest_version_idx" ON "passports" USING btree ("latest_version_id");
  CREATE INDEX "passports_updated_at_idx" ON "passports" USING btree ("updated_at");
  CREATE INDEX "passports_created_at_idx" ON "passports" USING btree ("created_at");
  CREATE INDEX "passport_versions_skills_snapshot_order_idx" ON "passport_versions_skills_snapshot" USING btree ("_order");
  CREATE INDEX "passport_versions_skills_snapshot_parent_id_idx" ON "passport_versions_skills_snapshot" USING btree ("_parent_id");
  CREATE INDEX "passport_versions_passport_idx" ON "passport_versions" USING btree ("passport_id");
  CREATE UNIQUE INDEX "passport_versions_verification_id_idx" ON "passport_versions" USING btree ("verification_id");
  CREATE INDEX "passport_versions_updated_at_idx" ON "passport_versions" USING btree ("updated_at");
  CREATE INDEX "passport_versions_created_at_idx" ON "passport_versions" USING btree ("created_at");
  CREATE UNIQUE INDEX "passport_version_idx" ON "passport_versions" USING btree ("passport_id","version");
  CREATE UNIQUE INDEX "integration_logs_request_id_idx" ON "integration_logs" USING btree ("request_id");
  CREATE INDEX "integration_logs_record_id_idx" ON "integration_logs" USING btree ("record_id");
  CREATE INDEX "integration_logs_updated_at_idx" ON "integration_logs" USING btree ("updated_at");
  CREATE INDEX "integration_logs_created_at_idx" ON "integration_logs" USING btree ("created_at");
  CREATE UNIQUE INDEX "payload_kv_key_idx" ON "payload_kv" USING btree ("key");
  CREATE INDEX "payload_locked_documents_global_slug_idx" ON "payload_locked_documents" USING btree ("global_slug");
  CREATE INDEX "payload_locked_documents_updated_at_idx" ON "payload_locked_documents" USING btree ("updated_at");
  CREATE INDEX "payload_locked_documents_created_at_idx" ON "payload_locked_documents" USING btree ("created_at");
  CREATE INDEX "payload_locked_documents_rels_order_idx" ON "payload_locked_documents_rels" USING btree ("order");
  CREATE INDEX "payload_locked_documents_rels_parent_idx" ON "payload_locked_documents_rels" USING btree ("parent_id");
  CREATE INDEX "payload_locked_documents_rels_path_idx" ON "payload_locked_documents_rels" USING btree ("path");
  CREATE INDEX "payload_locked_documents_rels_users_id_idx" ON "payload_locked_documents_rels" USING btree ("users_id");
  CREATE INDEX "payload_locked_documents_rels_media_id_idx" ON "payload_locked_documents_rels" USING btree ("media_id");
  CREATE INDEX "payload_locked_documents_rels_students_id_idx" ON "payload_locked_documents_rels" USING btree ("students_id");
  CREATE INDEX "payload_locked_documents_rels_skills_id_idx" ON "payload_locked_documents_rels" USING btree ("skills_id");
  CREATE INDEX "payload_locked_documents_rels_verified_skills_id_idx" ON "payload_locked_documents_rels" USING btree ("verified_skills_id");
  CREATE INDEX "payload_locked_documents_rels_passports_id_idx" ON "payload_locked_documents_rels" USING btree ("passports_id");
  CREATE INDEX "payload_locked_documents_rels_passport_versions_id_idx" ON "payload_locked_documents_rels" USING btree ("passport_versions_id");
  CREATE INDEX "payload_locked_documents_rels_integration_logs_id_idx" ON "payload_locked_documents_rels" USING btree ("integration_logs_id");
  CREATE INDEX "payload_preferences_key_idx" ON "payload_preferences" USING btree ("key");
  CREATE INDEX "payload_preferences_updated_at_idx" ON "payload_preferences" USING btree ("updated_at");
  CREATE INDEX "payload_preferences_created_at_idx" ON "payload_preferences" USING btree ("created_at");
  CREATE INDEX "payload_preferences_rels_order_idx" ON "payload_preferences_rels" USING btree ("order");
  CREATE INDEX "payload_preferences_rels_parent_idx" ON "payload_preferences_rels" USING btree ("parent_id");
  CREATE INDEX "payload_preferences_rels_path_idx" ON "payload_preferences_rels" USING btree ("path");
  CREATE INDEX "payload_preferences_rels_users_id_idx" ON "payload_preferences_rels" USING btree ("users_id");
  CREATE INDEX "payload_migrations_updated_at_idx" ON "payload_migrations" USING btree ("updated_at");
  CREATE INDEX "payload_migrations_created_at_idx" ON "payload_migrations" USING btree ("created_at");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "users_sessions" CASCADE;
  DROP TABLE "users" CASCADE;
  DROP TABLE "media" CASCADE;
  DROP TABLE "students" CASCADE;
  DROP TABLE "skills" CASCADE;
  DROP TABLE "verified_skills" CASCADE;
  DROP TABLE "passports" CASCADE;
  DROP TABLE "passport_versions_skills_snapshot" CASCADE;
  DROP TABLE "passport_versions" CASCADE;
  DROP TABLE "integration_logs" CASCADE;
  DROP TABLE "payload_kv" CASCADE;
  DROP TABLE "payload_locked_documents" CASCADE;
  DROP TABLE "payload_locked_documents_rels" CASCADE;
  DROP TABLE "payload_preferences" CASCADE;
  DROP TABLE "payload_preferences_rels" CASCADE;
  DROP TABLE "payload_migrations" CASCADE;
  DROP TYPE "public"."enum_verified_skills_status";
  DROP TYPE "public"."enum_verified_skills_processing_status";
  DROP TYPE "public"."enum_integration_logs_source";
  DROP TYPE "public"."enum_integration_logs_stage";
  DROP TYPE "public"."enum_integration_logs_outcome";`)
}
