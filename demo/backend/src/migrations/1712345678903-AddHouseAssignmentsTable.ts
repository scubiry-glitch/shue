import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 创建房源分配表（house_assignments）
 * 用于 checkIn 时校验用户/部门对房源的访问权限。
 */
export class AddHouseAssignmentsTable1712345678903 implements MigrationInterface {
  name = 'AddHouseAssignmentsTable1712345678903';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "house_assignments" (
        "id" UUID NOT NULL DEFAULT gen_random_uuid(),
        "house_id" VARCHAR NOT NULL,
        "user_id" VARCHAR,
        "department_id" VARCHAR,
        "role" "public"."users_role_enum",
        "valid_from" DATE NOT NULL,
        "valid_to" DATE,
        "is_active" BOOLEAN NOT NULL DEFAULT true,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_house_assignments" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_house_assignments_house_user" ON "house_assignments" ("house_id", "user_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_house_assignments_house_department" ON "house_assignments" ("house_id", "department_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_house_assignments_user_valid_to" ON "house_assignments" ("user_id", "valid_to")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_house_assignments_user_valid_to"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_house_assignments_house_department"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_house_assignments_house_user"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "house_assignments"`);
  }
}

