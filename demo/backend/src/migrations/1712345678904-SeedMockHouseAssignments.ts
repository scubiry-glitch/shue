import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * mock 演示默认分配：
 * 给 user_001 预置 house_001~house_009 的有效分配，避免 H5 演示打卡因无权限失败。
 */
export class SeedMockHouseAssignments1712345678904 implements MigrationInterface {
  name = 'SeedMockHouseAssignments1712345678904';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO "house_assignments" (
        "house_id", "user_id", "department_id", "role",
        "valid_from", "valid_to", "is_active"
      )
      SELECT
        h.house_id, 'user_001', NULL, NULL, DATE '2024-01-01', NULL, true
      FROM (VALUES
        ('house_001'),
        ('house_002'),
        ('house_003'),
        ('house_004'),
        ('house_005'),
        ('house_006'),
        ('house_007'),
        ('house_008'),
        ('house_009')
      ) AS h(house_id)
      WHERE NOT EXISTS (
        SELECT 1
        FROM "house_assignments" a
        WHERE a."house_id" = h.house_id
          AND a."user_id" = 'user_001'
          AND a."is_active" = true
          AND a."valid_from" <= CURRENT_DATE
          AND (a."valid_to" IS NULL OR a."valid_to" >= CURRENT_DATE)
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM "house_assignments"
      WHERE "user_id" = 'user_001'
        AND "house_id" IN (
          'house_001','house_002','house_003','house_004','house_005',
          'house_006','house_007','house_008','house_009'
        )
        AND "valid_from" = DATE '2024-01-01'
        AND "valid_to" IS NULL
    `);
  }
}

