/**
 * TypeORM DataSource 配置
 * 用于 CLI 迁移命令：npx typeorm migration:run -d src/data-source.ts
 */
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import { join } from 'path';

dotenv.config();

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASS || 'postgres',
  database: process.env.DB_NAME || 'nfc_attendance',
  entities: [join(__dirname, '**', '*.entity{.ts,.js}')],
  migrations: [join(__dirname, 'migrations', '*{.ts,.js}')],
  // synchronize: 生产环境必须为 false，用 migration:run 代替
  synchronize: false,
  logging: process.env.NODE_ENV !== 'production',
});
