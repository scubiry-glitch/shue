import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../config';

export const TOKEN_KEY = '@shue_auth_token';
export const REFRESH_TOKEN_KEY = '@shue_refresh_token';

// 正在刷新中的 Promise（防止并发多次刷新）
let refreshingPromise: Promise<string | null> | null = null;

async function attemptTokenRefresh(): Promise<string | null> {
  const refreshToken = await AsyncStorage.getItem(REFRESH_TOKEN_KEY);
  if (!refreshToken) return null;

  try {
    const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!response.ok) return null;
    const data = await response.json();
    await AsyncStorage.setItem(TOKEN_KEY, data.token);
    return data.token;
  } catch {
    return null;
  }
}

class ApiService {
  private async getToken(): Promise<string | null> {
    return AsyncStorage.getItem(TOKEN_KEY);
  }

  private async request(
    endpoint: string,
    options: RequestInit = {},
    retryOn401 = true,
  ): Promise<any> {
    const token = await this.getToken();
    const url = `${API_BASE_URL}${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });

    // 自动刷新 token（只重试一次）
    if (response.status === 401 && retryOn401) {
      if (!refreshingPromise) {
        refreshingPromise = attemptTokenRefresh().finally(() => {
          refreshingPromise = null;
        });
      }
      const newToken = await refreshingPromise;
      if (newToken) {
        // 用新 token 重试原请求
        return this.request(endpoint, options, false);
      }
      // 刷新失败：清除本地会话，让 AuthContext 跳转到登录页
      await AsyncStorage.multiRemove([TOKEN_KEY, REFRESH_TOKEN_KEY, '@shue_auth_user']);
      throw Object.assign(new Error('登录已过期，请重新登录'), { code: 'SESSION_EXPIRED' });
    }

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.message || `请求失败 (${response.status})`);
    }

    return response.json();
  }

  // NFC打卡
  async checkIn(data: {
    nfcTagId: string;
    userId: string;
    userName?: string;
    recordType: string;
    gpsLat?: number;
    gpsLng?: number;
    gpsAccuracy?: number;
    deviceId?: string;
    deviceModel?: string;
    photos?: any[];
  }) {
    return this.request('/attendance/checkin', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // 签退
  async checkOut(recordId: string, gpsLat?: number, gpsLng?: number) {
    return this.request('/attendance/checkout', {
      method: 'POST',
      body: JSON.stringify({ recordId, gpsLat, gpsLng }),
    });
  }

  // 获取打卡记录
  async getRecords(userId: string, startDate?: string, endDate?: string) {
    const params = new URLSearchParams({ userId });
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    return this.request(`/attendance/records?${params}`);
  }

  // 获取今日统计
  async getTodayStats(userId: string) {
    return this.request(`/attendance/stats/today?userId=${userId}`);
  }

  // 获取NFC标签列表
  async getNfcTags() {
    return this.request('/attendance/nfc-tags');
  }

  // 初始化NFC标签（仅管理员）
  async initNfcTags() {
    return this.request('/attendance/nfc-tags/init', { method: 'POST' });
  }
}

export const api = new ApiService();
