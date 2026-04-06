import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 初始迁移：创建 nfc_tags、attendance_records、users 表
 * 生成命令：npx typeorm migration:generate -d src/data-source.ts src/migrations/InitSchema
 * 执行命令：npx typeorm migration:run -d src/data-source.ts
 * 回滚命令：npx typeorm migration:revert -d src/data-source.ts
 */
export class InitSchema1712345678901 implements MigrationInterface {
  name = 'InitSchema1712345678901';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── users ────────────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TYPE "public"."users_role_enum" AS ENUM(
        'ACCOUNT_MANAGER', 'AGENT', 'HOUSE_MANAGER', 'ASSET_MANAGER', 'ADMIN'
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id"           UUID NOT NULL DEFAULT gen_random_uuid(),
        "email"        VARCHAR NOT NULL,
        "name"         VARCHAR NOT NULL,
        "role"         "public"."users_role_enum" NOT NULL DEFAULT 'AGENT',
        "department"   VARCHAR,
        "phone"        VARCHAR,
        "supabase_id"  VARCHAR,
        "mock_password" VARCHAR,
        "level"        VARCHAR(8),
        "join_date"    DATE,
        "device_model" VARCHAR(64),
        "status_note"  VARCHAR(128),
        "is_active"    BOOLEAN NOT NULL DEFAULT true,
        "created_at"   TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at"   TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_users_email" UNIQUE ("email"),
        CONSTRAINT "PK_users" PRIMARY KEY ("id")
      )
    `);

    // ── nfc_tags ─────────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TYPE "public"."nfc_tags_type_enum" AS ENUM('HOUSE', 'OFFICE')
    `);
    await queryRunner.query(`
      CREATE TYPE "public"."nfc_tags_status_enum" AS ENUM('ACTIVE', 'INACTIVE', 'LOST')
    `);
    await queryRunner.query(`
      CREATE TABLE "nfc_tags" (
        "id"         UUID NOT NULL DEFAULT gen_random_uuid(),
        "tag_id"     VARCHAR(64) NOT NULL,
        "tag_type"   "public"."nfc_tags_type_enum" NOT NULL DEFAULT 'HOUSE',
        "house_id"   VARCHAR(64),
        "office_id"  VARCHAR(64),
        "address"    VARCHAR(256),
        "lat"        DOUBLE PRECISION,
        "lng"        DOUBLE PRECISION,
        "status"     "public"."nfc_tags_status_enum" NOT NULL DEFAULT 'ACTIVE',
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_nfc_tags_tag_id" UNIQUE ("tag_id"),
        CONSTRAINT "PK_nfc_tags" PRIMARY KEY ("id")
      )
    `);

    // ── attendance_records ───────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TYPE "public"."attendance_records_record_type_enum" AS ENUM(
        'CHECK_IN', 'CHECK_OUT', 'INSPECT', 'SIGNING', 'OFFICE_IN', 'OFFICE_OUT'
      )
    `);
    await queryRunner.query(`
      CREATE TYPE "public"."attendance_records_status_enum" AS ENUM('VALID', 'INVALID', 'SUSPECTED')
    `);
    await queryRunner.query(`
      CREATE TABLE "attendance_records" (
        "id"               UUID NOT NULL DEFAULT gen_random_uuid(),
        "user_id"          VARCHAR(64) NOT NULL,
        "user_name"        VARCHAR(64),
        "record_type"      "public"."attendance_records_record_type_enum" NOT NULL DEFAULT 'CHECK_IN',
        "role"             VARCHAR(32),
        "task_type"        VARCHAR(32),
        "task_name"        VARCHAR(64),
        "require_checkout" BOOLEAN NOT NULL DEFAULT false,
        "task_data"        JSONB NOT NULL DEFAULT '{}',
        "nfc_tag_id"       VARCHAR(64) NOT NULL,
        "nfc_verified"     BOOLEAN NOT NULL DEFAULT false,
        "nfc_lat"          DOUBLE PRECISION,
        "nfc_lng"          DOUBLE PRECISION,
        "gps_lat"          DOUBLE PRECISION,
        "gps_lng"          DOUBLE PRECISION,
        "gps_accuracy"     DOUBLE PRECISION,
        "distance_meters"  DOUBLE PRECISION,
        "distance_valid"   BOOLEAN,
        "check_in_time"    TIMESTAMP,
        "check_out_time"   TIMESTAMP,
        "duration_seconds" INTEGER,
        "photos"           JSONB NOT NULL DEFAULT '[]',
        "device_id"        VARCHAR(128),
        "device_model"     VARCHAR(64),
        "house_id"         VARCHAR(64),
        "house_name"       VARCHAR(128),
        "quality_score"    INTEGER NOT NULL DEFAULT 0,
        "is_anomaly"       BOOLEAN NOT NULL DEFAULT false,
        "anomaly_type"     VARCHAR(32),
        "anomaly_reason"   TEXT,
        "status"           "public"."attendance_records_status_enum" NOT NULL DEFAULT 'VALID',
        "created_at"       TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at"       TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_attendance_records" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_attendance_user_created" ON "attendance_records" ("user_id", "created_at")`);
    await queryRunner.query(`CREATE INDEX "IDX_attendance_nfc_tag" ON "attendance_records" ("nfc_tag_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_attendance_role_task" ON "attendance_records" ("role", "task_type")`);
    await queryRunner.query(`CREATE INDEX "IDX_attendance_house_role" ON "attendance_records" ("house_id", "role")`);

    // ── appeals ───────────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TYPE "public"."appeals_status_enum" AS ENUM('PENDING', 'APPROVED', 'REJECTED')
    `);
    await queryRunner.query(`
      CREATE TABLE "appeals" (
        "id"             UUID NOT NULL DEFAULT gen_random_uuid(),
        "record_id"      VARCHAR(64) NOT NULL,
        "user_id"        VARCHAR(64) NOT NULL,
        "user_name"      VARCHAR(64),
        "reason"         TEXT NOT NULL,
        "status"         "public"."appeals_status_enum" NOT NULL DEFAULT 'PENDING',
        "review_comment" TEXT,
        "reviewer_id"    VARCHAR(64),
        "reviewed_at"    TIMESTAMP,
        "created_at"     TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at"     TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_appeals" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_appeals_user" ON "appeals" ("user_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_appeals_record" ON "appeals" ("record_id")`);

    // ── user_daily_stats ──────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "user_daily_stats" (
        "id"                UUID NOT NULL DEFAULT gen_random_uuid(),
        "user_id"           VARCHAR(64) NOT NULL,
        "stats_date"        DATE NOT NULL,
        "total_check_ins"   INTEGER NOT NULL DEFAULT 0,
        "verified_count"    INTEGER NOT NULL DEFAULT 0,
        "anomaly_count"     INTEGER NOT NULL DEFAULT 0,
        "avg_quality_score" INTEGER NOT NULL DEFAULT 0,
        "first_check_in"    TIMESTAMP,
        "last_check_out"    TIMESTAMP,
        "created_at"        TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at"        TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_daily_stats_user_date" UNIQUE ("user_id", "stats_date"),
        CONSTRAINT "PK_user_daily_stats" PRIMARY KEY ("id")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "user_daily_stats"`);
    await queryRunner.query(`DROP TABLE "appeals"`);
    await queryRunner.query(`DROP TYPE "public"."appeals_status_enum"`);
    await queryRunner.query(`DROP INDEX "IDX_attendance_house_role"`);
    await queryRunner.query(`DROP INDEX "IDX_attendance_role_task"`);
    await queryRunner.query(`DROP INDEX "IDX_attendance_nfc_tag"`);
    await queryRunner.query(`DROP INDEX "IDX_attendance_user_created"`);
    await queryRunner.query(`DROP TABLE "attendance_records"`);
    await queryRunner.query(`DROP TYPE "public"."attendance_records_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."attendance_records_record_type_enum"`);
    await queryRunner.query(`DROP TABLE "nfc_tags"`);
    await queryRunner.query(`DROP TYPE "public"."nfc_tags_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."nfc_tags_type_enum"`);
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP TYPE "public"."users_role_enum"`);
  }
}
