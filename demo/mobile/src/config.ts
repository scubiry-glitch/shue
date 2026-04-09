/**
 * App 运行时配置
 *
 * 生产部署时通过 CI/CD 或 EAS Secret 注入环境变量，不要将真实 key 提交到版本库。
 */

// ─── 后端 API ─────────────────────────────────────────────
export const API_BASE_URL: string =
  process.env['API_BASE_URL'] || 'http://localhost:3010';

// ─── Supabase ─────────────────────────────────────────────
// project ref: xmbwbjqezgrybpfbtqba
export const SUPABASE_URL: string =
  process.env['SUPABASE_URL'] || 'https://xmbwbjqezgrybpfbtqba.supabase.co';

export const SUPABASE_ANON_KEY: string =
  process.env['SUPABASE_ANON_KEY'] || 'sb_publishable_u6vCC2KS4lD2qKIdb5lhQg_s1DZ_721';
