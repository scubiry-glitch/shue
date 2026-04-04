# 🏠 租务管家 NFC 考勤系统 Demo

基于 `/proweb/run/shue/docs/prd/` 下的架构设计和数据库文档开发的演示项目。

## 📁 项目结构

```
demo/
├── backend/          # NestJS 后端服务
│   ├── src/
│   │   ├── attendance/       # 考勤模块
│   │   │   ├── attendance.controller.ts
│   │   │   ├── attendance.service.ts
│   │   │   ├── attendance-record.entity.ts
│   │   │   ├── nfc-tag.entity.ts
│   │   │   ├── dto.ts
│   │   │   └── attendance.module.ts
│   │   ├── app.module.ts
│   │   └── main.ts
│   └── package.json
│
├── mobile/           # React Native 移动端
│   ├── src/
│   │   ├── api/              # API 服务
│   │   ├── screens/          # 页面组件
│   │   └── utils/            # 工具函数
│   ├── App.tsx
│   └── package.json
│
├── database/         # 数据库脚本
│   └── init.sql              # 初始化SQL
│
└── package.json      # 项目根配置
```

## 🚀 快速启动

### 1. 启动数据库

```bash
# 使用 Docker 启动 PostgreSQL
docker run -d \
  --name nfc-postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=nfc_attendance \
  -p 5432:5432 \
  postgis/postgis:15-3.3

# 初始化数据库表
cd /proweb/run/shue/demo/database
psql -h localhost -U postgres -d nfc_attendance -f init.sql
```

### 2. 启动后端服务

```bash
cd /proweb/run/shue/demo/backend

# 安装依赖
npm install

# 启动开发服务
npm run start:dev
```

后端服务将在 http://localhost:3001 启动
API 文档: http://localhost:3001/api-docs

### 3. 启动移动端（可选）

```bash
cd /proweb/run/shue/demo/mobile

# 安装依赖
npm install

# iOS
npx react-native run-ios

# Android
npx react-native run-android
```

## 📡 API 接口

### 核心接口

| 接口 | 方法 | 描述 |
|-----|-----|-----|
| `/attendance/checkin` | POST | NFC打卡签到 |
| `/attendance/checkout` | POST | 签退 |
| `/attendance/records` | GET | 查询打卡记录 |
| `/attendance/stats/today` | GET | 今日统计 |
| `/attendance/nfc-tags` | GET | 获取NFC标签列表 |

### 打卡请求示例

```json
{
  "nfcTagId": "house_001_shanghai",
  "userId": "user_001",
  "userName": "张三",
  "recordType": "CHECK_IN",
  "gpsLat": 31.2305,
  "gpsLng": 121.4738,
  "gpsAccuracy": 8.5,
  "deviceId": "demo_device_001",
  "deviceModel": "iPhone 14 Pro",
  "photos": []
}
```

## 📊 功能演示

### 1. 模拟NFC打卡
- 点击"模拟 NFC 打卡"按钮
- 系统随机选择一个房源NFC标签
- 自动计算GPS偏差和质量评分
- 检测异常（如GPS偏差过大）

### 2. 质量评分算法
- 基础分: 100分
- GPS精度优秀(<10m): +20分
- 距离偏差小(<50m): +10分
- GPS偏差>100m: -30分

### 3. 异常检测
- GPS偏差超过100米 → 标记为可疑
- 停留时间少于5分钟 → 标记为异常
- GPS精度差(>500m) → 警告

## 📱 移动端功能

- 📊 实时查看今日统计
- 📱 模拟NFC打卡（演示用）
- 📋 查看打卡记录
- ✅ 签退功能
- ⚠️ 异常提醒

## 🗄️ 数据库表

| 表名 | 说明 |
|-----|-----|
| `nfc_tags` | NFC标签信息 |
| `attendance_records` | 打卡记录 |
| `user_daily_stats` | 用户每日统计 |
| `device_bindings` | 设备绑定 |

## 🛠️ 技术栈

- **后端**: NestJS + TypeORM + PostgreSQL
- **移动端**: React Native + TypeScript
- **地图**: PostGIS 地理空间扩展

## 📝 开发计划

- [x] 后端API开发
- [x] 数据库设计
- [x] 移动端界面
- [ ] 真实NFC读取（需真机）
- [ ] GPS实时定位
- [ ] 消息推送
- [ ] 绩效计算服务

---

**注意**: 这是一个演示项目，部分功能使用模拟数据。生产环境需要接入真实的NFC SDK和GPS定位服务。
