# 租务管家 NFC 考勤系统 - 待实现功能需求文档

> 文档版本: v1.0  
> 创建日期: 2025-04-04  
> 文档状态: 待开发

---

## 1. 真实 NFC 读取模块

### 1.1 功能概述
接入真实 NFC 硬件读取能力，支持 iOS 和 Android 双平台读取 NFC 标签信息。

### 1.2 技术方案
- **iOS**: Core NFC 框架（iOS 13+）
- **Android**: Android Beam / NDEF 技术
- **RN 库**: react-native-nfc-manager ^3.14

### 1.3 功能需求

#### 1.3.1 NFC 标签读取
```typescript
interface NfcReadResult {
  tagId: string;           // 标签唯一标识
  techTypes: string[];     // 支持的技术类型
  payload?: string;        // NDEF 消息内容
  timestamp: number;       // 读取时间戳
}
```

#### 1.3.2 读取流程
1. 用户点击"开始 NFC 打卡"按钮
2. 系统弹出 NFC 扫描提示框
3. 用户将手机靠近 NFC 标签（距离 < 4cm）
4. 读取成功后自动填充 `nfcTagId`
5. 同时获取当前 GPS 位置
6. 提交打卡请求

#### 1.3.3 错误处理
| 错误码 | 描述 | 处理方案 |
|--------|------|----------|
| NFC_NOT_SUPPORTED | 设备不支持 NFC | 提示用户更换设备 |
| NFC_DISABLED | NFC 功能被关闭 | 引导用户前往设置开启 |
| NFC_TIMEOUT | 扫描超时（30s） | 提示重新靠近标签 |
| NFC_INVALID_TAG | 标签未注册 | 提示"非本系统标签" |
| NFC_READ_FAILED | 读取失败 | 提示调整位置重试 |

### 1.4 界面设计
- 扫描中: 显示雷达动画 + "请将手机靠近 NFC 标签"
- 读取成功: 显示绿色对勾 + 标签编号
- 读取失败: 显示红色错误图标 + 错误信息 + 重试按钮

---

## 2. 实时 GPS 定位模块

### 2.1 功能概述
接入真实 GPS 定位能力，获取高精度地理位置信息用于位置校验。

### 2.2 技术方案
- **RN 库**: @react-native-community/geolocation ^3.0
- **权限**: iOS Location When In Use / Android FINE_LOCATION
- **精度配置**: enableHighAccuracy: true, timeout: 30000

### 2.3 功能需求

#### 2.3.1 定位参数
```typescript
interface GpsLocation {
  latitude: number;        // 纬度
  longitude: number;       // 经度
  accuracy: number;        // 精度（米）
  altitude?: number;       // 海拔（米）
  speed?: number;          // 速度（m/s）
  timestamp: number;       // 时间戳
}
```

#### 2.3.2 定位策略
1. **打卡前预定位**: 打开页面时获取一次位置，评估 GPS 信号质量
2. **打卡时精确定位**: NFC 读取成功后立即获取高精度位置
3. **定位超时**: 15 秒内未获取到位置则提示用户检查设置

#### 2.3.3 GPS 质量分级
| 等级 | 精度范围 | 颜色标识 | 说明 |
|------|----------|----------|------|
| 优秀 | < 10m | 🟢 绿色 | 可用于精确校验 |
| 良好 | 10-30m | 🟢 绿色 | 可用于校验 |
| 一般 | 30-100m | 🟡 黄色 | 建议到开阔地带 |
| 较差 | 100-500m | 🟠 橙色 | 可能定位在室内 |
| 极差 | > 500m | 🔴 红色 | 无法用于校验 |

### 2.4 异常处理
- GPS 未开启 → 引导用户开启定位
- 定位权限被拒绝 → 显示权限申请引导
- 长时间无信号 → 提示到室外/窗边重试

---

## 3. 照片上传模块

### 3.1 功能概述
支持现场拍照上传，作为打卡凭证和质量评分依据。

### 3.2 技术方案
- **RN 库**: react-native-image-picker ^7.0
- **存储**: 阿里云 OSS / AWS S3
- **压缩**: 上传前压缩至 1080p，单张 < 2MB

### 3.3 功能需求

#### 3.3.1 拍照场景
1. **签到拍照**: 到达目的地后拍摄房源/办公室现场照片
2. **工作过程拍照**: 可选，保洁/维修过程中的照片
3. **签退拍照**: 离开时拍摄完成情况照片

#### 3.3.2 照片规范
| 属性 | 要求 |
|------|------|
| 数量 | 签到至少 1 张，最多 9 张 |
| 分辨率 | 最小 720p，建议 1080p |
| 大小 | 单张 < 2MB |
| 格式 | JPG/PNG |
| 元数据 | 保留 EXIF（时间、GPS）|

#### 3.3.3 上传流程
```
拍照 → 本地预览 → 选择/重拍 → 压缩 → 上传 OSS → 返回 URL → 提交打卡
```

#### 3.3.4 数据结构
```typescript
interface Photo {
  url: string;             // OSS 访问地址
  thumbnailUrl: string;    // 缩略图地址
  width: number;           // 宽度
  height: number;          // 高度
  size: number;            // 文件大小
  takenAt: string;         // 拍摄时间（EXIF）
  exifLat?: number;        // 照片 GPS 纬度
  exifLng?: number;        // 照片 GPS 经度
}
```

### 3.4 界面设计
- 拍照按钮: 相机图标 + "拍摄现场照片"
- 照片预览: 缩略图网格，支持删除
- 上传进度: 进度条显示
- 上传失败: 显示重试按钮

---

## 4. 消息推送模块

### 4.1 功能概述
通过推送通知及时告知用户打卡状态、异常提醒和系统消息。

### 4.2 技术方案
- **iOS**: APNs (Apple Push Notification service)
- **Android**: FCM (Firebase Cloud Messaging)
- **RN 库**: @notifee/react-native ^7.0
- **推送平台**: 阿里云移动推送 / 极光推送

### 4.3 推送场景

| 场景 | 触发条件 | 推送内容 | 优先级 |
|------|----------|----------|--------|
| 打卡成功 | 签到/签退完成 | "✅ 打卡成功 - 静安区南京西路房源" | NORMAL |
| 打卡异常 | 检测到异常 | "⚠️ 打卡异常 - GPS 偏差过大，请检查" | HIGH |
| 未签退提醒 | 签入后 4 小时未签退 | "⏰ 提醒 - 您有未完成签退的打卡记录" | NORMAL |
| 每日汇总 | 每日 20:00 | "📊 今日考勤 - 打卡 3 次，平均评分 115" | LOW |
| 系统公告 | 后台发布 | 公告标题 + 摘要 | NORMAL |

### 4.4 推送数据结构
```typescript
interface PushPayload {
  type: 'CHECKIN_SUCCESS' | 'CHECKIN_ANOMALY' | 'CHECKOUT_REMIND' | 'DAILY_SUMMARY' | 'SYSTEM';
  title: string;
  body: string;
  data: {
    recordId?: string;
    userId: string;
    timestamp: string;
    [key: string]: any;
  };
}
```

### 4.5 本地通知
- 签入后 4 小时自动触发签退提醒
- 支持点击通知跳转对应页面

---

## 5. 绩效计算服务

### 5.1 功能概述
独立微服务，每日定时计算用户考勤绩效，生成多维度统计数据。

### 5.2 服务架构
- **服务名**: performance-service
- **端口**: 3002
- **框架**: NestJS + TypeORM
- **调度**: node-cron（每日 23:30 执行）

### 5.3 核心算法

#### 5.3.1 绩效系数 A（工作量系数）
```typescript
// 系数 A = 基础系数 + 房源类型加成 + 任务类型加成

const baseCoefficient = 1.0;

// 房源类型加成
const houseTypeBonus = {
  STANDARD: 0,      // 标准房源
  LUXURY: 0.2,      // 豪宅 +20%
  REMOTE: 0.15,     // 偏远地区 +15%
  DIFFICULT: 0.1,   // 难搞房源 +10%
};

// 任务类型加成
const taskBonus = {
  CLEANING: 0,      // 保洁
  MAINTENANCE: 0.1, // 维修 +10%
  SHOWING: 0.15,    // 带看 +15%
  SIGNING: 0.2,     // 签约 +20%
};
```

#### 5.3.2 绩效系数 B（质量系数）
```typescript
// 系数 B = GPS 质量系数 × 时间系数 × 照片系数

// GPS 质量系数
gpsQualityFactor = Math.min(qualityScore / 100, 1.2);  // 最高 1.2

// 时间系数（停留时长）
const durationFactor = {
  '<5min': 0.5,      // 异常，扣 50%
  '5-15min': 0.8,
  '15-30min': 1.0,   // 标准
  '30-60min': 1.1,
  '>60min': 1.15,    // 最高 1.15
};

// 照片系数
photoFactor = photoCount > 0 ? 1.05 : 1.0;  // 有照片 +5%
```

#### 5.3.3 绩效分计算
```typescript
// 单次打卡绩效分 = 基础分 × 系数 A × 系数 B
const baseScore = 100;
const performanceScore = baseScore * coefficientA * coefficientB;

// 日绩效总分 = Σ(单次绩效分) × 全勤系数
const attendanceBonus = isFullAttendance ? 1.1 : 1.0;
const dailyTotal = sum(scores) * attendanceBonus;
```

### 5.4 数据模型

#### 5.4.1 绩效记录表
```typescript
@Entity('performance_records')
class PerformanceRecord {
  id: string;
  userId: string;
  userName: string;
  statsDate: Date;
  
  // 工作量统计
  totalTasks: number;
  verifiedTasks: number;
  
  // 质量统计
  avgQualityScore: number;
  avgCoefficientA: number;
  avgCoefficientB: number;
  
  // 绩效分数
  totalScore: number;
  rankPercentile: number;  // 全公司排名百分比
  
  // 等级
  grade: 'S' | 'A' | 'B' | 'C' | 'D';
  
  createdAt: Date;
  updatedAt: Date;
}
```

#### 5.4.2 等级标准
| 等级 | 分数区间 | 说明 |
|------|----------|------|
| S | ≥ 120 | 卓越 |
| A | 100-119 | 优秀 |
| B | 80-99 | 良好 |
| C | 60-79 | 合格 |
| D | < 60 | 需改进 |

### 5.5 API 接口

```typescript
// 获取用户绩效统计
GET /performance/stats?userId=xxx&startDate=2025-04-01&endDate=2025-04-30

// 获取排行榜
GET /performance/rankings?date=2025-04-04&departmentId=xxx

// 获取绩效明细
GET /performance/details?userId=xxx&date=2025-04-04
```

---

## 6. 飞书集成模块

### 6.1 功能概述
与飞书开放平台深度集成，实现审批流同步、消息通知和考勤数据互通。

### 6.2 技术方案
- **SDK**: @larksuiteoapi/node-sdk ^1.0
- **接入方式**: 企业内部应用
- **权限**: 通讯录读取、审批、消息推送

### 6.3 集成功能

#### 6.3.1 用户同步
- 每日同步飞书用户到本系统
- 支持部门组织架构映射
- 离职用户自动停用

#### 6.3.2 审批流对接

**场景 1: 异常打卡申诉**
```
员工提交申诉 → 飞书审批 → 审批结果回调 → 更新打卡状态
```

**场景 2: 外勤申请**
```
飞书提交外勤申请 → 审批通过 → 本系统记录外勤权限 → 打卡时豁免 GPS 校验
```

**场景 3: 请假申请**
```
飞书请假审批通过 → 本系统标记请假日期 → 当日不计入考勤统计
```

#### 6.3.3 消息推送
通过飞书机器人推送：
- 打卡异常提醒
- 每日考勤汇总
- 绩效排名通知

#### 6.3.4 数据同步表
```typescript
@Entity('feishu_sync_records')
class FeishuSyncRecord {
  id: string;
  syncType: 'USER' | 'APPROVAL' | 'DEPARTMENT';
  feishuUserId: string;
  localUserId: string;
  syncData: JSON;
  syncStatus: 'SUCCESS' | 'FAILED';
  errorMessage?: string;
  syncedAt: Date;
}
```

### 6.4 API 设计

```typescript
// 飞书 webhook 回调
POST /webhooks/feishu/approval

// 手动触发用户同步
POST /feishu/sync-users

// 发送飞书消息
POST /feishu/send-message
```

---

## 7. 设备绑定管理模块

### 7.1 功能概述
管理用户设备绑定关系，支持多设备登录和设备安全管控。

### 7.2 功能需求

#### 7.2.1 设备注册
- 首次登录自动注册设备
- 限制最多绑定 3 台设备
- 超出限制需解绑旧设备

#### 7.2.2 设备列表管理
```typescript
interface DeviceInfo {
  deviceId: string;
  deviceModel: string;     // iPhone 14 Pro
  deviceName: string;      // 用户自定义名称
  osType: 'iOS' | 'Android';
  osVersion: string;
  boundAt: string;
  lastUsedAt: string;
  useCount: number;
  status: 'ACTIVE' | 'REVOKED';
}
```

#### 7.2.3 安全策略
| 策略 | 说明 |
|------|------|
| 设备上限 | 每个用户最多 3 台活跃设备 |
| 自动解绑 | 90 天未使用自动解绑 |
| 异常检测 | 新设备首次登录需短信验证 |
| 远程注销 | 用户可在其他设备上注销某设备 |

### 7.3 界面设计
- 设备列表页: 显示所有绑定设备
- 当前设备标识: 标记"当前使用"
- 解绑按钮: 点击后二次确认
- 设备详情: 显示绑定时间、最近使用

---

## 8. 实现优先级

### P0 - 核心功能（必须）
1. ✅ NFC 打卡签到/签退（已完成）
2. ✅ GPS 位置校验（已完成）
3. ✅ 异常检测（已完成）
4. 🔄 真实 NFC 读取
5. 🔄 实时 GPS 定位

### P1 - 重要功能（高优先级）
6. 🔄 照片上传
7. 🔄 消息推送
8. 🔄 设备绑定管理

### P2 - 增强功能（中优先级）
9. 🔄 绩效计算服务
10. 🔄 飞书集成

---

## 9. 开发计划

| 阶段 | 功能 | 预计工期 | 依赖 |
|------|------|----------|------|
| Phase 1 | 真实 NFC + GPS | 1 周 | 无 |
| Phase 2 | 照片上传 + 推送 | 1 周 | Phase 1 |
| Phase 3 | 设备管理 | 3 天 | Phase 1 |
| Phase 4 | 绩效服务 | 1 周 | Phase 2 |
| Phase 5 | 飞书集成 | 1 周 | Phase 4 |

---

*文档维护: 如有需求变更，请同步更新此文档*
