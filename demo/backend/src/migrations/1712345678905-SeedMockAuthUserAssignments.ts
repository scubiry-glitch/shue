import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 兼容 mock 登录用户（mock_user_001）的默认房源分配。
 * H5 自动登录后，checkIn 权限校验使用 JWT 用户 id（mock_user_001）。
 */
export class SeedMockAuthUserAssignments1712345678905 implements MigrationInterface {
  name = 'SeedMockAuthUserAssignments1712345678905';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO "house_assignments" (
        "house_id", "user_id", "department_id", "role",
        "valid_from", "valid_to", "is_active"
      )
      SELECT
        h.house_id, 'mock_user_001', NULL, NULL, DATE '2024-01-01', NULL, true
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
          AND a."user_id" = 'mock_user_001'
          AND a."is_active" = true
          AND a."valid_from" <= CURRENT_DATE
          AND (a."valid_to" IS NULL OR a."valid_to" >= CURRENT_DATE)
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM "house_assignments"
      WHERE "user_id" = 'mock_user_001'
        AND "house_id" IN (
          'house_001','house_002','house_003','house_004','house_005',
          'house_006','house_007','house_008','house_009'
        )
        AND "valid_from" = DATE '2024-01-01'
        AND "valid_to" IS NULL
    `);
  }
}

