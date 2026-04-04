# 租务管家 NFC 考勤系统 - 数据库设计文档

> 文档版本: v1.0  
> 创建日期: 2025-04-03

---

## 1. 数据库选型

- **主数据库**: PostgreSQL 15+
- **扩展**: PostGIS (地理空间数据)
- **分表策略**: 按月份对 attendance_records 进行分区

---

## 2. 核心表结构

### 2.1 NFC 标签表 (nfc_tags)

```sql
CREATE TABLE nfc_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tag_id VARCHAR(64) UNIQUE NOT NULL COMMENT 'NFC芯片唯一ID',
    tag_type VARCHAR(20) NOT NULL COMMENT '标签类型: HOUSE-房源, OFFICE-门店',
    house_id VARCHAR(64) COMMENT '关联房源ID (tag_type=HOUSE时)',
    office_id VARCHAR(64) COMMENT '关联门店ID (tag_type=OFFICE时)',
    location GEOGRAPHY(POINT, 4326) COMMENT '标签部署位置(WGS84坐标系)',
    address TEXT COMMENT '地址描述',
    status VARCHAR(20) DEFAULT 'ACTIVE' COMMENT '状态: ACTIVE, INACTIVE, LOST',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT chk_tag_type CHECK (tag_type IN ('HOUSE', 'OFFICE')),
    CONSTRAINT chk_status CHECK (status IN ('ACTIVE', 'INACTIVE', 'LOST'))
);

-- 索引
CREATE INDEX idx_nfc_tags_house_id ON nfc_tags(house_id);
CREATE INDEX idx_nfc_tags_office_id ON nfc_tags(office_id);
CREATE INDEX idx_nfc_tags_location ON nfc_tags USING GIST(location);
CREATE INDEX idx_nfc_tags_status ON nfc_tags(status);

COMMENT ON TABLE nfc_tags IS 'NFC标签信息表';
```

### 2.2 打卡记录表 (attendance_records)

```sql
-- 主表定义
CREATE TABLE attendance_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- 用户关联
    user_id VARCHAR(64) NOT NULL COMMENT '员工ID(飞书UserID)',
    user_name VARCHAR(64) COMMENT '员工姓名',
    department_id VARCHAR(64) COMMENT '部门ID',
    
    -- 打卡类型
    record_type VARCHAR(20) NOT NULL COMMENT '打卡类型: CHECK_IN/CHECK_OUT/INSPECT/SIGNING/OFFICE_IN/OFFICE_OUT',
    
    -- NFC信息
    nfc_tag_id VARCHAR(64) NOT NULL COMMENT 'NFC标签ID',
    nfc_verified BOOLEAN DEFAULT FALSE COMMENT 'NFC验证是否通过',
    nfc_location GEOGRAPHY(POINT, 4326) COMMENT 'NFC标签位置',
    
    -- GPS信息
    gps_location GEOGRAPHY(POINT, 4326) COMMENT 'GPS定位位置',
    gps_accuracy FLOAT COMMENT 'GPS精度(米)',
    gps_provider VARCHAR(20) COMMENT 'GPS提供者: GPS/NETWORK/BASE',
    
    -- 距离校验
    distance_meters FLOAT COMMENT 'NFC位置与GPS位置距离(米)',
    distance_valid BOOLEAN COMMENT '距离是否有效(<100米)',
    
    -- 时间信息
    check_in_time TIMESTAMP COMMENT '到达时间',
    check_out_time TIMESTAMP COMMENT '离开时间',
    duration_seconds INT COMMENT '停留时长(秒)',
    
    -- 照片验证
    photos JSONB DEFAULT '[]' COMMENT '照片列表 [{"url": "...", "type": "ENTRANCE/INTERIOR", "uploaded_at": "..."}]',
    
    -- 设备信息
    device_id VARCHAR(128) COMMENT '设备唯一标识',
    device_model VARCHAR(64) COMMENT '设备型号',
    os_version VARCHAR(32) COMMENT '操作系统版本',
    app_version VARCHAR(32) COMMENT 'APP版本',
    
    -- 业务关联
    house_id VARCHAR(64) COMMENT '房源ID',
    house_name VARCHAR(128) COMMENT '房源名称',
    customer_id VARCHAR(64) COMMENT '客户ID(带看时)',
    customer_name VARCHAR(64) COMMENT '客户姓名',
    appointment_id VARCHAR(64) COMMENT '预约ID',
    
    -- 数据质量评分
    quality_score INT DEFAULT 0 COMMENT '数据质量评分(0-150分)',
    
    -- 异常标记
    is_anomaly BOOLEAN DEFAULT FALSE COMMENT '是否异常',
    anomaly_type VARCHAR(32) COMMENT '异常类型: GPS_MISMATCH/SHORT_DURATION/NO_CHECKOUT/...',
    anomaly_reason TEXT COMMENT '异常原因描述',
    
    -- 状态
    status VARCHAR(20) DEFAULT 'VALID' COMMENT '状态: VALID有效, INVALID无效, SUSPECTED可疑',
    invalid_reason TEXT COMMENT '无效原因',
    
    -- 申诉信息
    appeal_status VARCHAR(20) COMMENT '申诉状态: NONE/PENDING/APPROVED/REJECTED',
    appeal_reason TEXT COMMENT '申诉理由',
    appeal_approved_by VARCHAR(64) COMMENT '申诉审批人',
    appeal_approved_at TIMESTAMP COMMENT '申诉审批时间',
    
    -- 元数据
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(64),
    updated_by VARCHAR(64)
) PARTITION BY RANGE (created_at);

-- 约束
ALTER TABLE attendance_records ADD CONSTRAINT chk_record_type 
    CHECK (record_type IN ('CHECK_IN', 'CHECK_OUT', 'INSPECT', 'SIGNING', 'OFFICE_IN', 'OFFICE_OUT'));
ALTER TABLE attendance_records ADD CONSTRAINT chk_status 
    CHECK (status IN ('VALID', 'INVALID', 'SUSPECTED'));
ALTER TABLE attendance_records ADD CONSTRAINT chk_appeal_status 
    CHECK (appeal_status IN ('NONE', 'PENDING', 'APPROVED', 'REJECTED'));

-- 分区表创建 (按月分区)
CREATE TABLE attendance_records_2025_04 PARTITION OF attendance_records
    FOR VALUES FROM ('2025-04-01') TO ('2025-05-01');
CREATE TABLE attendance_records_2025_05 PARTITION OF attendance_records
    FOR VALUES FROM ('2025-05-01') TO ('2025-06-01');
CREATE TABLE attendance_records_2025_06 PARTITION OF attendance_records
    FOR VALUES FROM ('2025-06-01') TO ('2025-07-01');

-- 索引
CREATE INDEX idx_attendance_user_created ON attendance_records(user_id, created_at);
CREATE INDEX idx_attendance_house_created ON attendance_records(house_id, created_at);
CREATE INDEX idx_attendance_type ON attendance_records(record_type);
CREATE INDEX idx_attendance_created ON attendance_records(created_at);
CREATE INDEX idx_attendance_nfc_tag ON attendance_records(nfc_tag_id);
CREATE INDEX idx_attendance_status ON attendance_records(status);
CREATE INDEX idx_attendance_is_anomaly ON attendance_records(is_anomaly) WHERE is_anomaly = TRUE;
CREATE INDEX idx_attendance_gps ON attendance_records USING GIST(gps_location);

COMMENT ON TABLE attendance_records IS '打卡记录主表';
```

### 2.3 用户每日统计表 (user_daily_stats)

```sql
CREATE TABLE user_daily_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(64) NOT NULL COMMENT '员工ID',
    user_name VARCHAR(64) COMMENT '员工姓名',
    department_id VARCHAR(64) COMMENT '部门ID',
    stats_date DATE NOT NULL COMMENT '统计日期',
    
    -- 考勤统计
    first_check_in TIMESTAMP COMMENT '首次打卡时间',
    last_check_out TIMESTAMP COMMENT '最后离开时间',
    office_hours FLOAT COMMENT 'office在岗时长(小时)',
    is_full_attendance BOOLEAN DEFAULT FALSE COMMENT '是否全勤',
    
    -- 带看统计
    showings_count INT DEFAULT 0 COMMENT '申报带看次数',
    verified_showings INT DEFAULT 0 COMMENT 'NFC验证通过次数',
    verification_rate FLOAT COMMENT '验证通过率',
    total_showing_duration INT COMMENT '总带看时长(分钟)',
    avg_showing_duration FLOAT COMMENT '平均带看时长(分钟)',
    
    -- 巡检统计
    inspections_count INT DEFAULT 0 COMMENT '巡检次数',
    inspection_coverage FLOAT COMMENT '巡检覆盖率',
    
    -- 签约统计
    signings_count INT DEFAULT 0 COMMENT '现场签约次数',
    
    -- 质量评分
    avg_quality_score FLOAT COMMENT '平均质量评分',
    min_quality_score INT COMMENT '最低质量评分',
    max_quality_score INT COMMENT '最高质量评分',
    
    -- 异常统计
    anomaly_count INT DEFAULT 0 COMMENT '异常次数',
    anomalies JSONB DEFAULT '[]' COMMENT '异常类型列表',
    
    -- 绩效系数(实时计算)
    coefficient_a FLOAT COMMENT '租务量系数A',
    coefficient_b FLOAT COMMENT '基础业务系数B',
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(user_id, stats_date)
);

-- 索引
CREATE INDEX idx_daily_stats_date ON user_daily_stats(stats_date);
CREATE INDEX idx_daily_stats_user ON user_daily_stats(user_id);
CREATE INDEX idx_daily_stats_dept_date ON user_daily_stats(department_id, stats_date);

COMMENT ON TABLE user_daily_stats IS '用户每日考勤统计';
```

### 2.4 绩效指标表 (performance_metrics)

```sql
CREATE TABLE performance_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(64) NOT NULL COMMENT '员工ID',
    user_name VARCHAR(64) COMMENT '员工姓名',
    department_id VARCHAR(64) COMMENT '部门ID',
    metric_period VARCHAR(7) NOT NULL COMMENT '考核周期(YYYY-MM)',
    
    -- 租务量系数A相关
    showing_records_total INT DEFAULT 0 COMMENT '申报带看总数',
    showing_records_verified INT DEFAULT 0 COMMENT 'NFC验证通过数',
    showing_verification_rate FLOAT COMMENT '验证通过率',
    total_showing_duration INT COMMENT '总带看时长(分钟)',
    coefficient_a_calculated FLOAT COMMENT '计算的系数A',
    
    -- 重点业务系数C相关
    inspections_planned INT DEFAULT 0 COMMENT '计划巡检次数',
    inspections_completed INT DEFAULT 0 COMMENT '实际完成次数',
    inspection_completion_rate FLOAT COMMENT '巡检完成率',
    target_signings INT DEFAULT 0 COMMENT '目标签约数',
    actual_signings INT DEFAULT 0 COMMENT '实际签约数',
    signing_rate FLOAT COMMENT '签约达成率',
    coefficient_c_calculated FLOAT COMMENT '计算的系数C',
    
    -- 基础业务系数B
    attendance_days INT DEFAULT 0 COMMENT '出勤天数',
    required_days INT DEFAULT 0 COMMENT '应出勤天数',
    late_days INT DEFAULT 0 COMMENT '迟到天数',
    early_leave_days INT DEFAULT 0 COMMENT '早退天数',
    coefficient_b_calculated FLOAT COMMENT '计算的系数B',
    
    -- 质量指标
    avg_quality_score FLOAT COMMENT '平均质量评分',
    complaint_count INT DEFAULT 0 COMMENT '有责客诉数',
    
    -- 最终得分
    total_score FLOAT COMMENT '月度得分 = 系数A排名×30 + 系数C排名×70（系数B为底线，不参与计分）',
    rank_percentile FLOAT COMMENT '百分位排名',
    rank_in_department INT COMMENT '部门内排名',
    
    -- 晋降级判定
    evaluation_result VARCHAR(20) COMMENT '评定结果: UPGRADE/MAINTAIN（降级由绩效提升管理制度独立触发，不由排名触发）',
    is_eligible_for_upgrade BOOLEAN DEFAULT FALSE COMMENT '是否符合升级条件',
    upgrade_blocking_reasons JSONB COMMENT '升级阻碍原因列表',
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(user_id, metric_period)
);

-- 索引
CREATE INDEX idx_metrics_period ON performance_metrics(metric_period);
CREATE INDEX idx_metrics_period_score ON performance_metrics(metric_period, total_score DESC);
CREATE INDEX idx_metrics_user ON performance_metrics(user_id);
CREATE INDEX idx_metrics_evaluation ON performance_metrics(metric_period, evaluation_result);

COMMENT ON TABLE performance_metrics IS '绩效指标月度数据';
```

### 2.5 设备绑定表 (device_bindings)

```sql
CREATE TABLE device_bindings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(64) NOT NULL COMMENT '员工ID',
    device_id VARCHAR(128) NOT NULL COMMENT '设备唯一标识',
    device_model VARCHAR(64) COMMENT '设备型号',
    device_name VARCHAR(64) COMMENT '设备名称',
    os_type VARCHAR(20) COMMENT '系统类型: iOS/Android',
    os_version VARCHAR(32) COMMENT '系统版本',
    
    -- 绑定信息
    bound_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '绑定时间',
    last_used_at TIMESTAMP COMMENT '最后使用时间',
    use_count INT DEFAULT 0 COMMENT '使用次数',
    
    -- 状态
    status VARCHAR(20) DEFAULT 'ACTIVE' COMMENT '状态: ACTIVE, REVOKED',
    revoked_at TIMESTAMP COMMENT '解绑时间',
    revoke_reason TEXT COMMENT '解绑原因',
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(user_id, device_id)
);

-- 索引
CREATE INDEX idx_device_user ON device_bindings(user_id);
CREATE INDEX idx_device_id ON device_bindings(device_id);

COMMENT ON TABLE device_bindings IS '用户设备绑定管理';
```

### 2.6 异常检测规则表 (anomaly_rules)

```sql
CREATE TABLE anomaly_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_code VARCHAR(32) UNIQUE NOT NULL COMMENT '规则编码',
    rule_name VARCHAR(64) NOT NULL COMMENT '规则名称',
    rule_type VARCHAR(32) NOT NULL COMMENT '规则类型: GPS/BEHAVIOR/TIME/DEVICE',
    
    -- 规则配置
    condition_config JSONB NOT NULL COMMENT '触发条件配置',
    severity VARCHAR(20) NOT NULL COMMENT '严重级别: LOW/MEDIUM/HIGH/CRITICAL',
    
    -- 处理方式
    action_type VARCHAR(32) COMMENT '处理动作: BLOCK/WARN/REQUIRE_VERIFY/NOTIFY',
    auto_process BOOLEAN DEFAULT FALSE COMMENT '是否自动处理',
    
    -- 状态
    status VARCHAR(20) DEFAULT 'ENABLED' COMMENT '状态: ENABLED/DISABLED',
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(64)
);

-- 插入默认规则
INSERT INTO anomaly_rules (rule_code, rule_name, rule_type, condition_config, severity, action_type) VALUES
('GPS_DISTANCE_500', 'GPS偏差过大(500米)', 'GPS', '{"max_distance": 500}', 'HIGH', 'BLOCK'),
('GPS_DISTANCE_100', 'GPS偏差警告(100米)', 'GPS', '{"max_distance": 100}', 'MEDIUM', 'REQUIRE_VERIFY'),
('DURATION_SHORT_5', '带看时间过短(5分钟)', 'TIME', '{"min_duration": 300}', 'MEDIUM', 'WARN'),
('CHECKIN_DUPLICATE_30', '重复打卡(30分钟)', 'BEHAVIOR', '{"min_interval": 1800}', 'LOW', 'BLOCK'),
('TIME_MIDNIGHT', '深夜打卡', 'TIME', '{"forbidden_hours": [0,1,2,3,4,5]}', 'MEDIUM', 'REQUIRE_VERIFY');

COMMENT ON TABLE anomaly_rules IS '异常检测规则配置';
```

---

## 3. 视图定义

### 3.1 今日考勤概览视图

```sql
CREATE VIEW v_today_attendance AS
SELECT 
    uds.user_id,
    uds.user_name,
    uds.department_id,
    uds.stats_date,
    uds.first_check_in,
    uds.last_check_out,
    uds.showings_count,
    uds.verified_showings,
    uds.anomaly_count,
    CASE 
        WHEN uds.first_check_in IS NULL THEN '未打卡'
        WHEN uds.anomaly_count > 0 THEN '异常'
        ELSE '正常'
    END as attendance_status
FROM user_daily_stats uds
WHERE uds.stats_date = CURRENT_DATE;
```

### 3.2 月度绩效排名视图

```sql
CREATE VIEW v_monthly_ranking AS
SELECT 
    pm.user_id,
    pm.user_name,
    pm.department_id,
    pm.metric_period,
    pm.total_score,
    pm.rank_percentile,
    pm.rank_in_department,
    pm.evaluation_result,
    -- dept_rank 仅供参考，非晋降级依据
    RANK() OVER (PARTITION BY pm.department_id, pm.metric_period ORDER BY pm.total_score DESC) as dept_rank,
    -- company_rank 为AM通排排名，晋降级以此为准（前20%升级）
    RANK() OVER (PARTITION BY pm.metric_period ORDER BY pm.total_score DESC) as company_rank
FROM performance_metrics pm
WHERE pm.metric_period = TO_CHAR(CURRENT_DATE, 'YYYY-MM');
```

---

## 4. 存储过程

### 4.1 每日统计汇总

```sql
CREATE OR REPLACE PROCEDURE sp_generate_daily_stats(p_date DATE)
LANGUAGE plpgsql
AS $$
DECLARE
    v_user RECORD;
BEGIN
    -- 清理已有数据
    DELETE FROM user_daily_stats WHERE stats_date = p_date;
    
    -- 为每个用户生成统计
    FOR v_user IN SELECT DISTINCT user_id FROM attendance_records WHERE DATE(created_at) = p_date
    LOOP
        INSERT INTO user_daily_stats (
            user_id, stats_date,
            first_check_in, last_check_out,
            showings_count, verified_showings,
            created_at
        )
        SELECT 
            v_user.user_id,
            p_date,
            MIN(CASE WHEN record_type = 'CHECK_IN' THEN check_in_time END),
            MAX(CASE WHEN record_type = 'CHECK_OUT' THEN check_out_time END),
            COUNT(CASE WHEN record_type = 'CHECK_IN' THEN 1 END),
            COUNT(CASE WHEN record_type = 'CHECK_IN' AND status = 'VALID' THEN 1 END),
            NOW()
        FROM attendance_records
        WHERE user_id = v_user.user_id
          AND DATE(created_at) = p_date;
    END LOOP;
END;
$$;
```

---

## 5. 数据保留策略

| 表名 | 保留期限 | 归档策略 |
|-----|---------|---------|
| attendance_records | 2年 | 超过2年归档到冷存储 |
| user_daily_stats | 3年 | - |
| performance_metrics | 永久 | - |
| device_bindings | 永久 | 撤销绑定后保留1年 |
