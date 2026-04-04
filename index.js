require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3005;

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 静态文件服务
app.use(express.static(path.join(__dirname, 'public')));

// 健康检查
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'shue-floorplan',
    timestamp: new Date().toISOString()
  });
});

// API 路由
app.get('/api/floorplan', (req, res) => {
  res.json({ 
    message: '上海UE 平面图服务',
    version: '1.0.0'
  });
});

// 启动服务
app.listen(PORT, () => {
  console.log(`🚀 上海UE 平面图服务已启动`);
  console.log(`📍 端口: ${PORT}`);
  console.log(`🌐 地址: http://localhost:${PORT}`);
});

module.exports = app;
