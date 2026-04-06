import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../config';

const TOKEN_KEY = '@shue_auth_token';

class ApiService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = API_BASE_URL;
  }

  private async getToken(): Promise<string | null> {
    return AsyncStorage.getItem(TOKEN_KEY);
  }

  private async request(endpoint: string, options: RequestInit = {}) {
    const token = await this.getToken();
    const url = `${this.baseUrl}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.message || `API Error: ${response.status}`);
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
