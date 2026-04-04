# NFC打卡环节 - 系统交互时序图

> 文档版本: v1.0
> 创建日期: 2025-04-04
> 关联文档: architecture.md, api.md, ui-design.md

---

## 1. 时序图

```
┌─────────┐          ┌──────────────┐          ┌──────────────┐          ┌──────────────┐
│  管家手机 │          │   H5 前端     │          │  NestJS 后端  │          │  PostgreSQL  │
│ (NFC硬件) │          │ /h5/index.html│          │ /attendance  │          │  nfc_attendance│
└────┬────┘          └──────┬───────┘          └──────┬───────┘          └──────┬───────┘
     │                      │                         │                         │
     │  ① 用户点击"开始扫描"  │                         │                         │
     │─────────────────────>│                         │                         │
     │                      │                         │                         │
     │  ② 手机NFC感应标签     │                         │                         │
     │  读取 tagId           │                         │                         │
     │─────────────────────>│                         │                         │
     │                      │                         │                         │
     │  ③ 浏览器获取GPS定位   │                         │                         │
     │  (gpsLat, gpsLng,    │                         │                         │
     │   gpsAccuracy)       │                         │                         │
     │<────────────────────>│                         │                         │
     │                      │                         │                         │
     │                      │  ④ POST /attendance/checkin                       │
     │                      │  {nfcTagId, userId,     │                         │
     │                      │   gpsLat, gpsLng,       │                         │
     │                      │   gpsAccuracy, deviceId,│                         │
     │                      │   deviceModel, photos[]}│                         │
     │                      │────────────────────────>│                         │
     │                      │                         │                         │
     │                      │                         │  ⑤ 验证NFC标签           │
     │                      │                         │  SELECT * FROM nfc_tags │
     │                      │                         │  WHERE tag_id = ?       │
     │                      │                         │  AND status = 'ACTIVE'  │
     │                      │                         │────────────────────────>│
     │                      │                         │<────────────────────────│
     │                      │                         │  返回 {lat, lng, ...}   │
     │                      │                         │                         │
     │                      │                         │  ⑥ 计算GPS距离           │
     │                      │                         │  calculateDistance(      │
     │                      │                         │    nfcTag.lat/lng,      │
     │                      │                         │    gps.lat/lng)         │
     │                      │                         │  → distanceMeters       │
     │                      │                         │  → distanceValid        │
     │                      │                         │    (<100m = true)       │
     │                      │                         │                         │
     │                      │                         │  ⑦ 质量评分              │
     │                      │                         │  calculateQualityScore()│
     │                      │                         │  基础100分               │
     │                      │                         │  +NFC验证(+30)          │
     │                      │                         │  +GPS精度(+20/-20)      │
     │                      │                         │  +距离偏差(+10/-30)     │
     │                      │                         │  +照片(+10)             │
     │                      │                         │  → 0~150分              │
     │                      │                         │                         │
     │                      │                         │  ⑧ 异常检测              │
     │                      │                         │  detectAnomaly()        │
     │                      │                         │  GPS>100m? → GPS_MISMATCH│
     │                      │                         │  精度>500m? → POOR_ACC  │
     │                      │                         │                         │
     │                      │                         │  ⑨ 写入打卡记录          │
     │                      │                         │  INSERT INTO            │
     │                      │                         │  attendance_records     │
     │                      │                         │  (质量分, 异常标记,      │
     │                      │                         │   status=VALID/SUSPECTED)│
     │                      │                         │────────────────────────>│
     │                      │                         │<────────────────────────│
     │                      │                         │  返回 record            │
     │                      │                         │                         │
     │                      │  ⑩ 返回打卡结果           │                         │
     │                      │  {id, qualityScore,     │                         │
     │                      │   isAnomaly, anomalyReason,                       │
     │                      │   distanceMeters, status}│                         │
     │                      │<────────────────────────│                         │
     │                      │                         │                         │
     │  ⑪ 显示打卡结果       │                         │                         │
     │  质量分 / 异常提示     │                         │                         │
     │<─────────────────────│                         │                         │
     │                      │                         │                         │
     │                      │                         │                         │
     │  ════════════ 签退流程 (用户离开房源后) ════════════                       │
     │                      │                         │                         │
     │  ⑫ 用户点击"签退"     │                         │                         │
     │─────────────────────>│                         │                         │
     │                      │                         │                         │
     │                      │  ⑬ POST /attendance/checkout                     │
     │                      │  {recordId, gpsLat, gpsLng}                      │
     │                      │────────────────────────>│                         │
     │                      │                         │                         │
     │                      │                         │  ⑭ 查找原记录            │
     │                      │                         │  SELECT * FROM          │
     │                      │                         │  attendance_records     │
     │                      │                         │  WHERE id = ?           │
     │                      │                         │────────────────────────>│
     │                      │                         │<────────────────────────│
     │                      │                         │                         │
     │                      │                         │  ⑮ 计算停留时长          │
     │                      │                         │  checkOutTime - checkInTime│
     │                      │                         │  → durationSeconds      │
     │                      │                         │                         │
     │                      │                         │  ⑯ 重新计算质量分        │
     │                      │                         │  + 检测停留<5min异常     │
     │                      │                         │  → SHORT_DURATION       │
     │                      │                         │                         │
     │                      │                         │  ⑰ 更新记录              │
     │                      │                         │  UPDATE attendance_records│
     │                      │                         │  SET checkOutTime,      │
     │                      │                         │      durationSeconds,   │
     │                      │                         │      qualityScore ...   │
     │                      │                         │────────────────────────>│
     │                      │                         │<────────────────────────│
     │                      │                         │                         │
     │                      │  ⑱ 返回签退结果           │                         │
     │                      │  {durationSeconds, ...} │                         │
     │                      │<────────────────────────│                         │
     │                      │                         │                         │
     │  ⑲ 显示停留时长       │                         │                         │
     │<─────────────────────│                         │                         │
     │                      │                         │                         │
```

---

## 2. 步骤详解

### 2.1 打卡流程 (①~⑪)

| 步骤 | 角色 | 对应代码 | 核心逻辑 |
|------|------|---------|---------|
| ① | 用户 → H5 | `H5 onclick="navigate('checkin')"` | 进入NFC打卡页面 |
| ② | NFC硬件 → H5 | 生产环境: Web NFC API / Native Bridge | 读取NFC标签物理ID (tagId) |
| ③ | 手机GPS → H5 | `navigator.geolocation.getCurrentPosition()` | 获取当前GPS坐标和精度 |
| ④ | H5 → 后端 | `POST /attendance/checkin` + CheckInDto | 提交打卡数据: tagId + GPS + 设备信息 + 照片 |
| ⑤ | 后端 → DB | `nfcTagRepo.findOne({ tagId })` | 校验标签存在且 status='ACTIVE'，获取标签坐标 |
| ⑥ | 后端内部 | `calculateDistance()` Haversine公式 | 计算GPS坐标与NFC标签坐标距离，<100m为valid |
| ⑦ | 后端内部 | `calculateQualityScore()` | 0-150分制评分（详见2.3节） |
| ⑧ | 后端内部 | `detectAnomaly()` | GPS>100m或精度>500m触发异常标记 |
| ⑨ | 后端 → DB | `recordRepo.save(record)` | 写入attendance_records表 |
| ⑩ | 后端 → H5 | HTTP 201 JSON Response | 返回完整打卡记录（含质量分、异常信息） |
| ⑪ | H5 → 用户 | `alert()` + UI更新 | 展示打卡结果、质量分、异常提示 |

### 2.2 签退流程 (⑫~⑲)

| 步骤 | 角色 | 对应代码 | 核心逻辑 |
|------|------|---------|---------|
| ⑫ | 用户 → H5 | 点击签退按钮 | 用户离开房源后手动签退 |
| ⑬ | H5 → 后端 | `POST /attendance/checkout` + CheckOutDto | 提交recordId + 当前GPS坐标 |
| ⑭ | 后端 → DB | `recordRepo.findOne({ id })` | 查找原始打卡记录 |
| ⑮ | 后端内部 | `checkOutTime - checkInTime` | 计算停留时长(秒) |
| ⑯ | 后端内部 | `calculateQualityScore()` + 时长异常检测 | 重新计算质量分，停留<300秒标记SHORT_DURATION异常 |
| ⑰ | 后端 → DB | `recordRepo.save(record)` | 更新记录: checkOutTime, durationSeconds, qualityScore |
| ⑱ | 后端 → H5 | HTTP 200 JSON Response | 返回更新后的完整记录 |
| ⑲ | H5 → 用户 | `alert()` + UI更新 | 展示停留时长 |

### 2.3 质量评分算法 (步骤⑦)

```
基础分: 100

+30  NFC验证通过 (nfc_verified = true)
+20  GPS精度优秀 (gpsAccuracy < 10m)
+10  GPS精度良好 (gpsAccuracy < 30m)
-20  GPS精度差   (gpsAccuracy > 100m)
+10  距离偏差小   (distanceMeters < 50m)
-30  距离偏差大   (distanceValid = false, >100m)
+10  上传了照片   (photos.length > 0)

最终分 = clamp(0, 150)
```

### 2.4 异常检测规则 (步骤⑧⑯)

| 检测点 | 触发条件 | 异常类型 | 打卡状态 |
|--------|---------|---------|---------|
| 打卡时 | GPS距离 > 100m | GPS_MISMATCH | SUSPECTED |
| 打卡时 | GPS精度 > 500m | GPS_POOR_ACCURACY | SUSPECTED |
| 签退时 | 停留时长 < 300秒(5分钟) | SHORT_DURATION | SUSPECTED |

---

## 3. 数据结构

### 3.1 打卡请求 (CheckInDto)

```typescript
{
  nfcTagId: string;      // NFC标签物理ID
  userId: string;        // 用户ID
  userName?: string;     // 用户姓名
  recordType: enum;      // CHECK_IN | INSPECT | SIGNING | OFFICE_IN
  gpsLat?: number;       // GPS纬度
  gpsLng?: number;       // GPS经度
  gpsAccuracy?: number;  // GPS精度(米)
  deviceId?: string;     // 设备唯一ID
  deviceModel?: string;  // 设备型号
  photos?: any[];        // 照片列表
}
```

### 3.2 打卡响应 (AttendanceRecord)

```typescript
{
  id: string;            // 记录UUID
  userId: string;
  recordType: string;
  nfcTagId: string;
  nfcVerified: boolean;  // NFC验证结果
  nfcLat: number;        // NFC标签坐标
  nfcLng: number;
  gpsLat: number;        // 打卡时GPS坐标
  gpsLng: number;
  gpsAccuracy: number;
  distanceMeters: number; // GPS与NFC标签距离
  distanceValid: boolean; // 距离是否合规(<100m)
  checkInTime: Date;
  checkOutTime?: Date;
  durationSeconds?: number;
  qualityScore: number;   // 0-150分
  isAnomaly: boolean;
  anomalyType?: string;   // GPS_MISMATCH | GPS_POOR_ACCURACY | SHORT_DURATION
  anomalyReason?: string;
  status: string;         // VALID | INVALID | SUSPECTED
  photos: any[];
  deviceId: string;
  deviceModel: string;
  houseName?: string;
  createdAt: Date;
}
```

### 3.3 签退请求 (CheckOutDto)

```typescript
{
  recordId: string;      // 原打卡记录ID
  gpsLat?: number;       // 签退时GPS纬度
  gpsLng?: number;       // 签退时GPS经度
}
```

---

## 4. 涉及数据库表

| 表名 | 读/写 | 用途 |
|------|-------|------|
| nfc_tags | 读 | 步骤⑤验证标签存在性和坐标 |
| attendance_records | 写 | 步骤⑨写入打卡记录，步骤⑰更新签退信息 |

---

## 5. 待补充环节

| 环节 | 当前状态 | 说明 |
|------|---------|------|
| **真实NFC读取** | 模拟数据 | 生产环境需接入 Web NFC API 或 Native Bridge，当前H5用随机选择标签模拟 |
| **照片上传** | 未实现 | DTO中有 photos[] 字段，但未实现 multipart 文件上传和存储 |
| **设备绑定校验** | 未实现 | deviceId 有传输但未与 device_bindings 表做绑定验证，非绑定设备应标记异常 |
| **重复打卡阻断** | 未实现 | 同房源30分钟内重复打卡应阻断（参考 anti-cheat.md） |
| **深夜打卡检测** | 未实现 | 0:00-5:00 打卡应标记异常并要求说明 |
| **GPS阻断(>500m)** | 未实现 | 当前仅标记异常，未阻断打卡提交 |
