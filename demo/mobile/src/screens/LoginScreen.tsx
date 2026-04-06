import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { APP_MODE, API_BASE_URL } from '../config';

interface MockUser {
  id: string;
  email: string;
  name: string;
  role: string;
  department: string;
}

const ROLE_LABELS: Record<string, string> = {
  ADMIN: '管理员',
  ACCOUNT_MANAGER: '客户经理',
  AGENT: '经纪人',
  HOUSE_MANAGER: '租户管家',
  ASSET_MANAGER: '资管经理',
};

const ROLE_COLORS: Record<string, string> = {
  ADMIN: '#7c3aed',
  ACCOUNT_MANAGER: '#2563eb',
  AGENT: '#16a34a',
  HOUSE_MANAGER: '#d97706',
  ASSET_MANAGER: '#dc2626',
};

export default function LoginScreen() {
  const { mockLogin, supabaseLogin } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [mockUsers, setMockUsers] = useState<MockUser[]>([]);

  const isMockMode = APP_MODE === 'mock';

  // Load mock user list for quick-login in mock mode
  useEffect(() => {
    if (isMockMode) {
      fetch(`${API_BASE_URL}/auth/mock/users`)
        .then(r => r.json())
        .then(data => setMockUsers(data.users || []))
        .catch(() => {});
    }
  }, [isMockMode]);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('提示', '请输入邮箱和密码');
      return;
    }
    setLoading(true);
    try {
      if (isMockMode) {
        await mockLogin(email.trim(), password.trim());
      } else {
        await supabaseLogin(email.trim(), password.trim());
      }
    } catch (err: any) {
      Alert.alert('登录失败', err.message || '请检查邮箱和密码');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = async (user: MockUser) => {
    setLoading(true);
    try {
      await mockLogin(user.email, '123456');
    } catch (err: any) {
      Alert.alert('快速登录失败', err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.logo}>🏠</Text>
          <Text style={styles.title}>租务管家</Text>
          <Text style={styles.subtitle}>NFC 考勤系统</Text>
          <View style={styles.modeBadge}>
            <Text style={styles.modeText}>
              {isMockMode ? '🧪 Mock 模式' : '🌐 正式模式（Supabase）'}
            </Text>
          </View>
        </View>

        {/* Login form */}
        <View style={styles.form}>
          <Text style={styles.formTitle}>登录</Text>

          <TextInput
            style={styles.input}
            placeholder="邮箱"
            placeholderTextColor="#9ca3af"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoCorrect={false}
          />

          <TextInput
            style={styles.input}
            placeholder="密码"
            placeholderTextColor="#9ca3af"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <TouchableOpacity
            style={[styles.loginButton, loading && styles.disabledButton]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.loginButtonText}>登录</Text>
            )}
          </TouchableOpacity>

          {!isMockMode && (
            <Text style={styles.hintText}>使用您的 Supabase 账号登录</Text>
          )}
        </View>

        {/* Quick login list (mock mode only) */}
        {isMockMode && mockUsers.length > 0 && (
          <View style={styles.quickLogin}>
            <Text style={styles.quickLoginTitle}>快速登录（Mock 演示用户）</Text>
            <Text style={styles.quickLoginHint}>密码均为 123456，管理员密码为 admin123</Text>
            {mockUsers.map(user => (
              <TouchableOpacity
                key={user.id}
                style={styles.userCard}
                onPress={() => handleQuickLogin(user)}
                disabled={loading}
              >
                <View
                  style={[
                    styles.roleBadge,
                    { backgroundColor: ROLE_COLORS[user.role] || '#6b7280' },
                  ]}
                >
                  <Text style={styles.roleBadgeText}>
                    {ROLE_LABELS[user.role] || user.role}
                  </Text>
                </View>
                <View style={styles.userInfo}>
                  <Text style={styles.userName}>{user.name}</Text>
                  <Text style={styles.userEmail}>{user.email}</Text>
                  {user.department && (
                    <Text style={styles.userDept}>{user.department}</Text>
                  )}
                </View>
                <Text style={styles.arrowText}>›</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Fallback quick-login if backend not available yet */}
        {isMockMode && mockUsers.length === 0 && (
          <View style={styles.quickLogin}>
            <Text style={styles.quickLoginTitle}>快速登录（演示）</Text>
            {[
              { email: 'zhangsan@demo.com', name: '张三 - 经纪人', role: 'AGENT' },
              { email: 'lisi@demo.com', name: '李四 - 租户管家', role: 'HOUSE_MANAGER' },
              { email: 'admin@demo.com', name: '管理员', role: 'ADMIN' },
            ].map(u => (
              <TouchableOpacity
                key={u.email}
                style={styles.userCard}
                onPress={() => {
                  setEmail(u.email);
                  setPassword(u.role === 'ADMIN' ? 'admin123' : '123456');
                }}
                disabled={loading}
              >
                <View
                  style={[
                    styles.roleBadge,
                    { backgroundColor: ROLE_COLORS[u.role] || '#6b7280' },
                  ]}
                >
                  <Text style={styles.roleBadgeText}>{ROLE_LABELS[u.role]}</Text>
                </View>
                <View style={styles.userInfo}>
                  <Text style={styles.userName}>{u.name}</Text>
                  <Text style={styles.userEmail}>{u.email}</Text>
                </View>
                <Text style={styles.arrowText}>填入</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#f5f5f5' },
  container: { flexGrow: 1, paddingBottom: 40 },
  header: {
    backgroundColor: '#3b82f6',
    paddingTop: 60,
    paddingBottom: 30,
    alignItems: 'center',
  },
  logo: { fontSize: 56, marginBottom: 8 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#fff' },
  subtitle: { fontSize: 16, color: 'rgba(255,255,255,0.8)', marginTop: 4 },
  modeBadge: {
    marginTop: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  modeText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  form: {
    margin: 16,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  formTitle: { fontSize: 20, fontWeight: 'bold', color: '#333', marginBottom: 16 },
  input: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#333',
    marginBottom: 12,
    backgroundColor: '#fafafa',
  },
  loginButton: {
    backgroundColor: '#3b82f6',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  disabledButton: { backgroundColor: '#9ca3af' },
  loginButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  hintText: { textAlign: 'center', color: '#9ca3af', fontSize: 13, marginTop: 12 },
  quickLogin: {
    margin: 16,
    marginTop: 0,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  quickLoginTitle: { fontSize: 16, fontWeight: 'bold', color: '#333', marginBottom: 4 },
  quickLoginHint: { fontSize: 12, color: '#9ca3af', marginBottom: 12 },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  roleBadge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginRight: 10,
    minWidth: 64,
    alignItems: 'center',
  },
  roleBadgeText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  userInfo: { flex: 1 },
  userName: { fontSize: 15, fontWeight: '600', color: '#333' },
  userEmail: { fontSize: 12, color: '#6b7280', marginTop: 1 },
  userDept: { fontSize: 11, color: '#9ca3af', marginTop: 1 },
  arrowText: { fontSize: 14, color: '#9ca3af', fontWeight: '600' },
});
