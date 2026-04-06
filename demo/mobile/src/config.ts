/**
 * App configuration
 *
 * APP_MODE:
 *  'mock'  → 使用Mock用户登录，打卡页房源卡片页面加载时即显示（开发/演示用）
 *  'real'  → 使用Supabase登录，打卡页房源卡片只在打卡成功后显示
 *
 * 修改 APP_MODE 以切换运行模式。
 */

export type AppMode = 'mock' | 'real';

export const APP_MODE: AppMode = 'mock'; // 👈 切换这里

export const API_BASE_URL = 'http://localhost:3010';

export const SUPABASE_URL = 'https://your-project.supabase.co';
export const SUPABASE_ANON_KEY = 'your-anon-key';
