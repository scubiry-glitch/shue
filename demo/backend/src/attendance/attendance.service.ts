import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AttendanceRecord, RecordStatus, RecordType } from './attendance-record.entity';
import { NfcTag, TagStatus, TagType } from './nfc-tag.entity';
import { CheckInDto, CheckOutDto } from './dto';

@Injectable()
export class AttendanceService {
  constructor(
    @InjectRepository(AttendanceRecord)
    private recordRepo: Repository<AttendanceRecord>,
    @InjectRepository(NfcTag)
    private nfcTagRepo: Repository<NfcTag>,
  ) {}

  // 计算两点间距离（米）
  private calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371000; // 地球半径(米)
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  // 计算质量评分
  private calculateQualityScore(record: AttendanceRecord): number {
    let score = 100;
    
    // GPS精度评分
    if (record.gpsAccuracy) {
      if (record.gpsAccuracy < 10) score += 20;
      else if (record.gpsAccuracy < 30) score += 10;
      else if (record.gpsAccuracy > 100) score -= 20;
    }
    
    // 距离偏差评分
    if (record.distanceValid === false) score -= 30;
    else if (record.distanceMeters && record.distanceMeters < 50) score += 10;
    
    // 照片评分
    if (record.photos && record.photos.length > 0) score += 10;
    
    return Math.max(0, Math.min(150, score));
  }

  // 检测异常
  private detectAnomaly(record: AttendanceRecord): { isAnomaly: boolean; type?: string; reason?: string } {
    // GPS偏差超过100米
    if (record.distanceMeters && record.distanceMeters > 100) {
      return {
        isAnomaly: true,
        type: 'GPS_MISMATCH',
        reason: `GPS位置与NFC标签位置偏差 ${record.distanceMeters.toFixed(0)} 米，超过100米阈值`
      };
    }
    
    // GPS精度太差
    if (record.gpsAccuracy && record.gpsAccuracy > 500) {
      return {
        isAnomaly: true,
        type: 'GPS_POOR_ACCURACY',
        reason: `GPS精度 ${record.gpsAccuracy.toFixed(0)} 米，定位不准确`
      };
    }
    
    return { isAnomaly: false };
  }

  // 打卡
  async checkIn(dto: CheckInDto): Promise<AttendanceRecord> {
    // 验证NFC标签
    const nfcTag = await this.nfcTagRepo.findOne({ where: { tagId: dto.nfcTagId } });
    if (!nfcTag) {
      throw new NotFoundException('NFC标签未注册');
    }
    if (nfcTag.status !== 'ACTIVE') {
      throw new NotFoundException('NFC标签状态异常');
    }

    // 创建打卡记录
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
      houseName: nfcTag.houseId ? `房源${nfcTag.houseId}` : null,
      checkInTime: new Date(),
      photos: dto.photos || [],
    });

    // 计算距离
    if (dto.gpsLat && dto.gpsLng && nfcTag.lat && nfcTag.lng) {
      record.distanceMeters = this.calculateDistance(
        nfcTag.lat, nfcTag.lng, dto.gpsLat, dto.gpsLng
      );
      record.distanceValid = record.distanceMeters < 100;
    }

    // 计算质量评分
    record.qualityScore = this.calculateQualityScore(record);

    // 检测异常
    const anomaly = this.detectAnomaly(record);
    if (anomaly.isAnomaly) {
      record.isAnomaly = true;
      record.anomalyType = anomaly.type;
      record.anomalyReason = anomaly.reason;
      record.status = RecordStatus.SUSPECTED;
    }

    return this.recordRepo.save(record);
  }

  // 签退
  async checkOut(dto: CheckOutDto): Promise<AttendanceRecord> {
    const record = await this.recordRepo.findOne({ where: { id: dto.recordId } });
    if (!record) {
      throw new NotFoundException('打卡记录不存在');
    }

    record.checkOutTime = new Date();
    
    // 计算停留时长
    if (record.checkInTime) {
      record.durationSeconds = Math.floor(
        (record.checkOutTime.getTime() - record.checkInTime.getTime()) / 1000
      );
    }

    // 更新GPS位置
    if (dto.gpsLat && dto.gpsLng) {
      record.gpsLat = dto.gpsLat;
      record.gpsLng = dto.gpsLng;
      
      if (record.nfcLat && record.nfcLng) {
        record.distanceMeters = this.calculateDistance(
          record.nfcLat, record.nfcLng, dto.gpsLat, dto.gpsLng
        );
      }
    }

    // 重新计算质量评分
    record.qualityScore = this.calculateQualityScore(record);

    // 检测停留时间异常
    if (record.durationSeconds && record.durationSeconds < 300) { // 少于5分钟
      record.isAnomaly = true;
      record.anomalyType = 'SHORT_DURATION';
      record.anomalyReason = `停留时间仅 ${record.durationSeconds} 秒，少于5分钟`;
      record.status = RecordStatus.SUSPECTED;
    }

    return this.recordRepo.save(record);
  }

  // 获取用户打卡记录
  async getUserRecords(userId: string, startDate?: string, endDate?: string): Promise<AttendanceRecord[]> {
    const query = this.recordRepo.createQueryBuilder('record')
      .where('record.userId = :userId', { userId })
      .orderBy('record.createdAt', 'DESC');

    if (startDate) {
      query.andWhere('record.createdAt >= :startDate', { startDate: new Date(startDate) });
    }
    if (endDate) {
      query.andWhere('record.createdAt <= :endDate', { endDate: new Date(endDate + ' 23:59:59') });
    }

    return query.getMany();
  }

  // 获取今日统计
  async getTodayStats(userId: string): Promise<any> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const records = await this.recordRepo.createQueryBuilder('record')
      .where('record.userId = :userId', { userId })
      .andWhere('record.createdAt >= :today', { today })
      .getMany();

    const stats = {
      totalCheckIns: records.length,
      verifiedCount: records.filter(r => r.nfcVerified).length,
      anomalyCount: records.filter(r => r.isAnomaly).length,
      avgQualityScore: 0,
      firstCheckIn: null as Date | null,
      lastCheckOut: null as Date | null,
    };

    if (records.length > 0) {
      stats.avgQualityScore = Math.round(
        records.reduce((sum, r) => sum + r.qualityScore, 0) / records.length
      );
      
      const checkIns = records.filter(r => r.checkInTime).map(r => r.checkInTime);
      const checkOuts = records.filter(r => r.checkOutTime).map(r => r.checkOutTime);
      
      if (checkIns.length > 0) {
        stats.firstCheckIn = new Date(Math.min(...checkIns.map(d => d.getTime())));
      }
      if (checkOuts.length > 0) {
        stats.lastCheckOut = new Date(Math.max(...checkOuts.map(d => d.getTime())));
      }
    }

    return stats;
  }

  // 获取所有NFC标签
  async getAllNfcTags(): Promise<NfcTag[]> {
    return this.nfcTagRepo.find({ where: { status: TagStatus.ACTIVE } });
  }

  // 创建NFC标签（初始化用）
  async createNfcTag(tagData: Partial<NfcTag>): Promise<NfcTag> {
    const tag = this.nfcTagRepo.create(tagData);
    return this.nfcTagRepo.save(tag);
  }
}
