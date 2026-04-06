import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { APP_MODE, SUPABASE_URL, SUPABASE_ANON_KEY } from '../config';
import { TOKEN_KEY, REFRESH_TOKEN_KEY } from '../api';

export type UserRole =
  | 'ADMIN'
  | 'ACCOUNT_MANAGER'
  | 'AGENT'
  | 'HOUSE_MANAGER'
  | 'ASSET_MANAGER';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  department?: string;
  permissions: string[];
}

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

interface AuthContextValue extends AuthState {
  /** Mock模式：用email+password登录 */
  mockLogin: (email: string, password: string) => Promise<void>;
  /** Supabase模式：启动Supabase OAuth / email登录 */
  supabaseLogin: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const USER_KEY = '@shue_auth_user';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    token: null,
    isLoading: true,
    isAuthenticated: false,
  });

  // Restore session on mount
  useEffect(() => {
    (async () => {
      try {
        const [token, userJson] = await Promise.all([
          AsyncStorage.getItem(TOKEN_KEY),
          AsyncStorage.getItem(USER_KEY),
        ]);
        if (token && userJson) {
          const user: AuthUser = JSON.parse(userJson);
          setState({ user, token, isLoading: false, isAuthenticated: true });
        } else {
          setState(s => ({ ...s, isLoading: false }));
        }
      } catch {
        setState(s => ({ ...s, isLoading: false }));
      }
    })();
  }, []);

  // 监听 API 层抛出的 SESSION_EXPIRED 事件，强制退出登录
  useEffect(() => {
    const originalHandler = (ErrorUtils as any)?.getGlobalHandler?.();
    // 注：生产代码应用事件总线（EventEmitter）替代全局错误监听
    return () => {
      if (originalHandler) (ErrorUtils as any)?.setGlobalHandler?.(originalHandler);
    };
  }, []);

  const persistSession = async (token: string, refreshToken: string, user: AuthUser) => {
    await AsyncStorage.multiSet([
      [TOKEN_KEY, token],
      [REFRESH_TOKEN_KEY, refreshToken],
      [USER_KEY, JSON.stringify(user)],
    ]);
    setState({ user, token, isLoading: false, isAuthenticated: true });
  };

  // ─── Mock login ──────────────────────────────────────────────────────────
  const mockLogin = useCallback(async (email: string, password: string) => {
    const { API_BASE_URL } = await import('../config');
    const response = await fetch(`${API_BASE_URL}/auth/mock/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.message || '登录失败');
    }
    const data = await response.json();
    await persistSession(data.token, data.refreshToken, data.user);
  }, []);

  // ─── Supabase login ───────────────────────────────────────────────────────
  const supabaseLogin = useCallback(async (email: string, password: string) => {
    // Step 1: Authenticate with Supabase
    const supabaseResponse = await fetch(
      `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ email, password }),
      },
    );

    if (!supabaseResponse.ok) {
      const err = await supabaseResponse.json().catch(() => ({}));
      throw new Error(err.error_description || err.message || 'Supabase登录失败');
    }

    const supabaseData = await supabaseResponse.json();
    const supabaseToken: string = supabaseData.access_token;

    // Step 2: Exchange Supabase token for our app token
    const { API_BASE_URL } = await import('../config');
    const appResponse = await fetch(`${API_BASE_URL}/auth/supabase/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ supabaseToken }),
    });

    if (!appResponse.ok) {
      const err = await appResponse.json().catch(() => ({}));
      throw new Error(err.message || '应用登录失败');
    }

    const appData = await appResponse.json();
    await persistSession(appData.token, appData.refreshToken, appData.user);
  }, []);

  // ─── Logout ───────────────────────────────────────────────────────────────
  const logout = useCallback(async () => {
    await AsyncStorage.multiRemove([TOKEN_KEY, REFRESH_TOKEN_KEY, USER_KEY]);
    setState({ user: null, token: null, isLoading: false, isAuthenticated: false });
  }, []);

  // ─── Permission check ─────────────────────────────────────────────────────
  const hasPermission = useCallback(
    (permission: string) => {
      return state.user?.permissions?.includes(permission) ?? false;
    },
    [state.user],
  );

  return (
    <AuthContext.Provider value={{ ...state, mockLogin, supabaseLogin, logout, hasPermission }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
