import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { useNfc } from '../hooks/useNfc';
import { enqueueCheckIn, syncQueue, getPendingCount } from '../services/offlineQueue';
import {
  formatTime,
  formatDuration,
  getScoreColor,
  getStatusText,
  getRecordTypeText,
  generateDeviceId,
} from '../utils';

interface CheckInRecord {
  id: string;
  recordType: string;
  nfcTagId: string;
  houseName: string;
  checkInTime: string;
  checkOutTime: string | null;
  durationSeconds: number | null;
  qualityScore: number;
  status: string;
  isAnomaly: boolean;
  anomalyReason?: string;
  distanceMeters: number;
}

interface TodayStats {
  totalCheckIns: number;
  verifiedCount: number;
  anomalyCount: number;
  avgQualityScore: number;
  firstCheckIn: string | null;
  lastCheckOut: string | null;
}

const ROLE_LABELS: Record<string, string> = {
  ADMIN: '管理员',
  ACCOUNT_MANAGER: '客户经理',
  AGENT: '经纪人',
  HOUSE_MANAGER: '租户管家',
  ASSET_MANAGER: '资管经理',
};

export default function HomeScreen() {
  const { user, logout } = useAuth();
  const [records, setRecords] = useState<CheckInRecord[]>([]);
  const [stats, setStats] = useState<TodayStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [deviceId] = useState(() => generateDeviceId());
  // 房源卡片只在打卡成功后显示
  const [hasCheckedIn, setHasCheckedIn] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  const { isNfcSupported, isScanning, readNfcTag } = useNfc();

  const loadData = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      const [recordsData, statsData] = await Promise.all([
        api.getRecords(user.id),
        api.getTodayStats(user.id),
      ]);
      setRecords(recordsData.slice(0, 10));
      setStats(statsData);
    } catch {
      // 静默失败，不影响主流程
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      api.getTodayStats(user.id)
        .then(data => setStats(data))
        .catch(() => {});
    }

    // 启动时同步离线队列
    getPendingCount().then(setPendingCount);
    syncQueue().then(result => {
      if (result.success > 0) {
        Alert.alert('离线数据已同步', `成功上传 ${result.success} 条离线打卡记录`);
        getPendingCount().then(setPendingCount);
        loadData();
      }
    }).catch(() => {});
  }, [user]);

  const handleCheckIn = async () => {
    if (!user) return;

    if (!isNfcSupported) {
      Alert.alert('NFC 不可用', '当前设备不支持 NFC，无法打卡');
      return;
    }

    try {
      setLoading(true);
      Alert.alert('NFC 打卡', '请将手机靠近房源 NFC 标签...');
      const { tagId } = await readNfcTag();
      if (!tagId) {
        Alert.alert('打卡失败', '未能读取 NFC 标签，请重试');
        return;
      }

      // 获取 GPS
      let gpsLat = 0, gpsLng = 0, gpsAccuracy = 999;
      try {
        const { Geolocation } = await import('@react-native-community/geolocation');
        await new Promise<void>((resolve, reject) => {
          Geolocation.getCurrentPosition(
            pos => {
              gpsLat = pos.coords.latitude;
              gpsLng = pos.coords.longitude;
              gpsAccuracy = pos.coords.accuracy;
              resolve();
            },
            reject,
            { timeout: 5000, maximumAge: 10000 },
          );
        });
      } catch {
        // GPS 获取失败时继续打卡，后端会标记为低精度异常
      }

      const checkInData = {
        nfcTagId: tagId,
        userId: user.id,
        userName: user.name,
        recordType: 'CHECK_IN',
        gpsLat,
        gpsLng,
        gpsAccuracy,
        deviceId,
        deviceModel: 'Mobile',
        photos: [],
      };

      try {
        const result = await api.checkIn(checkInData);
        Alert.alert(
          '打卡成功',
          `房源: ${result.houseName || '未知'}\n质量评分: ${result.qualityScore}分${result.isAnomaly ? '\n⚠️ ' + result.anomalyReason : ''}`,
        );
        setHasCheckedIn(true);
        loadData();
      } catch (netErr: any) {
        // 网络失败 → 写入离线队列
        await enqueueCheckIn(checkInData);
        const count = await getPendingCount();
        setPendingCount(count);
        Alert.alert('网络不可用', `打卡数据已本地保存，恢复网络后自动上传（待上传: ${count} 条）`);
      }
    } catch (error: any) {
      Alert.alert('打卡失败', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckOut = async (recordId: string) => {
    try {
      setLoading(true);
      const result = await api.checkOut(recordId);
      Alert.alert('签退成功', `停留时长: ${formatDuration(result.durationSeconds)}`);
      loadData();
    } catch (error: any) {
      Alert.alert('签退失败', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      {/* 头部 */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.title}>租务管家 NFC考勤</Text>
            <Text style={styles.subtitle}>
              欢迎，{user?.name}
              {user?.role ? `（${ROLE_LABELS[user.role] || user.role}）` : ''}
            </Text>
          </View>
          <TouchableOpacity style={styles.logoutButton} onPress={logout}>
            <Text style={styles.logoutText}>退出</Text>
          </TouchableOpacity>
        </View>
        {pendingCount > 0 && (
          <View style={styles.pendingBadge}>
            <Text style={styles.pendingText}>离线待上传 {pendingCount} 条</Text>
          </View>
        )}
      </View>

      {/* 今日统计 */}
      {stats && (
        <View style={styles.statsCard}>
          <Text style={styles.cardTitle}>今日统计</Text>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.totalCheckIns}</Text>
              <Text style={styles.statLabel}>打卡次数</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.verifiedCount}</Text>
              <Text style={styles.statLabel}>有效打卡</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, stats.anomalyCount > 0 && styles.warningText]}>
                {stats.anomalyCount}
              </Text>
              <Text style={styles.statLabel}>异常</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: getScoreColor(stats.avgQualityScore) }]}>
                {stats.avgQualityScore || 0}
              </Text>
              <Text style={styles.statLabel}>平均评分</Text>
            </View>
          </View>
          <View style={styles.timeRow}>
            <Text style={styles.timeText}>首次打卡: {formatTime(stats.firstCheckIn)}</Text>
            <Text style={styles.timeText}>最后离开: {formatTime(stats.lastCheckOut)}</Text>
          </View>
        </View>
      )}

      {/* NFC 打卡按钮 */}
      <TouchableOpacity
        style={[styles.checkInButton, (loading || isScanning || !isNfcSupported) && styles.disabledButton]}
        onPress={handleCheckIn}
        disabled={loading || isScanning || !isNfcSupported}
      >
        {loading || isScanning ? (
          <>
            <ActivityIndicator color="#fff" />
            {isScanning && <Text style={styles.checkInButtonSub}>正在读取 NFC 标签...</Text>}
          </>
        ) : (
          <>
            <Text style={styles.checkInButtonIcon}>📱</Text>
            <Text style={styles.checkInButtonText}>
              {isNfcSupported ? 'NFC 打卡' : 'NFC 不可用'}
            </Text>
            <Text style={styles.checkInButtonSub}>
              {isNfcSupported ? '靠近房源 NFC 标签打卡，打卡后显示房源信息' : '当前设备不支持 NFC'}
            </Text>
          </>
        )}
      </TouchableOpacity>

      {/* 打卡前提示（未打卡时显示） */}
      {!hasCheckedIn && (
        <View style={styles.hintCard}>
          <Text style={styles.hintIcon}>🔒</Text>
          <Text style={styles.hintText}>打卡成功后将显示房源信息</Text>
          <Text style={styles.hintSub}>请靠近房源 NFC 标签完成打卡</Text>
        </View>
      )}

      {/* 今日记录列表（打卡成功后显示） */}
      {hasCheckedIn && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>今日打卡记录</Text>
          {records.length === 0 ? (
            <Text style={styles.emptyText}>今天还没有打卡记录</Text>
          ) : (
            records.map(record => (
              <View
                key={record.id}
                style={[styles.recordCard, record.isAnomaly && styles.anomalyCard]}
              >
                <View style={styles.recordHeader}>
                  <Text style={styles.recordType}>{getRecordTypeText(record.recordType)}</Text>
                  <Text style={[styles.qualityScore, { color: getScoreColor(record.qualityScore) }]}>
                    {record.qualityScore}分
                  </Text>
                </View>
                <Text style={styles.houseName}>{record.houseName || record.nfcTagId}</Text>
                <View style={styles.recordInfo}>
                  <Text style={styles.infoText}>到达: {formatTime(record.checkInTime)}</Text>
                  <Text style={styles.infoText}>离开: {formatTime(record.checkOutTime)}</Text>
                </View>
                <View style={styles.recordFooter}>
                  <Text style={styles.statusText}>{getStatusText(record.status)}</Text>
                  <Text style={styles.durationText}>{formatDuration(record.durationSeconds)}</Text>
                </View>
                {record.isAnomaly && (
                  <Text style={styles.anomalyText}>⚠️ {record.anomalyReason}</Text>
                )}
                {!record.checkOutTime && (
                  <TouchableOpacity
                    style={styles.checkOutButton}
                    onPress={() => handleCheckOut(record.id)}
                    disabled={loading}
                  >
                    <Text style={styles.checkOutButtonText}>签退</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))
          )}
          <TouchableOpacity style={styles.refreshButton} onPress={loadData}>
            <Text style={styles.refreshText}>刷新数据</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: { backgroundColor: '#3b82f6', padding: 20, paddingTop: 50 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  title: { fontSize: 22, fontWeight: 'bold', color: '#fff' },
  subtitle: { fontSize: 14, color: 'rgba(255,255,255,0.85)', marginTop: 4 },
  logoutButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
  },
  logoutText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  pendingBadge: {
    backgroundColor: '#f59e0b',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    marginTop: 10,
    alignSelf: 'flex-start',
  },
  pendingText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  statsCard: {
    backgroundColor: '#fff',
    margin: 15,
    padding: 15,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  cardTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 12, color: '#333' },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 12 },
  statItem: { alignItems: 'center' },
  statValue: { fontSize: 26, fontWeight: 'bold', color: '#3b82f6' },
  statLabel: { fontSize: 12, color: '#666', marginTop: 4 },
  warningText: { color: '#f59e0b' },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingTop: 10,
  },
  timeText: { fontSize: 12, color: '#666' },
  checkInButton: {
    backgroundColor: '#22c55e',
    margin: 15,
    padding: 25,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#22c55e',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  disabledButton: { backgroundColor: '#9ca3af', shadowOpacity: 0 },
  checkInButtonIcon: { fontSize: 48, marginBottom: 8 },
  checkInButtonText: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  checkInButtonSub: { fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 4, textAlign: 'center' },
  hintCard: {
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fde68a',
    marginHorizontal: 15,
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
  },
  hintIcon: { fontSize: 36, marginBottom: 8 },
  hintText: { fontSize: 16, fontWeight: '600', color: '#92400e' },
  hintSub: { fontSize: 13, color: '#b45309', marginTop: 4 },
  section: { padding: 15 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 10, color: '#333' },
  emptyText: { textAlign: 'center', color: '#999', padding: 30, fontSize: 14 },
  recordCard: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  anomalyCard: { borderLeftWidth: 4, borderLeftColor: '#ef4444' },
  recordHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  recordType: { fontSize: 14, fontWeight: '600', color: '#333' },
  qualityScore: { fontSize: 16, fontWeight: 'bold' },
  houseName: { fontSize: 16, fontWeight: '500', color: '#3b82f6', marginBottom: 8 },
  recordInfo: { flexDirection: 'row', gap: 15, marginBottom: 8 },
  infoText: { fontSize: 13, color: '#666' },
  recordFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statusText: { fontSize: 13, color: '#22c55e', fontWeight: '500' },
  durationText: { fontSize: 13, color: '#666' },
  anomalyText: {
    fontSize: 12,
    color: '#ef4444',
    marginTop: 8,
    backgroundColor: '#fef2f2',
    padding: 8,
    borderRadius: 4,
  },
  checkOutButton: {
    backgroundColor: '#f59e0b',
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 6,
    marginTop: 10,
    alignSelf: 'flex-end',
  },
  checkOutButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  refreshButton: {
    backgroundColor: '#e5e7eb',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 30,
  },
  refreshText: { color: '#374151', fontWeight: '600' },
});
