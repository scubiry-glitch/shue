# API 接口设计文档

> 文档版本: v1.0  
> 创建日期: 2025-04-03

---

## 1. 接口规范

### 1.1 基础信息

- **Base URL**: `https://api.shue.example.com`
- **协议**: HTTPS
- **数据格式**: JSON
- **字符编码**: UTF-8
- **认证方式**: JWT Token (Header: `Authorization: Bearer {token}`)

### 1.2 响应格式

```json
{
  "code": 200,
  "message": "success",
  "data": { },
  "request_id": "req_abc123",
  "timestamp": 1712134567890
}
```

### 1.3 错误码定义

| 错误码 | 含义 | 说明 |
|-------|-----|------|
| 200 | 成功 | 请求处理成功 |
| 400 | 参数错误 | 请求参数不合法 |
| 401 | 未授权 | Token无效或过期 |
| 403 | 禁止访问 | 权限不足 |
| 404 | 资源不存在 | 请求的资源不存在 |
| 429 | 请求过于频繁 | 触发限流 |
| 500 | 服务器错误 | 内部服务器错误 |

---

## 2. 核心接口

### 2.1 NFC 打卡接口

#### POST /api/v1/attendance/checkin

**请求参数**:

| 参数名 | 类型 | 必填 | 说明 |
|-------|------|-----|------|
| nfc_tag_id | string | 是 | NFC标签ID |
| record_type | string | 是 | 打卡类型: CHECK_IN/CHECK_OUT/INSPECT/SIGNING/OFFICE_IN/OFFICE_OUT |
| gps_lat | number | 是 | GPS纬度 |
| gps_lng | number | 是 | GPS经度 |
| gps_accuracy | number | 否 | GPS精度(米) |
| photo_urls | array | 否 | 照片URL列表 |
| device_id | string | 是 | 设备唯一标识 |
| customer_id | string | 否 | 客户ID(带看时必填) |
| appointment_id | string | 否 | 预约ID |

**请求示例**:

```json
{
  "nfc_tag_id": "04:5A:12:F3:8E:2A:90",
  "record_type": "CHECK_IN",
  "gps_lat": 31.230416,
  "gps_lng": 121.473701,
  "gps_accuracy": 8.5,
  "photo_urls": [
    "https://oss.example.com/photos/001.jpg",
    "https://oss.example.com/photos/002.jpg"
  ],
  "device_id": "device_a1b2c3d4",
  "customer_id": "cust_xxx",
  "appointment_id": "appt_yyy"
}
```

**响应示例**:

```json
{
  "code": 200,
  "message": "打卡成功",
  "data": {
    "record_id": "rec_abc123",
    "check_in_time": "2025-04-03T14:30:00.000Z",
    "distance_meters": 45.2,
    "distance_valid": true,
    "quality_score": 95,
    "house_name": "阳光花园 3-201",
    "nfc_verified": true
  },
  "request_id": "req_def456"
}
```

**错误响应示例**:

```json
{
  "code": 400,
  "message": "打卡失败",
  "data": {
    "error_type": "GPS_MISMATCH",
    "distance_meters": 520,
    "max_allowed": 100,
    "suggestion": "请确认是否到达正确位置"
  }
}
```

---

### 2.2 查询打卡记录

#### GET /api/v1/attendance/records

**请求参数**:

| 参数名 | 类型 | 必填 | 说明 |
|-------|------|-----|------|
| user_id | string | 是 | 用户ID |
| start_date | string | 否 | 开始日期 (YYYY-MM-DD) |
| end_date | string | 否 | 结束日期 (YYYY-MM-DD) |
| record_type | string | 否 | 打卡类型筛选 |
| page | number | 否 | 页码，默认1 |
| page_size | number | 否 | 每页数量，默认20 |

**响应示例**:

```json
{
  "code": 200,
  "data": {
    "total": 156,
    "page": 1,
    "page_size": 20,
    "list": [
      {
        "id": "rec_abc123",
        "record_type": "CHECK_IN",
        "record_type_name": "到达房源",
        "house_name": "阳光花园 3-201",
        "check_in_time": "2025-04-03T14:30:00.000Z",
        "check_out_time": "2025-04-03T14:55:00.000Z",
        "duration_minutes": 25,
        "distance_meters": 45.2,
        "quality_score": 95,
        "status": "VALID",
        "photos": [
          { "url": "https://...", "type": "ENTRANCE" }
        ]
      }
    ]
  }
}
```

---

### 2.3 获取当前绩效数据

#### GET /api/v1/performance/current

**请求参数**:

| 参数名 | 类型 | 必填 | 说明 |
|-------|------|-----|------|
| user_id | string | 是 | 用户ID |
| period | string | 否 | 考核周期 (YYYY-MM)，默认为当前月 |

**响应示例**:

```json
{
  "code": 200,
  "data": {
    "user_id": "user_789",
    "user_name": "张三",
    "period": "2025-04",
    
    "coefficient_a": {
      "value": 0.85,
      "verified_showings": 18,
      "total_showings": 21,
      "target": 24,
      "progress": "75%"
    },
    
    "coefficient_b": {
      "value": 1.0,
      "qualified": true,
      "attendance_days": 22,
      "required_days": 22
    },
    
    "coefficient_c": {
      "value": 0.88,
      "inspection_completion_rate": 0.95,
      "signing_rate": 0.81
    },
    
    "ranking": {
      "percentile": 75.5,
      "company_rank": 15,
      "company_total": 56,
      "dept_rank": 8,
      "dept_total": 32,
      "upgrade_probability": "中",
      "evaluation": "MAINTAIN"
    },
    
    "warnings": [
      "本月带看次数低于目标",
      "巡检覆盖率需提升"
    ]
  }
}
```

**字段说明**:
- `coefficient_b.qualified`: 系数B是否达标（≥1.0），底线指标不参与计分
- `ranking.company_rank`/`company_total`: AM通排排名（晋降级依据），所有AM职级统一排名
- `ranking.dept_rank`/`dept_total`: 部门内排名，仅供参考
- `ranking.evaluation`: 仅输出 `UPGRADE`（前20%且满足前提条件）或 `MAINTAIN`。降级由绩效提升管理制度独立触发，不在此接口返回

---

### 2.4 获取异常预警

#### GET /api/v1/anomalies/detect

**请求参数**:

| 参数名 | 类型 | 必填 | 说明 |
|-------|------|-----|------|
| manager_id | string | 是 | 主管ID |
| date | string | 否 | 日期 (YYYY-MM-DD)，默认为今天 |
| severity | string | 否 | 严重级别筛选: LOW/MEDIUM/HIGH |

**响应示例**:

```json
{
  "code": 200,
  "data": {
    "total": 5,
    "high": 2,
    "medium": 2,
    "low": 1,
    "list": [
      {
        "id": "anom_001",
        "user_id": "user_001",
        "user_name": "张三",
        "anomaly_type": "GPS_MISMATCH",
        "anomaly_name": "GPS位置偏差过大",
        "severity": "HIGH",
        "description": "打卡位置与房源位置偏差520米",
        "record_id": "rec_abc",
        "occurred_at": "2025-04-03T14:30:00Z",
        "house_name": "阳光花园 3-201"
      }
    ]
  }
}
```

---

### 2.5 NFC 标签管理接口

#### POST /api/v1/admin/nfc-tags

**请求参数**:

| 参数名 | 类型 | 必填 | 说明 |
|-------|------|-----|------|
| tag_id | string | 是 | NFC芯片ID |
| tag_type | string | 是 | HOUSE/OFFICE |
| house_id | string | 条件 | 房源ID (tag_type=HOUSE时必填) |
| office_id | string | 条件 | 门店ID (tag_type=OFFICE时必填) |
| lat | number | 是 | 纬度 |
| lng | number | 是 | 经度 |
| address | string | 否 | 地址描述 |

---

#### GET /api/v1/admin/nfc-tags

**请求参数**:

| 参数名 | 类型 | 必填 | 说明 |
|-------|------|-----|------|
| status | string | 否 | ACTIVE/INACTIVE/ALL |
| tag_type | string | 否 | HOUSE/OFFICE |
| page | number | 否 | 页码 |
| page_size | number | 否 | 每页数量 |

---

### 2.6 设备绑定接口

#### POST /api/v1/devices/bind

**请求参数**:

| 参数名 | 类型 | 必填 | 说明 |
|-------|------|-----|------|
| device_id | string | 是 | 设备ID |
| device_model | string | 是 | 设备型号 |
| os_type | string | 是 | iOS/Android |
| os_version | string | 是 | 系统版本 |

**响应示例**:

```json
{
  "code": 200,
  "message": "设备绑定成功",
  "data": {
    "binding_id": "bind_001",
    "bound_at": "2025-04-03T10:00:00Z",
    "status": "ACTIVE"
  }
}
```

---

#### POST /api/v1/devices/unbind

**请求参数**:

| 参数名 | 类型 | 必填 | 说明 |
|-------|------|-----|------|
| device_id | string | 是 | 设备ID |
| reason | string | 否 | 解绑原因 |

---

### 2.7 申诉接口

#### POST /api/v1/appeals/submit

**请求参数**:

| 参数名 | 类型 | 必填 | 说明 |
|-------|------|-----|------|
| record_id | string | 是 | 打卡记录ID |
| reason | string | 是 | 申诉理由 |
| evidence_urls | array | 否 | 证据照片 |
| witness_id | string | 否 | 证明人ID |

---

#### GET /api/v1/appeals/list

**请求参数**:

| 参数名 | 类型 | 必填 | 说明 |
|-------|------|-----|------|
| status | string | 否 | PENDING/APPROVED/REJECTED/ALL |
| page | number | 否 | 页码 |

---

## 3. WebSocket 实时接口

### 3.1 连接地址

```
wss://api.shue.example.com/ws/attendance?token={jwt_token}
```

### 3.2 消息类型

#### 服务器推送 - 打卡成功

```json
{
  "type": "CHECKIN_SUCCESS",
  "data": {
    "record_id": "rec_001",
    "user_name": "张三",
    "house_name": "阳光花园 3-201",
    "check_in_time": "2025-04-03T14:30:00Z",
    "quality_score": 95
  }
}
```

#### 服务器推送 - 异常预警

```json
{
  "type": "ANOMALY_ALERT",
  "data": {
    "anomaly_id": "anom_001",
    "user_name": "张三",
    "anomaly_type": "GPS_MISMATCH",
    "severity": "HIGH",
    "description": "GPS位置偏差过大"
  }
}
```

---

## 4. 飞书回调接口

### 4.1 审批状态回调

#### POST /webhook/feishu/approval

**请求参数**:

```json
{
  "uuid": "uuid_xxx",
  "token": "token_xxx",
  "ts": "1234567890",
  "type": "approval_instance",
  "approval_instance": {
    "approval_code": "NFC_APPEAL_001",
    "instance_code": "inst_xxx",
    "status": "APPROVED",
    "form": {
      "record_id": "rec_xxx",
      "appeal_reason": "..."
    }
  }
}
```

### 4.2 用户变更回调

#### POST /webhook/feishu/user

**事件类型**:
- `user.added` - 新员工入职
- `user.deleted` - 员工离职
- `user.updated` - 员工信息变更

---

## 5. 限流规则

| 接口 | 限流规则 | 说明 |
|-----|---------|------|
| POST /attendance/checkin | 10次/分钟 | 打卡频率限制 |
| GET /attendance/records | 60次/分钟 | 查询限制 |
| 其他接口 | 100次/分钟 | 通用限制 |

---

## 6. 附录

### 6.1 打卡类型说明

| 类型 | 说明 | 使用场景 |
|-----|------|---------|
| CHECK_IN | 到达房源 | 带看到达 |
| CHECK_OUT | 离开房源 | 带看结束 |
| INSPECT | 房源巡检 | 定期巡检 |
| SIGNING | 现场签约 | 客户签约 |
| OFFICE_IN | 到店上班 | 办公室考勤 |
| OFFICE_OUT | 离店下班 | 办公室考勤 |

### 6.2 异常类型说明

| 类型 | 说明 | 处理方式 |
|-----|------|---------|
| GPS_MISMATCH | GPS位置偏差 | 要求拍照验证 |
| SHORT_DURATION | 停留时间过短 | 标记可疑 |
| NO_CHECKOUT | 未签退 | 自动计算时长 |
| DUPLICATE_CHECKIN | 重复打卡 | 拒绝重复记录 |
| ROBOT_PATTERN | 机器行为模式 | 人工审核 |
