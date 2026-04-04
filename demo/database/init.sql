-- =====================================================
-- 租务管家 NFC 考勤系统 - 数据库初始化脚本
-- =====================================================

-- 使用 uuid-ossp 扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- 1. NFC 标签表
-- =====================================================
CREATE TABLE IF NOT EXISTS nfc_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tag_id VARCHAR(64) UNIQUE NOT NULL,
    tag_type VARCHAR(20) NOT NULL DEFAULT 'HOUSE',
    house_id VARCHAR(64),
    office_id VARCHAR(64),
    lat FLOAT,
    lng FLOAT,
    address TEXT,
    status VARCHAR(20) DEFAULT 'ACTIVE',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT chk_tag_type CHECK (tag_type IN ('HOUSE', 'OFFICE')),
    CONSTRAINT chk_status CHECK (status IN ('ACTIVE', 'INACTIVE', 'LOST'))
);

CREATE INDEX IF NOT EXISTS idx_nfc_tags_tag_id ON nfc_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_nfc_tags_house_id ON nfc_tags(house_id);
CREATE INDEX IF NOT EXISTS idx_nfc_tags_status ON nfc_tags(status);

COMMENT ON TABLE nfc_tags IS 'NFC标签信息表';

-- =====================================================
-- 2. 打卡记录表
-- =====================================================
CREATE TABLE IF NOT EXISTS attendance_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(64) NOT NULL,
    user_name VARCHAR(64),
    record_type VARCHAR(20) NOT NULL DEFAULT 'CHECK_IN',
    nfc_tag_id VARCHAR(64) NOT NULL,
    nfc_verified BOOLEAN DEFAULT FALSE,
    nfc_lat FLOAT,
    nfc_lng FLOAT,
    gps_lat FLOAT,
    gps_lng FLOAT,
    gps_accuracy FLOAT,
    distance_meters FLOAT,
    distance_valid BOOLEAN,
    check_in_time TIMESTAMP,
    check_out_time TIMESTAMP,
    duration_seconds INT,
    photos JSONB DEFAULT '[]',
    device_id VARCHAR(128),
    device_model VARCHAR(64),
    house_id VARCHAR(64),
    house_name VARCHAR(128),
    quality_score INT DEFAULT 0,
    is_anomaly BOOLEAN DEFAULT FALSE,
    anomaly_type VARCHAR(32),
    anomaly_reason TEXT,
    status VARCHAR(20) DEFAULT 'VALID',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT chk_record_type CHECK (record_type IN ('CHECK_IN', 'CHECK_OUT', 'INSPECT', 'SIGNING', 'OFFICE_IN', 'OFFICE_OUT')),
    CONSTRAINT chk_status CHECK (status IN ('VALID', 'INVALID', 'SUSPECTED'))
);

CREATE INDEX IF NOT EXISTS idx_attendance_user_created ON attendance_records(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_attendance_nfc_tag ON attendance_records(nfc_tag_id);
CREATE INDEX IF NOT EXISTS idx_attendance_created ON attendance_records(created_at);
CREATE INDEX IF NOT EXISTS idx_attendance_status ON attendance_records(status);
CREATE INDEX IF NOT EXISTS idx_attendance_is_anomaly ON attendance_records(is_anomaly) WHERE is_anomaly = TRUE;

COMMENT ON TABLE attendance_records IS '打卡记录主表';

-- =====================================================
-- 3. 用户每日统计表
-- =====================================================
CREATE TABLE IF NOT EXISTS user_daily_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(64) NOT NULL,
    user_name VARCHAR(64),
    department_id VARCHAR(64),
    stats_date DATE NOT NULL,
    first_check_in TIMESTAMP,
    last_check_out TIMESTAMP,
    office_hours FLOAT,
    is_full_attendance BOOLEAN DEFAULT FALSE,
    showings_count INT DEFAULT 0,
    verified_showings INT DEFAULT 0,
    verification_rate FLOAT,
    total_showing_duration INT,
    avg_showing_duration FLOAT,
    inspections_count INT DEFAULT 0,
    signings_count INT DEFAULT 0,
    avg_quality_score FLOAT,
    min_quality_score INT,
    max_quality_score INT,
    anomaly_count INT DEFAULT 0,
    anomalies JSONB DEFAULT '[]',
    coefficient_a FLOAT,
    coefficient_b FLOAT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(user_id, stats_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_stats_date ON user_daily_stats(stats_date);
CREATE INDEX IF NOT EXISTS idx_daily_stats_user ON user_daily_stats(user_id);

COMMENT ON TABLE user_daily_stats IS '用户每日考勤统计';

-- =====================================================
-- 4. 设备绑定表
-- =====================================================
CREATE TABLE IF NOT EXISTS device_bindings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(64) NOT NULL,
    device_id VARCHAR(128) NOT NULL,
    device_model VARCHAR(64),
    device_name VARCHAR(64),
    os_type VARCHAR(20),
    os_version VARCHAR(32),
    bound_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_used_at TIMESTAMP,
    use_count INT DEFAULT 0,
    status VARCHAR(20) DEFAULT 'ACTIVE',
    revoked_at TIMESTAMP,
    revoke_reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(user_id, device_id)
);

CREATE INDEX IF NOT EXISTS idx_device_user ON device_bindings(user_id);
CREATE INDEX IF NOT EXISTS idx_device_id ON device_bindings(device_id);

COMMENT ON TABLE device_bindings IS '用户设备绑定管理';

-- =====================================================
-- 初始化演示数据
-- =====================================================

-- 插入演示NFC标签
INSERT INTO nfc_tags (tag_id, tag_type, house_id, lat, lng, address, status) VALUES
('house_001_shanghai', 'HOUSE', 'house_001', 31.2304, 121.4737, '上海市静安区南京西路1266号恒隆广场', 'ACTIVE'),
('house_002_shanghai', 'HOUSE', 'house_002', 31.2222, 121.4581, '上海市徐汇区淮海中路999号环贸广场', 'ACTIVE'),
('house_003_shanghai', 'HOUSE', 'house_003', 31.1956, 121.4365, '上海市长宁区虹桥路1号港汇恒隆', 'ACTIVE'),
('office_001_main', 'OFFICE', NULL, 31.2456, 121.5054, '上海市浦东新区陆家嘴环路1000号恒生银行大厦', 'ACTIVE')
ON CONFLICT (tag_id) DO NOTHING;

-- 插入演示打卡记录
INSERT INTO attendance_records (
    user_id, user_name, record_type, nfc_tag_id, nfc_verified, 
    nfc_lat, nfc_lng, gps_lat, gps_lng, gps_accuracy,
    distance_meters, distance_valid, check_in_time, check_out_time,
    house_id, house_name, quality_score, status
) VALUES
('user_001', '张三', 'CHECK_IN', 'house_001_shanghai', true,
 31.2304, 121.4737, 31.2305, 121.4738, 8.5,
 15.2, true, NOW() - INTERVAL '4 hours', NOW() - INTERVAL '2 hours',
 'house_001', '静安区南京西路房源', 125, 'VALID'),

('user_001', '张三', 'CHECK_IN', 'house_002_shanghai', true,
 31.2222, 121.4581, 31.2223, 121.4582, 12.0,
 18.5, true, NOW() - INTERVAL '1 hour', NULL,
 'house_002', '徐汇区淮海中路房源', 110, 'VALID')
ON CONFLICT DO NOTHING;

-- 插入演示用户统计
INSERT INTO user_daily_stats (
    user_id, user_name, stats_date, first_check_in, last_check_out,
    showings_count, verified_showings, verification_rate, avg_quality_score
) VALUES
('user_001', '张三', CURRENT_DATE, NOW() - INTERVAL '4 hours', NOW() - INTERVAL '2 hours',
 2, 2, 100.0, 117.5)
ON CONFLICT (user_id, stats_date) DO NOTHING;

-- 确认完成
SELECT '数据库初始化完成！' as status;
