import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 与 AttendanceRecord / NfcTag 实体对齐：补齐历史 init.sql 或旧迁移中缺失的列。
 * 避免 SELECT 时因列不存在导致 500。
 */
export class SyncAttendanceEntityColumns1712345678902 implements MigrationInterface {
  name = 'SyncAttendanceEntityColumns1712345678902';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "public"."attendance_records_session_status_enum" AS ENUM(
          'OPEN', 'CLOSED', 'AUTO_CLOSED', 'CANCELLED'
        );
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await queryRunner.query(`
      ALTER TABLE "attendance_records"
      ADD COLUMN IF NOT EXISTS "role" VARCHAR(32)
    `);
    await queryRunner.query(`
      ALTER TABLE "attendance_records"
      ADD COLUMN IF NOT EXISTS "task_type" VARCHAR(32)
    `);
    await queryRunner.query(`
      ALTER TABLE "attendance_records"
      ADD COLUMN IF NOT EXISTS "task_name" VARCHAR(64)
    `);
    await queryRunner.query(`
      ALTER TABLE "attendance_records"
      ADD COLUMN IF NOT EXISTS "require_checkout" BOOLEAN NOT NULL DEFAULT false
    `);
    await queryRunner.query(`
      ALTER TABLE "attendance_records"
      ADD COLUMN IF NOT EXISTS "task_data" JSONB NOT NULL DEFAULT '{}'
    `);

    await queryRunner.query(`
      ALTER TABLE "attendance_records"
      ADD COLUMN IF NOT EXISTS "session_status" "public"."attendance_records_session_status_enum" NOT NULL DEFAULT 'OPEN'
    `);

    await queryRunner.query(`
      ALTER TABLE "attendance_records"
      ADD COLUMN IF NOT EXISTS "auto_close_reason" TEXT
    `);
    await queryRunner.query(`
      ALTER TABLE "attendance_records"
      ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP
    `);

    await queryRunner.query(`
      UPDATE "attendance_records"
      SET "session_status" = 'CLOSED'
      WHERE "check_out_time" IS NOT NULL
        AND "session_status" = 'OPEN'
    `);

    await queryRunner.query(`
      ALTER TABLE "nfc_tags"
      ADD COLUMN IF NOT EXISTS "valid_until" DATE
    `);
    await queryRunner.query(`
      ALTER TABLE "nfc_tags"
      ADD COLUMN IF NOT EXISTS "house_status" VARCHAR(32)
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'chk_status'
            AND conrelid = 'nfc_tags'::regclass
        ) THEN
          ALTER TABLE "nfc_tags" DROP CONSTRAINT "chk_status";
          ALTER TABLE "nfc_tags" ADD CONSTRAINT "chk_status" CHECK (
            status::text = ANY (ARRAY['ACTIVE','INACTIVE','LOST','SUSPENDED']::text[])
          );
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM pg_type t
          JOIN pg_namespace n ON n.oid = t.typnamespace
          WHERE t.typname = 'nfc_tags_status_enum' AND n.nspname = 'public'
        ) AND NOT EXISTS (
          SELECT 1 FROM pg_enum e
          JOIN pg_type t ON e.enumtypid = t.oid
          WHERE t.typname = 'nfc_tags_status_enum'
            AND e.enumlabel = 'SUSPENDED'
        ) THEN
          ALTER TYPE "public"."nfc_tags_status_enum" ADD VALUE 'SUSPENDED';
        END IF;
      EXCEPTION
        WHEN OTHERS THEN NULL;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 仅撤销本迁移新增的会话/软删除与 NFC 扩展列；不删除 role/task_* 等（可能由 InitSchema 创建）
    await queryRunner.query(`ALTER TABLE "attendance_records" DROP COLUMN IF EXISTS "deleted_at"`);
    await queryRunner.query(`ALTER TABLE "attendance_records" DROP COLUMN IF EXISTS "auto_close_reason"`);
    await queryRunner.query(`ALTER TABLE "attendance_records" DROP COLUMN IF EXISTS "session_status"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."attendance_records_session_status_enum"`);
    await queryRunner.query(`ALTER TABLE "nfc_tags" DROP COLUMN IF EXISTS "house_status"`);
    await queryRunner.query(`ALTER TABLE "nfc_tags" DROP COLUMN IF EXISTS "valid_until"`);
  }
}
