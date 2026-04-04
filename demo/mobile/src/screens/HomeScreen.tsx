import React, { useState, useEffect } from 'react';
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

const CURRENT_USER = { id: 'user_001', name: '张三' };

export default function HomeScreen() {
  const [records, setRecords] = useState<CheckInRecord[]>([]);
  const [stats, setStats] = useState<TodayStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [deviceId] = useState(() => generateDeviceId());

  // 加载数据
  const loadData = async () => {
    try {
      setLoading(true);
      const [recordsData, statsData] = await Promise.all([
        api.getRecords(CURRENT_USER.id),
        api.getTodayStats(CURRENT_USER.id),
      ]);
      setRecords(recordsData.slice(0, 10));
      setStats(statsData);
    } catch (error) {
      Alert.alert('错误', '加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  // 模拟NFC打卡
  const simulateCheckIn = async () => {
    try {
      setLoading(true);
      
      // 随机选择一个NFC标签
      const tags = await api.getNfcTags();
      if (tags.length === 0) {
        // 初始化标签
        await api.initNfcTags();
      }
      
      const activeTags = await api.getNfcTags();
      const randomTag = activeTags[Math.floor(Math.random() * activeTags.length)];
      
      // 模拟GPS位置（偏差50米内）
      const gpsLat = randomTag.lat + (Math.random() - 0.5) * 0.001;
      const gpsLng = randomTag.lng + (Math.random() - 0.5) * 0.001;
      
      const result = await api.checkIn({
        nfcTagId: randomTag.tagId,
        userId: CURRENT_USER.id,
        userName: CURRENT_USER.name,
        recordType: 'CHECK_IN',
        gpsLat,
        gpsLng,
        gpsAccuracy: 5 + Math.random() * 15,
        deviceId,
        deviceModel: 'iPhone 14 Pro',
        photos: [],
      });
      
      Alert.alert(
        '✅ 打卡成功',
        `房源: ${result.houseName || '未知'}\n质量评分: ${result.qualityScore}分\n${result.isAnomaly ? '⚠️ ' + result.anomalyReason : ''}`
      );
      
      loadData();
    } catch (error: any) {
      Alert.alert('❌ 打卡失败', error.message);
    } finally {
      setLoading(false);
    }
  };

  // 模拟签退
  const simulateCheckOut = async (recordId: string) => {
    try {
      setLoading(true);
      const result = await api.checkOut(recordId);
      Alert.alert(
        '✅ 签退成功',
        `停留时长: ${formatDuration(result.durationSeconds)}`
      );
      loadData();
    } catch (error: any) {
      Alert.alert('❌ 签退失败', error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <ScrollView style={styles.container}>
      {/* 头部 */}
      <View style={styles.header}>
        <Text style={styles.title}>🏠 租务管家 NFC考勤</Text>
        <Text style={styles.subtitle}>欢迎, {CURRENT_USER.name}</Text>
      </View>

      {/* 今日统计卡片 */}
      {stats && (
        <View style={styles.statsCard}>
          <Text style={styles.cardTitle}>📊 今日统计</Text>
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
            <Text style={styles.timeText}>
              ⏰ 首次打卡: {formatTime(stats.firstCheckIn)}
            </Text>
            <Text style={styles.timeText}>
              🏃 最后离开: {formatTime(stats.lastCheckOut)}
            </Text>
          </View>
        </View>
      )}

      {/* NFC打卡按钮 */}
      <TouchableOpacity
        style={[styles.checkInButton, loading && styles.disabledButton]}
        onPress={simulateCheckIn}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <Text style={styles.checkInButtonIcon}>📱</Text>
            <Text style={styles.checkInButtonText}>模拟 NFC 打卡</Text>
            <Text style={styles.checkInButtonSub}>靠近房源NFC标签即可打卡</Text>
          </>
        )}
      </TouchableOpacity>

      {/* 今日记录列表 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📋 今日打卡记录</Text>
        {records.length === 0 ? (
          <Text style={styles.emptyText}>今天还没有打卡记录</Text>
        ) : (
          records.map((record) => (
            <View key={record.id} style={[styles.recordCard, record.isAnomaly && styles.anomalyCard]}>
              <View style={styles.recordHeader}>
                <Text style={styles.recordType}>{getRecordTypeText(record.recordType)}</Text>
                <Text style={[styles.qualityScore, { color: getScoreColor(record.qualityScore) }]}>
                  {record.qualityScore}分
                </Text>
              </View>
              
              <Text style={styles.houseName}>{record.houseName || record.nfcTagId}</Text>
              
              <View style={styles.recordInfo}>
                <Text style={styles.infoText}>🕐 到达: {formatTime(record.checkInTime)}</Text>
                <Text style={styles.infoText}>🕐 离开: {formatTime(record.checkOutTime)}</Text>
              </View>
              
              <View style={styles.recordFooter}>
                <Text style={styles.statusText}>{getStatusText(record.status)}</Text>
                <Text style={styles.durationText}>⏱ {formatDuration(record.durationSeconds)}</Text>
              </View>
              
              {record.isAnomaly && (
                <Text style={styles.anomalyText}>⚠️ {record.anomalyReason}</Text>
              )}
              
              {!record.checkOutTime && (
                <TouchableOpacity
                  style={styles.checkOutButton}
                  onPress={() => simulateCheckOut(record.id)}
                  disabled={loading}
                >
                  <Text style={styles.checkOutButtonText}>签退</Text>
                </TouchableOpacity>
              )}
            </View>
          ))
        )}
      </View>

      {/* 刷新按钮 */}
      <TouchableOpacity style={styles.refreshButton} onPress={loadData}>
        <Text style={styles.refreshText}>🔄 刷新数据</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#3b82f6',
    padding: 20,
    paddingTop: 50,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 5,
  },
  statsCard: {
    backgroundColor: '#fff',
    margin: 15,
    padding: 15,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#333',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 15,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#3b82f6',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  warningText: {
    color: '#f59e0b',
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingTop: 10,
  },
  timeText: {
    fontSize: 12,
    color: '#666',
  },
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
  disabledButton: {
    backgroundColor: '#9ca3af',
  },
  checkInButtonIcon: {
    fontSize: 48,
    marginBottom: 10,
  },
  checkInButtonText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  checkInButtonSub: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 5,
  },
  section: {
    padding: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  emptyText: {
    textAlign: 'center',
    color: '#999',
    padding: 30,
    fontSize: 14,
  },
  recordCard: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  anomalyCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#ef4444',
  },
  recordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  recordType: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  qualityScore: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  houseName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#3b82f6',
    marginBottom: 8,
  },
  recordInfo: {
    flexDirection: 'row',
    gap: 15,
    marginBottom: 8,
  },
  infoText: {
    fontSize: 13,
    color: '#666',
  },
  recordFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusText: {
    fontSize: 13,
    color: '#22c55e',
    fontWeight: '500',
  },
  durationText: {
    fontSize: 13,
    color: '#666',
  },
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
  checkOutButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  refreshButton: {
    backgroundColor: '#e5e7eb',
    margin: 15,
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 30,
  },
  refreshText: {
    color: '#374151',
    fontWeight: '600',
  },
});
