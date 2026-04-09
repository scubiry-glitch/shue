import { Injectable, NotFoundException, ForbiddenException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { Cron } from '@nestjs/schedule';
import { AttendanceRecord, RecordStatus, RecordType, SessionStatus } from './attendance-record.entity';
import { NfcTag, TagStatus, TagType } from './nfc-tag.entity';
import { CheckInDto, CheckOutDto } from './dto';
import { UserRole } from '../users/user.entity';
import { HouseService } from '../house/house.service';
import { getDemoNfcTagDef } from './demo-nfc-tags';

// ─── 业务规则常量 ──────────────────────────────────────────────────────────────

/** 每个任务类型的中文名 */
const TASK_NAMES: Record<string, string> = {
  EMPTY_VIEW: '空看', SHOWING: '带看', SIGNING: '签约', RENEWAL: '续约谈',
  INSPECTION: '房屋检修', CHECKIN_DELIVERY: '入住交付', CHECKOUT_INSPECTION: '退租验收',
  EMERGENCY_REPAIR: '紧急维修', CLEANING_CHECK: '保洁验收',
  PREPARE_OVERSEE: '整备监督', RENOVATION_CHECK: '装修验收',
  QUALITY_AUDIT: '质量巡检', VENDOR_SUPERVISE: '供应商监督',
};

/** 任务类型是否需要手动签退 */
const REQUIRE_CHECKOUT: Record<string, boolean> = {
  EMPTY_VIEW: false, SHOWING: true, SIGNING: false, RENEWAL: false,
  INSPECTION: true, CHECKIN_DELIVERY: true, CHECKOUT_INSPECTION: true,
  EMERGENCY_REPAIR: true, CLEANING_CHECK: false,
  PREPARE_OVERSEE: true, RENOVATION_CHECK: false, QUALITY_AUDIT: false, VENDOR_SUPERVISE: true,
};

/** 任务类型的最短合理停留秒数（低于此值判为异常） */
const TASK_MIN_DURATION: Record<string, number> = {
  EMPTY_VIEW: 5 * 60,        // 5min
  SHOWING: 20 * 60,          // 20min
  SIGNING: 30 * 60,          // 30min
  RENEWAL: 15 * 60,          // 15min
  INSPECTION: 15 * 60,       // 15min
  CHECKIN_DELIVERY: 30 * 60, // 30min
  CHECKOUT_INSPECTION: 20 * 60,
  EMERGENCY_REPAIR: 10 * 60,
  CLEANING_CHECK: 10 * 60,
  PREPARE_OVERSEE: 30 * 60,
  RENOVATION_CHECK: 20 * 60,
  QUALITY_AUDIT: 15 * 60,
  VENDOR_SUPERVISE: 30 * 60,
  DEFAULT: 5 * 60,
};

/** 任务类型最长合理停留秒数（超过此值触发「停留过长」预警） */
const TASK_MAX_DURATION: Record<string, number> = {
  EMPTY_VIEW: 2 * 3600,
  SHOWING: 3 * 3600,
  SIGNING: 4 * 3600,
  DEFAULT: 8 * 3600,
};

/** 任务类型的最少照片要求 */
const TASK_MIN_PHOTOS: Record<string, number> = {
  INSPECTION: 3,
  CHECKIN_DELIVERY: 5,
  CHECKOUT_INSPECTION: 5,
  EMERGENCY_REPAIR: 2,
  CLEANING_CHECK: 2,
  RENOVATION_CHECK: 4,
  QUALITY_AUDIT: 3,
  DEFAULT: 0,
};

/** 角色允许的任务类型白名单 */
export const ROLE_TASK_WHITELIST: Record<string, string[]> = {
  [UserRole.AGENT]:           ['EMPTY_VIEW', 'SHOWING', 'SIGNING', 'RENEWAL'],
  [UserRole.HOUSE_MANAGER]:   ['INSPECTION', 'CHECKIN_DELIVERY', 'CHECKOUT_INSPECTION', 'EMERGENCY_REPAIR', 'CLEANING_CHECK'],
  [UserRole.ASSET_MANAGER]:   ['PREPARE_OVERSEE', 'RENOVATION_CHECK', 'QUALITY_AUDIT', 'VENDOR_SUPERVISE'],
  [UserRole.ACCOUNT_MANAGER]: ['EMPTY_VIEW', 'SHOWING'],
  [UserRole.ADMIN]:           Object.keys(TASK_NAMES), // 管理员无限制
};

/** 可疑时段：凌晨 0-6 点 */
const SUSPICIOUS_HOURS = [0, 1, 2, 3, 4, 5, 6];

@Injectable()
export class AttendanceService {
  private readonly logger = new Logger(AttendanceService.name);

  constructor(
    @InjectRepository(AttendanceRecord)
    private recordRepo: Repository<AttendanceRecord>,
    @InjectRepository(NfcTag)
    private nfcTagRepo: Repository<NfcTag>,
    private readonly houseService: HouseService,
  ) {}

  // ─── 工具方法 ────────────────────────────────────────────────────────────────

  /** 兼容 Date / 字符串时间戳，避免 .getTime 非函数导致 500 */
  private toTimeMs(value: Date | string | null | undefined): number | null {
    if (value == null) return null;
    const t = value instanceof Date ? value.getTime() : new Date(value as string).getTime();
    return Number.isNaN(t) ? null : t;
  }

  /** Haversine 距离（米） */
  calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  // ─── BL-2：质量评分（多维度业务语义）────────────────────────────────────────

  calculateQualityScore(record: AttendanceRecord, historicalAnomalyRate = 0): number {
    let score = 100;
    const taskType = record.taskType || 'DEFAULT';

    // ① GPS 精度
    if (record.gpsAccuracy != null) {
      if (record.gpsAccuracy < 10) score += 20;
      else if (record.gpsAccuracy < 30) score += 10;
      else if (record.gpsAccuracy > 100) score -= 20;
    }

    // ② GPS 距离偏差
    if (record.distanceValid === false) score -= 30;
    else if (record.distanceMeters != null && record.distanceMeters < 50) score += 10;

    // ③ 停留时长合理性（签退后才能评估）
    if (record.durationSeconds != null) {
      const minDur = TASK_MIN_DURATION[taskType] ?? TASK_MIN_DURATION.DEFAULT;
      if (record.durationSeconds < minDur) {
        score -= 15;
      } else {
        score += 15; // 达到最短停留，加分
      }
    }

    // ④ 照片数量达标
    const minPhotos = TASK_MIN_PHOTOS[taskType] ?? TASK_MIN_PHOTOS.DEFAULT;
    const photoCount = record.photos?.length ?? 0;
    if (minPhotos > 0) {
      if (photoCount >= minPhotos) score += 10;
      else score -= 10 * (1 - photoCount / minPhotos); // 按比例扣分
    } else if (photoCount > 0) {
      score += 5; // 非必须但有照片，少量加分
    }

    // ⑤ 任务数据完整性（taskData 里的必填字段）
    if (record.taskData && typeof record.taskData === 'object') {
      const fields = Object.keys(record.taskData);
      if (fields.length >= 3) score += 10;
      else if (fields.length >= 1) score += 5;
    }

    // ⑥ 历史异常率惩罚（近30天异常率 > 20%）
    if (historicalAnomalyRate > 0.2) score -= 10;
    if (historicalAnomalyRate > 0.4) score -= 10; // 双重惩罚

    // ⑦ 可疑时段（凌晨打卡）
    const hour = (record.checkInTime ?? new Date()).getHours();
    if (SUSPICIOUS_HOURS.includes(hour)) score -= 15;

    return Math.max(0, Math.min(150, Math.round(score)));
  }

  // ─── 异常检测（多规则） ────────────────────────────────────────────────────

  detectAnomaly(record: AttendanceRecord): { isAnomaly: boolean; type?: string; reason?: string } {
    // GPS 位置偏差
    if (record.distanceMeters != null && record.distanceMeters > 100) {
      return { isAnomaly: true, type: 'GPS_MISMATCH', reason: `GPS与NFC位置偏差 ${record.distanceMeters.toFixed(0)}m，超过100m阈值` };
    }
    // GPS 精度太差
    if (record.gpsAccuracy != null && record.gpsAccuracy > 500) {
      return { isAnomaly: true, type: 'GPS_POOR_ACCURACY', reason: `GPS精度 ${record.gpsAccuracy.toFixed(0)}m，定位不准确` };
    }
    // 停留过短（签退时检测）
    if (record.durationSeconds != null) {
      const minDur = TASK_MIN_DURATION[record.taskType ?? 'DEFAULT'] ?? TASK_MIN_DURATION.DEFAULT;
      if (record.durationSeconds < minDur) {
        return { isAnomaly: true, type: 'SHORT_DURATION', reason: `停留 ${Math.round(record.durationSeconds / 60)} 分钟，低于任务要求的 ${Math.round(minDur / 60)} 分钟` };
      }
      // 停留过长
      const maxDur = TASK_MAX_DURATION[record.taskType ?? 'DEFAULT'] ?? TASK_MAX_DURATION.DEFAULT;
      if (record.durationSeconds > maxDur) {
        return { isAnomaly: true, type: 'LONG_DURATION', reason: `停留 ${Math.round(record.durationSeconds / 3600)} 小时，超过该任务类型正常范围` };
      }
    }
    // 可疑时段
    const hour = (record.checkInTime ?? new Date()).getHours();
    if (SUSPICIOUS_HOURS.includes(hour)) {
      return { isAnomaly: true, type: 'SUSPICIOUS_TIME', reason: `凌晨 ${hour} 点打卡，属于非正常工作时段` };
    }
    return { isAnomaly: false };
  }

  // ─── 查询用户近30天异常率 ─────────────────────────────────────────────────

  private async getHistoricalAnomalyRate(userId: string): Promise<number> {
    const since = new Date();
    since.setDate(since.getDate() - 30);
    const [total, anomalies] = await Promise.all([
      this.recordRepo.count({ where: { userId } }),
      this.recordRepo.count({ where: { userId, isAnomaly: true } }),
    ]);
    return total > 0 ? anomalies / total : 0;
  }

  // ─── BL-1：检查是否有未关闭会话（同一用户 + 同一房源）────────────────────

  private async findOpenSession(userId: string, houseId: string): Promise<AttendanceRecord | null> {
    return this.recordRepo.findOne({
      where: {
        userId,
        houseId,
        sessionStatus: SessionStatus.OPEN,
        checkOutTime: IsNull(),
      },
    });
  }

  /** DB 优先；无记录时使用演示清单（与写卡 URL tag= 一致，免先 init） */
  async findNfcTagByIdOrDemo(tagId: string): Promise<NfcTag | null> {
    const row = await this.nfcTagRepo.findOne({ where: { tagId } });
    if (row) return row;
    const def = getDemoNfcTagDef(tagId);
    if (!def) return null;
    const t = new NfcTag();
    t.tagId = def.tagId;
    t.tagType = def.tagType === 'HOUSE' ? TagType.HOUSE : TagType.OFFICE;
    t.houseId = def.houseId ?? null;
    t.officeId = def.officeId ?? null;
    t.lat = def.lat;
    t.lng = def.lng;
    t.address = def.address;
    t.status = TagStatus.ACTIVE;
    return t;
  }

  // ─── 打卡 ──────────────────────────────────────────────────────────────────

  async checkIn(dto: CheckInDto): Promise<AttendanceRecord> {
    // ① 验证 NFC 标签（演示 tag 可仅存在于清单中）
    const nfcTag = await this.findNfcTagByIdOrDemo(dto.nfcTagId);
    if (!nfcTag) throw new NotFoundException('NFC标签未注册');

    // BL-7：标签生命周期检查
    if (nfcTag.status === TagStatus.SUSPENDED) {
      throw new BadRequestException('该房源 NFC 标签已暂停使用（房源空置或其他原因），请联系管理员');
    }
    const isLostTag = nfcTag.status === TagStatus.LOST;
    if (nfcTag.status !== TagStatus.ACTIVE && !isLostTag) {
      throw new BadRequestException(`NFC标签状态异常: ${nfcTag.status}`);
    }
    // 标签有效期检查
    if ((nfcTag as any).validUntil && new Date() > (nfcTag as any).validUntil) {
      throw new BadRequestException('NFC标签已过期，请联系管理员重新写卡');
    }

    // ② BL-3：角色-任务白名单校验
    if (dto.taskType && dto.role) {
      const allowed = ROLE_TASK_WHITELIST[dto.role] ?? [];
      if (!allowed.includes(dto.taskType)) {
        throw new ForbiddenException(
          `角色 ${dto.role} 不允许执行任务类型 ${dto.taskType}，允许的任务类型：${allowed.join(', ')}`,
        );
      }
    }

    // ③ BL-4：房源访问权限校验（ADMIN/ASSET_MANAGER 自动放行）
    if (nfcTag.houseId && dto.role) {
      await this.houseService.assertCanAccessHouse(
        dto.userId,
        dto.role as UserRole,
        (dto as any).departmentId,
        nfcTag.houseId,
      );
    }

    // ④ BL-1：防止同一用户在同一房源重复签到
    if (nfcTag.houseId) {
      const openSession = await this.findOpenSession(dto.userId, nfcTag.houseId);
      if (openSession) {
        throw new BadRequestException(
          `您在该房源已有未签退的记录（签到时间: ${openSession.checkInTime?.toLocaleString('zh-CN')}），请先签退再重新打卡`,
        );
      }
    }

    // ⑤ 创建记录
    const record = this.recordRepo.create({
      userId: dto.userId,
      userName: dto.userName,
      recordType: dto.recordType || RecordType.CHECK_IN,
      nfcTagId: dto.nfcTagId,
      nfcVerified: true,
      nfcLat: nfcTag.lat,
      nfcLng: nfcTag.lng,
      gpsLat: dto.gpsLat,
      gpsLng: dto.gpsLng,
      gpsAccuracy: dto.gpsAccuracy,
      deviceId: dto.deviceId,
      deviceModel: dto.deviceModel,
      houseId: nfcTag.houseId,
      houseName:
        getDemoNfcTagDef(dto.nfcTagId)?.name ||
        nfcTag.address ||
        (nfcTag.houseId ? `房源${nfcTag.houseId}` : null),
      checkInTime: new Date(),
      photos: dto.photos || [],
      role: dto.role || null,
      taskType: dto.taskType || null,
      taskName: dto.taskType ? (TASK_NAMES[dto.taskType] || dto.taskType) : null,
      requireCheckout: dto.taskType ? (REQUIRE_CHECKOUT[dto.taskType] ?? false) : false,
      taskData: dto.taskData || {},
      sessionStatus: SessionStatus.OPEN,
    });

    // ⑤ 计算距离
    if (dto.gpsLat && dto.gpsLng && nfcTag.lat && nfcTag.lng) {
      record.distanceMeters = this.calculateDistance(nfcTag.lat, nfcTag.lng, dto.gpsLat, dto.gpsLng);
      record.distanceValid = record.distanceMeters < 100;
    }

    // ⑥ 质量评分（带历史异常率）
    const anomalyRate = await this.getHistoricalAnomalyRate(dto.userId);
    record.qualityScore = this.calculateQualityScore(record, anomalyRate);

    // ⑦ 异常检测
    const anomaly = this.detectAnomaly(record);
    if (anomaly.isAnomaly) {
      record.isAnomaly = true;
      record.anomalyType = anomaly.type;
      record.anomalyReason = anomaly.reason;
      record.status = RecordStatus.SUSPECTED;
    }

    // LOST 标签额外标记
    if (isLostTag) {
      record.isAnomaly = true;
      record.anomalyType = 'LOST_TAG';
      record.anomalyReason = '使用了已标记遗失的NFC标签';
      record.status = RecordStatus.SUSPECTED;
    }

    return this.recordRepo.save(record);
  }

  // ─── 签退 ──────────────────────────────────────────────────────────────────

  async checkOut(dto: CheckOutDto, currentUserId?: string): Promise<AttendanceRecord> {
    const record = await this.recordRepo.findOne({ where: { id: dto.recordId } });
    if (!record) throw new NotFoundException('打卡记录不存在');
    if (currentUserId && record.userId !== currentUserId) {
      throw new ForbiddenException('无权操作他人的打卡记录');
    }
    if (record.sessionStatus !== SessionStatus.OPEN) {
      throw new BadRequestException(`该记录已${record.sessionStatus === SessionStatus.AUTO_CLOSED ? '被系统自动关闭' : '签退'}，不能重复操作`);
    }

    record.checkOutTime = new Date();
    record.sessionStatus = SessionStatus.CLOSED;

    if (dto.taskData) {
      record.taskData = { ...(record.taskData || {}), ...dto.taskData };
    }

    if (record.checkInTime) {
      record.durationSeconds = Math.floor(
        (record.checkOutTime.getTime() - record.checkInTime.getTime()) / 1000,
      );
    }

    if (dto.gpsLat && dto.gpsLng) {
      record.gpsLat = dto.gpsLat;
      record.gpsLng = dto.gpsLng;
      if (record.nfcLat && record.nfcLng) {
        record.distanceMeters = this.calculateDistance(
          record.nfcLat, record.nfcLng, dto.gpsLat, dto.gpsLng,
        );
      }
    }

    // 重新计算质量评分（停留时长已知）
    const anomalyRate = await this.getHistoricalAnomalyRate(record.userId);
    record.qualityScore = this.calculateQualityScore(record, anomalyRate);

    // 签退时的异常检测（停留时长/超长）
    const anomaly = this.detectAnomaly(record);
    if (anomaly.isAnomaly && !record.isAnomaly) {
      record.isAnomaly = true;
      record.anomalyType = anomaly.type;
      record.anomalyReason = anomaly.reason;
      record.status = RecordStatus.SUSPECTED;
    }

    return this.recordRepo.save(record);
  }

  // ─── BL-1：定时自动关闭未签退记录（每天 22:00）────────────────────────────

  @Cron('0 0 22 * * *')
  async autoCloseOpenSessions(): Promise<void> {
    this.logger.log('开始自动关闭超时未签退记录...');
    const openRecords = await this.recordRepo.find({
      where: { sessionStatus: SessionStatus.OPEN, checkOutTime: IsNull() },
    });

    let closed = 0;
    for (const record of openRecords) {
      const now = new Date();
      record.checkOutTime = now;
      record.sessionStatus = SessionStatus.AUTO_CLOSED;
      record.autoCloseReason = '系统在每日 22:00 自动关闭未签退记录';
      if (record.checkInTime) {
        record.durationSeconds = Math.floor((now.getTime() - record.checkInTime.getTime()) / 1000);
      }
      // 自动关闭的记录标记为可疑
      if (!record.isAnomaly) {
        record.isAnomaly = true;
        record.anomalyType = 'FORGOT_CHECKOUT';
        record.anomalyReason = '忘记签退，由系统在 22:00 自动关闭';
        record.status = RecordStatus.SUSPECTED;
      }
      await this.recordRepo.save(record);
      closed++;
    }
    this.logger.log(`自动关闭 ${closed} 条未签退记录`);
  }

  // ─── 查询 ─────────────────────────────────────────────────────────────────

  async getUserRecords(userId: string, startDate?: string, endDate?: string): Promise<AttendanceRecord[]> {
    const query = this.recordRepo.createQueryBuilder('r')
      .where('r.userId = :userId', { userId })
      .orderBy('r.createdAt', 'DESC');
    if (startDate) query.andWhere('r.createdAt >= :startDate', { startDate: new Date(startDate) });
    if (endDate) query.andWhere('r.createdAt <= :endDate', { endDate: new Date(endDate + 'T23:59:59') });
    return query.getMany();
  }

  async getTodayStats(userId: string): Promise<any> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const records = await this.recordRepo.createQueryBuilder('r')
      .where('r.userId = :userId', { userId })
      .andWhere('r.createdAt >= :today', { today })
      .getMany();

    const openCount = records.filter(r => r.sessionStatus === SessionStatus.OPEN).length;

    const checkInMs = records.map(r => this.toTimeMs(r.checkInTime)).filter((t): t is number => t != null);
    const checkOutMs = records.map(r => this.toTimeMs(r.checkOutTime)).filter((t): t is number => t != null);

    return {
      totalCheckIns: records.length,
      verifiedCount: records.filter(r => r.nfcVerified).length,
      anomalyCount: records.filter(r => r.isAnomaly).length,
      openSessionCount: openCount,
      avgQualityScore: records.length
        ? Math.round(records.reduce((s, r) => s + (r.qualityScore ?? 0), 0) / records.length)
        : 0,
      firstCheckIn: checkInMs.length ? new Date(Math.min(...checkInMs)) : null,
      lastCheckOut: checkOutMs.length ? new Date(Math.max(...checkOutMs)) : null,
    };
  }

  // ─── BL-6：当前在岗视图 ────────────────────────────────────────────────────

  async getOnDuty(userId?: string): Promise<any[]> {
    const query = this.recordRepo.createQueryBuilder('r')
      .where('r.sessionStatus = :status', { status: SessionStatus.OPEN })
      .andWhere('r.checkOutTime IS NULL')
      .orderBy('r.checkInTime', 'ASC');

    if (userId) query.andWhere('r.userId = :userId', { userId });

    const records = await query.getMany();
    const now = Date.now();

    return records.map(r => {
      const durationMinutes = r.checkInTime
        ? Math.floor((now - r.checkInTime.getTime()) / 60000)
        : 0;
      const maxDur = (TASK_MAX_DURATION[r.taskType ?? 'DEFAULT'] ?? TASK_MAX_DURATION.DEFAULT) / 60;
      return {
        recordId: r.id,
        userId: r.userId,
        userName: r.userName,
        houseId: r.houseId,
        houseName: r.houseName,
        taskType: r.taskType,
        taskName: r.taskName,
        checkInTime: r.checkInTime,
        durationMinutes,
        isOverdue: durationMinutes > maxDur,
        role: r.role,
      };
    });
  }

  // ─── NFC 标签管理 ──────────────────────────────────────────────────────────

  async getAllNfcTags(): Promise<NfcTag[]> {
    return this.nfcTagRepo.find({ where: { status: TagStatus.ACTIVE } });
  }

  async createNfcTag(tagData: Partial<NfcTag>): Promise<NfcTag> {
    const tag = this.nfcTagRepo.create(tagData);
    return this.nfcTagRepo.save(tag);
  }

  async findNfcTag(tagId: string): Promise<NfcTag | null> {
    return this.nfcTagRepo.findOne({ where: { tagId } });
  }

  async saveNfcTag(tag: NfcTag): Promise<NfcTag> {
    return this.nfcTagRepo.save(tag);
  }
}
