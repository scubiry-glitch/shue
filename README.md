# 上海UE - 平面图服务

## 项目简介

上海UE 平面图服务，独立部署的项目。

## 目录结构

```
/proweb/run/shue/
├── docs/prd/          # PRD 文档
├── public/            # 静态资源
├── index.js           # 入口文件
├── package.json       # 依赖配置
├── .env               # 环境变量
└── README.md          # 项目说明
```

## 快速开始

```bash
# 安装依赖
npm install

# 开发模式
npm run dev

# 生产模式
npm start
```

## 配置

创建 `.env` 文件：

```
PORT=3005
NODE_ENV=production
```

## 服务信息

- **端口**: 3005
- **PM2 名称**: floorplan
- **健康检查**: GET /health
