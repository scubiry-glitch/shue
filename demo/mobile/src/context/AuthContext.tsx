import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config';
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
  login: (email: string, password: string) => Promise<void>;
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

  // 恢复 session
  useEffect(() => {
    (async () => {
      try {
        const [token, userJson] = await Promise.all([
          AsyncStorage.getItem(TOKEN_KEY),
          AsyncStorage.getItem(USER_KEY),
        ]);
        if (token && userJson) {
          setState({ user: JSON.parse(userJson), token, isLoading: false, isAuthenticated: true });
        } else {
          setState(s => ({ ...s, isLoading: false }));
        }
      } catch {
        setState(s => ({ ...s, isLoading: false }));
      }
    })();
  }, []);

  const persistSession = async (token: string, refreshToken: string, user: AuthUser) => {
    await AsyncStorage.multiSet([
      [TOKEN_KEY, token],
      [REFRESH_TOKEN_KEY, refreshToken],
      [USER_KEY, JSON.stringify(user)],
    ]);
    setState({ user, token, isLoading: false, isAuthenticated: true });
  };

  /**
   * 登录流程（Supabase）：
   * 1. 向 Supabase Auth 做 email/password 认证 → 获取 Supabase access_token
   * 2. 将 Supabase token 发给后端 /auth/login → 获取 App JWT
   */
  const login = useCallback(async (email: string, password: string) => {
    // Step 1: Supabase 认证
    const supabaseRes = await fetch(
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

    if (!supabaseRes.ok) {
      const err = await supabaseRes.json().catch(() => ({}));
      throw new Error(err.error_description || err.message || 'Supabase 登录失败');
    }

    const { access_token: supabaseToken } = await supabaseRes.json();

    // Step 2: 换取 App JWT
    const { API_BASE_URL } = await import('../config');
    const appRes = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ supabaseToken }),
    });

    if (!appRes.ok) {
      const err = await appRes.json().catch(() => ({}));
      throw new Error(err.message || '应用登录失败');
    }

    const { token, refreshToken, user } = await appRes.json();
    await persistSession(token, refreshToken, user);
  }, []);

  const logout = useCallback(async () => {
    await AsyncStorage.multiRemove([TOKEN_KEY, REFRESH_TOKEN_KEY, USER_KEY]);
    setState({ user: null, token: null, isLoading: false, isAuthenticated: false });
  }, []);

  const hasPermission = useCallback(
    (permission: string) => state.user?.permissions?.includes(permission) ?? false,
    [state.user],
  );

  return (
    <AuthContext.Provider value={{ ...state, login, logout, hasPermission }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
