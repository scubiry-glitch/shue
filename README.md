# 🏠 租务管家 NFC 考勤系统

[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)
[![NestJS](https://img.shields.io/badge/NestJS-10.0-red)](https://nestjs.com/)
[![React Native](https://img.shields.io/badge/React%20Native-0.73-blue)](https://reactnative.dev/)
[![License](https://img.shields.io/badge/license-MIT-yellow)](LICENSE)

> 基于 NFC 的多角色任务打卡系统，支持经纪人空看、租户管家检修、资管经理整备监督等业务场景

---

## 📖 项目简介

租务管家 NFC 考勤系统是一套面向房产租赁行业的移动考勤解决方案。通过手机 NFC 功能读取房源标签，结合 GPS 定位校验，实现多角色、多任务的精细化打卡管理。

### 核心场景

| 角色 | 典型任务 | 业务价值 |
|------|----------|----------|
| 👔 **经纪人** | 空看、带看、签约 | 统计房源热度，追踪经纪人活跃度 |
| 🔧 **租户管家** | 房屋检修、入住交付、退租验收 | 保障服务质量，记录工作轨迹 |
| 📊 **资管经理** | 整备监督、装修验收、质量巡检 | 把控整备进度，监督供应商 |

---

## ✨ 功能特性

### 核心功能
- 📱 **NFC 打卡** - 刷标签快速签到/签退
- 📍 **GPS 校验** - 位置偏差检测，防止作弊
- 📊 **质量评分** - 综合 GPS 精度、停留时长、照片等因素
- ⚠️ **异常检测** - 自动识别位置偏差、停留过短等可疑行为
- 📸 **照片上传** - 现场拍照存证
- 🔔 **消息推送** - 打卡状态实时通知

### 多角色支持
- ✅ 四角色体系：经纪人、租户管家、资管经理、客户经理
- ✅ 角色专属任务：每个角色配置不同的任务类型
- ✅ 自定义字段：支持文本、数字、多选等字段扩展
- ✅ 灵活签退：部分任务需签退，部分直接完成

### 统计报表
- 📈 **房源热度** - 查看每套房源的各角色访问情况
- 👥 **经纪人空看统计** - 追踪多少经纪人看过某房源
- 📋 **任务完成度** - 按角色/任务类型统计完成率
- ⏱️ **平均停留时长** - 分析各任务类型的耗时分布

---

## 🏗️ 系统架构

```
┌─────────────────────────────────────────────────────────────┐
│                        客户端层                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │  iOS App    │  │ Android App │  │      H5 页面         │ │
│  │  (RN)       │  │   (RN)      │  │   (管理后台)         │ │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘ │
└─────────┼────────────────┼────────────────────┼────────────┘
          │                │                    │
          └────────────────┴────────────────────┘
                             │
                    ┌────────▼────────┐
                    │   API Gateway   │
                    │    (NestJS)     │
                    │    :3001        │
                    └────────┬────────┘
                             │
┌────────────────────────────┼────────────────────────────────┐
│                       数据层 │                                │
│  ┌─────────────┐  ┌────────▼────────┐  ┌─────────────────┐ │
│  │  PostgreSQL │  │     Redis       │  │   阿里云 OSS    │ │
│  │  (主数据库)  │  │   (缓存/会话)    │  │   (照片存储)     │ │
│  └─────────────┘  └─────────────────┘  └─────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## 📁 目录结构

```
/proweb/run/shue/
├── 📄 index.js                    # Express 基础服务入口
├── 📄 package.json                # 依赖配置
├── 📄 README.md                   # 项目说明
│
├── 📁 demo/                       # 完整演示项目
│   ├── 📁 backend/                # NestJS 后端服务
│   │   ├── 📁 src/
│   │   │   ├── 📁 attendance/     # 考勤核心模块
│   │   │   ├── 📁 roles/          # 角色配置模块
│   │   │   ├── 📁 stats/          # 统计报表模块
│   │   │   ├── 📁 performance/    # 绩效计算模块
│   │   │   ├── 📁 appeal/         # 申诉模块
│   │   │   ├── 📁 notification/   # 消息通知模块
│   │   │   └── 📁 staff/          # 人员管理模块
│   │   ├── 📁 public/
│   │   │   ├── 📁 admin/          # 管理后台界面
│   │   │   └── 📁 h5/             # 移动端 H5 界面
│   │   └── 📄 package.json
│   │
│   ├── 📁 mobile/                 # React Native 移动端
│   │   ├── 📁 src/
│   │   │   ├── 📁 screens/        # 页面组件
│   │   │   ├── 📁 api/            # API 服务
│   │   │   └── 📁 utils/          # 工具函数
│   │   └── 📄 App.tsx
│   │
│   ├── 📁 database/               # 数据库脚本
│   │   └── 📄 init.sql            # 初始化 SQL
│   │
│   └── 📄 docker-compose.yml      # Docker 编排配置
│
└── 📁 docs/prd/                   # 需求文档
    ├── 📄 PRD1.1-multi-role-task.md   # 多角色需求文档 (v1.1)
    ├── 📄 todo-features.md            # 待实现功能文档
    ├── 📄 architecture.md             # 架构设计文档
    ├── 📄 database.md                 # 数据库设计文档
    ├── 📄 api.md                      # API 接口文档
    ├── 📄 ui-design.md                # UI 设计稿
    └── 📄 metrics.md                  # 指标定义文档
```

---

## 🚀 快速开始

### 环境要求

- Node.js >= 18.0.0
- PostgreSQL >= 15
- Redis >= 7 (可选，用于缓存)
- Docker & Docker Compose (推荐)

### 方式一: Docker 快速启动（推荐）

```bash
cd /proweb/run/shue/demo

# 启动所有服务
docker-compose up -d

# 初始化数据库
docker exec -i nfc-postgres psql -U postgres -d nfc_attendance < database/init.sql
```

服务启动后：
- API 服务: http://localhost:3001
- API 文档: http://localhost:3001/api-docs
- 管理后台: http://localhost:3001/admin

### 方式二: 本地开发

#### 1. 启动数据库

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

#### 2. 启动后端服务

```bash
cd /proweb/run/shue/demo/backend

# 安装依赖
npm install

# 配置环境变量
cp .env.example .env
# 编辑 .env 配置数据库连接

# 启动开发服务
npm run start:dev
```

#### 3. 启动移动端（可选）

```bash
cd /proweb/run/shue/demo/mobile

# 安装依赖
npm install

# iOS
npx react-native run-ios

# Android
npx react-native run-android
```

---

## 📡 API 接口

### 核心接口

| 接口 | 方法 | 描述 |
|------|------|------|
| `/health` | GET | 健康检查 |
| `/attendance/checkin` | POST | NFC 打卡签到 |
| `/attendance/checkout` | POST | 签退 |
| `/attendance/records` | GET | 查询打卡记录 |
| `/attendance/stats/today` | GET | 今日统计 |
| `/attendance/nfc-tags` | GET | 获取 NFC 标签列表 |

### 角色配置接口

| 接口 | 方法 | 描述 |
|------|------|------|
| `/roles/config` | GET | 获取角色及任务类型配置 |
| `/roles/task-types` | GET | 获取所有任务类型（扁平列表） |

### 统计报表接口

| 接口 | 方法 | 描述 |
|------|------|------|
| `/stats/house` | GET | 房源多角色打卡统计 |
| `/stats/empty-views` | GET | 经纪人空看统计 |
| `/stats/by-role` | GET | 按角色统计任务完成情况 |

详细 API 文档见 [docs/prd/api.md](docs/prd/api.md) 或启动服务后访问 `/api-docs`

---

## 🛠️ 技术栈

### 后端
- **框架**: [NestJS](https://nestjs.com/) 10.x
- **语言**: TypeScript 5.x
- **ORM**: TypeORM
- **数据库**: PostgreSQL 15 + PostGIS
- **缓存**: Redis 7
- **文档**: Swagger/OpenAPI

### 移动端
- **框架**: [React Native](https://reactnative.dev/) 0.73
- **语言**: TypeScript
- **导航**: React Navigation
- **NFC**: react-native-nfc-manager
- **定位**: @react-native-community/geolocation

### 运维
- **容器化**: Docker
- **编排**: Docker Compose
- **进程管理**: PM2

---

## 📊 数据模型

### 核心表

| 表名 | 说明 |
|------|------|
| `nfc_tags` | NFC 标签信息 |
| `attendance_records` | 打卡记录主表（支持多角色/多任务）|
| `user_daily_stats` | 用户每日统计 |
| `device_bindings` | 设备绑定管理 |

### 打卡记录字段

```typescript
{
  id: string;                    // 记录 ID
  userId: string;                // 用户 ID
  role: string;                  // 角色: AGENT | HOUSE_MANAGER | ASSET_MANAGER
  taskType: string;              // 任务类型: EMPTY_VIEW | SHOWING | INSPECTION...
  nfcTagId: string;              // NFC 标签 ID
  gpsLat: number;                // GPS 纬度
  gpsLng: number;                // GPS 经度
  gpsAccuracy: number;           // GPS 精度（米）
  distanceMeters: number;        // 与标签距离（米）
  qualityScore: number;          // 质量评分（0-150）
  isAnomaly: boolean;            // 是否异常
  taskData: JSON;                // 任务相关数据（自定义字段）
  checkInTime: Date;             // 签到时间
  checkOutTime: Date;            // 签退时间
  durationSeconds: number;       // 停留时长（秒）
  photos: string[];              // 照片 URL 列表
}
```

---

## 📝 文档

- [PRD 1.1 - 多角色多任务需求](docs/prd/PRD1.1-multi-role-task.md)
- [待实现功能清单](docs/prd/todo-features.md)
- [架构设计文档](docs/prd/architecture.md)
- [数据库设计](docs/prd/database.md)
- [API 接口文档](docs/prd/api.md)
- [UI 设计稿](docs/prd/ui-design.md)

---

## 🤝 贡献指南

1. Fork 本仓库
2. 创建特性分支: `git checkout -b feature/xxx`
3. 提交更改: `git commit -m 'feat: add xxx'`
4. 推送分支: `git push origin feature/xxx`
5. 提交 Pull Request

### 提交规范

- `feat:` 新功能
- `fix:` 修复 bug
- `docs:` 文档更新
- `style:` 代码格式调整
- `refactor:` 代码重构
- `test:` 测试相关
- `chore:` 构建/工具相关

---

## 📄 许可

[MIT](LICENSE) © 2025 租务管家团队

---

## 💬 联系我们

如有问题或建议，欢迎提交 Issue 或联系团队。

---

> 🚀 **当前版本**: v1.1  
> 📅 **最后更新**: 2025-04-04
