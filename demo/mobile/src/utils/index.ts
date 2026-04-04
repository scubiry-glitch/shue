// 工具函数

// 格式化时间
export const formatTime = (date: Date | string | null): string => {
  if (!date) return '-';
  const d = new Date(date);
  return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
};

// 格式化日期
export const formatDate = (date: Date | string | null): string => {
  if (!date) return '-';
  const d = new Date(date);
  return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
};

// 格式化时长
export const formatDuration = (seconds: number | null): string => {
  if (!seconds) return '-';
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}小时${mins}分钟`;
  }
  return `${mins}分钟`;
};

// 计算质量评分颜色
export const getScoreColor = (score: number): string => {
  if (score >= 120) return '#22c55e'; // 绿色-优秀
  if (score >= 80) return '#3b82f6';  // 蓝色-良好
  if (score >= 60) return '#f59e0b';  // 橙色-一般
  return '#ef4444'; // 红色-差
};

// 状态文字
export const getStatusText = (status: string): string => {
  const map: Record<string, string> = {
    'VALID': '✓ 有效',
    'INVALID': '✗ 无效',
    'SUSPECTED': '⚠ 可疑',
  };
  return map[status] || status;
};

// 打卡类型文字
export const getRecordTypeText = (type: string): string => {
  const map: Record<string, string> = {
    'CHECK_IN': '🏠 入室打卡',
    'CHECK_OUT': '👋 离开签退',
    'INSPECT': '🔍 巡检',
    'SIGNING': '✍️ 签约',
    'OFFICE_IN': '💼 上班打卡',
    'OFFICE_OUT': '🏃 下班签退',
  };
  return map[type] || type;
};

// 生成设备ID
export const generateDeviceId = (): string => {
  return `demo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};
