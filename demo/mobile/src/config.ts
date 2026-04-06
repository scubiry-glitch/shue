/**
 * App 运行时配置
 *
 * ⚠️  注意：
 *  - 生产部署时应通过 CI/CD 注入环境变量，不要将真实 key 提交到版本库
 *  - 推荐使用 react-native-config（需原生配置）或 EAS Secret（Expo）管理敏感值
 *  - 本文件中的占位值仅用于本地开发
 *
 * APP_MODE:
 *  'mock' → 使用 Mock 用户登录；打卡页房源卡片立即显示（开发/演示）
 *  'real' → 使用 Supabase 登录；打卡页房源卡片只在打卡成功后显示
 */

export type AppMode = 'mock' | 'real';

// ─── 切换运行模式 ──────────────────────────────────────────────
export const APP_MODE: AppMode = (process.env['APP_MODE'] as AppMode) || 'mock';

// ─── API 地址 ──────────────────────────────────────────────────
export const API_BASE_URL: string =
  process.env['API_BASE_URL'] || 'http://localhost:3010';

// ─── Supabase（仅 APP_MODE=real 时使用）────────────────────────
// 从环境变量读取，绝不硬编码进代码库
export const SUPABASE_URL: string =
  process.env['SUPABASE_URL'] || '';

export const SUPABASE_ANON_KEY: string =
  process.env['SUPABASE_ANON_KEY'] || '';
