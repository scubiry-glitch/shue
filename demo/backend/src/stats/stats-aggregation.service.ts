import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AttendanceRecord } from '../attendance/attendance-record.entity';
import { UserDailyStats } from './user-daily-stats.entity';
import * as dayjs from 'dayjs';

@Injectable()
export class StatsAggregationService {
  private readonly logger = new Logger(StatsAggregationService.name);

  constructor(
    @InjectRepository(AttendanceRecord)
    private readonly recordRepo: Repository<AttendanceRecord>,
    @InjectRepository(UserDailyStats)
    private readonly statsRepo: Repository<UserDailyStats>,
  ) {}

  /**
   * 每天凌晨 01:00 聚合前一天的统计数据
   */
  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async aggregateYesterday() {
    const yesterday = dayjs().subtract(1, 'day').format('YYYY-MM-DD');
    this.logger.log(`开始聚合 ${yesterday} 的统计数据...`);
    await this.aggregateForDate(yesterday);
    this.logger.log(`${yesterday} 统计聚合完成`);
  }

  /**
   * 每 15 分钟刷新当天统计（用于今日实时数据）
   */
  @Cron('0 */15 * * * *')
  async aggregateToday() {
    const today = dayjs().format('YYYY-MM-DD');
    await this.aggregateForDate(today);
  }

  async aggregateForDate(dateStr: string): Promise<void> {
    const startOfDay = new Date(`${dateStr}T00:00:00.000Z`);
    const endOfDay = new Date(`${dateStr}T23:59:59.999Z`);

    // 查询当天所有记录，按用户分组
    const records = await this.recordRepo
      .createQueryBuilder('r')
      .where('r.createdAt >= :start', { start: startOfDay })
      .andWhere('r.createdAt <= :end', { end: endOfDay })
      .getMany();

    // 按用户分组
    const byUser = new Map<string, AttendanceRecord[]>();
    for (const r of records) {
      const list = byUser.get(r.userId) || [];
      list.push(r);
      byUser.set(r.userId, list);
    }

    // Upsert 每个用户的日统计
    for (const [userId, userRecords] of byUser.entries()) {
      const totalCheckIns = userRecords.length;
      const verifiedCount = userRecords.filter(r => r.nfcVerified).length;
      const anomalyCount = userRecords.filter(r => r.isAnomaly).length;
      const avgQualityScore =
        totalCheckIns > 0
          ? Math.round(userRecords.reduce((s, r) => s + r.qualityScore, 0) / totalCheckIns)
          : 0;

      const checkInTimes = userRecords.map(r => r.checkInTime).filter(Boolean);
      const checkOutTimes = userRecords.map(r => r.checkOutTime).filter(Boolean);

      const firstCheckIn =
        checkInTimes.length > 0
          ? new Date(Math.min(...checkInTimes.map(d => d.getTime())))
          : null;
      const lastCheckOut =
        checkOutTimes.length > 0
          ? new Date(Math.max(...checkOutTimes.map(d => d.getTime())))
          : null;

      await this.statsRepo
        .createQueryBuilder()
        .insert()
        .into(UserDailyStats)
        .values({
          userId,
          statsDate: dateStr,
          totalCheckIns,
          verifiedCount,
          anomalyCount,
          avgQualityScore,
          firstCheckIn,
          lastCheckOut,
        })
        .orUpdate(
          ['total_check_ins', 'verified_count', 'anomaly_count', 'avg_quality_score', 'first_check_in', 'last_check_out', 'updated_at'],
          ['user_id', 'stats_date'],
        )
        .execute();
    }
  }

  /**
   * 从聚合表查询今日统计（比实时聚合快）
   */
  async getTodayStatsCached(userId: string): Promise<UserDailyStats | null> {
    const today = dayjs().format('YYYY-MM-DD');
    return this.statsRepo.findOne({ where: { userId, statsDate: today } });
  }
}
