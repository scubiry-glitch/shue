import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AttendanceRecord } from '../attendance/attendance-record.entity';
import { UserDailyStats } from '../stats/user-daily-stats.entity';
import { UsersService } from '../users/users.service';
import { User } from '../users/user.entity';

// 目标值 (按职级)
const TARGET_SHOWINGS: Record<string, number> = { S1: 8, A: 12, M: 15 };
const INSPECTION_MONTHLY_TARGET = 20;

@Injectable()
export class PerformanceService {
  constructor(
    @InjectRepository(AttendanceRecord)
    private recordRepo: Repository<AttendanceRecord>,
    @InjectRepository(UserDailyStats)
    private dailyStatsRepo: Repository<UserDailyStats>,
    private readonly usersService: UsersService,
  ) {}

  private getMonthRange(monthsAgo = 0): { start: Date; end: Date; period: string } {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() - monthsAgo;
    const start = new Date(year, month, 1);
    const end = new Date(year, month + 1, 0, 23, 59, 59, 999);
    const d = new Date(year, month, 1);
    const period = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    return { start, end, period };
  }

  // 系数A: 带看验证通过率 × 目标完成率
  private async calculateCoefficientA(
    user: User,
    start: Date,
    end: Date,
  ): Promise<{ value: number; showings: number; verified: number; target: number; verificationRate: number }> {
    const target = TARGET_SHOWINGS[user.level || 'S1'] || 8;

    const records = await this.recordRepo
      .createQueryBuilder('r')
      .where('r.userId = :userId', { userId: user.id })
      .andWhere('r.taskType = :type', { type: 'SHOWING' })
      .andWhere('r.createdAt >= :start', { start })
      .andWhere('r.createdAt <= :end', { end })
      .withDeleted()
      .getMany();

    const showings = records.length;
    const verified = records.filter(r => r.nfcVerified && r.distanceValid !== false).length;
    const verificationRate = showings > 0 ? verified / showings : 0;

    const targetCompletion = Math.min(verified / target, 1);
    const rateMultiplier = verificationRate >= 0.7 ? 1.0 : 0.5;
    const value = Math.round(verificationRate * targetCompletion * rateMultiplier * 100) / 100;

    return { value, showings, verified, target, verificationRate: Math.round(verificationRate * 100) };
  }

  // 系数B: 出勤天数达标率
  private async calculateCoefficientB(
    userId: string,
    start: Date,
    end: Date,
    isCurrentMonth: boolean,
  ): Promise<{ value: number; qualified: boolean; attendanceDays: number; requiredDays: number }> {
    // 从 user_daily_stats 聚合有打卡的天数
    const result = await this.dailyStatsRepo
      .createQueryBuilder('s')
      .select('COUNT(*)', 'days')
      .where('s.userId = :userId', { userId })
      .andWhere('s.statsDate >= :start', { start: start.toISOString().slice(0, 10) })
      .andWhere('s.statsDate <= :end', { end: end.toISOString().slice(0, 10) })
      .andWhere('s.totalCheckIns > 0')
      .getRawOne();

    const attendanceDays = parseInt(result?.days || '0');

    // 工作日估算: 当月总天数 × 5/7
    const totalDays = isCurrentMonth ? new Date().getDate() : end.getDate();
    const requiredDays = Math.floor(totalDays * 5 / 7);

    const value = requiredDays > 0 ? Math.round((attendanceDays / requiredDays) * 100) / 100 : 1.0;
    return { value: Math.min(value, 1.5), qualified: value >= 1.0, attendanceDays, requiredDays };
  }

  // 系数C: 巡检完成率 + 签约任务数
  private async calculateCoefficientC(
    userId: string,
    start: Date,
    end: Date,
  ): Promise<{ value: number; inspectionRate: number; signingCount: number }> {
    const [inspections, signings] = await Promise.all([
      this.recordRepo.count({
        where: { userId, taskType: 'INSPECTION' as any },
      }),
      this.recordRepo.count({
        where: { userId, taskType: 'SIGNING' as any },
      }),
    ]);

    const inspectionRate = Math.min(inspections / INSPECTION_MONTHLY_TARGET, 1);
    // 签约归一化: 每月签约3单视为满分
    const signingRate = Math.min(signings / 3, 1);

    const value = Math.round((inspectionRate * 0.4 + signingRate * 0.6) * 100) / 100;
    return { value: Math.min(value, 1.0), inspectionRate: Math.round(inspectionRate * 100), signingCount: signings };
  }

  async getCurrentPerformance(userId: string) {
    const user = await this.usersService.findById(userId);
    if (!user) return null;

    const { start, end } = this.getMonthRange(0);

    const [coeffA, coeffB, coeffC] = await Promise.all([
      this.calculateCoefficientA(user, start, end),
      this.calculateCoefficientB(userId, start, end, true),
      this.calculateCoefficientC(userId, start, end),
    ]);

    const monthlyScore = Math.round((coeffA.value * 30 + coeffC.value * 70) * 100) / 100;

    // Ranking requires loading all staff — do a lightweight version here
    const allStaff = await this.usersService.findAll();
    const companyTotal = allStaff.length;

    return {
      userId,
      staff: {
        name: user.name,
        level: user.level,
        dept: user.department,
        joinDate: user.joinDate,
      },
      coefficient_a: coeffA,
      coefficient_b: coeffB,
      coefficient_c: coeffC,
      monthly_score: monthlyScore,
      ranking: {
        company_total: companyTotal,
        // Full cross-staff ranking is computed by getRanking(); use placeholder until called
        company_rank: null,
        percentile: null,
        evaluation: coeffB.qualified ? 'MAINTAIN' : 'AT_RISK',
      },
      upgrade_probability: coeffB.qualified && coeffA.verificationRate >= 70 ? '中' : '低',
    };
  }

  async getRanking(period?: string) {
    const monthsAgo = period ? 0 : 0; // can extend to parse period string
    const { start, end } = this.getMonthRange(monthsAgo);
    const isCurrentMonth = monthsAgo === 0;

    const allStaff = await this.usersService.findAll();

    const rankings = await Promise.all(
      allStaff.map(async user => {
        const [coeffA, coeffB, coeffC] = await Promise.all([
          this.calculateCoefficientA(user, start, end),
          this.calculateCoefficientB(user.id, start, end, isCurrentMonth),
          this.calculateCoefficientC(user.id, start, end),
        ]);
        const score = Math.round((coeffA.value * 30 + coeffC.value * 70) * 100) / 100;
        return {
          userId: user.id,
          name: user.name,
          level: user.level,
          dept: user.department,
          coefficient_a: coeffA.value,
          coefficient_b_qualified: coeffB.qualified,
          coefficient_b_value: coeffB.value,
          coefficient_c: coeffC.value,
          monthly_score: score,
        };
      }),
    );

    rankings.sort((a, b) => b.monthly_score - a.monthly_score);

    return rankings.map((r, i) => ({
      ...r,
      rank: i + 1,
      percentile: Math.round(((rankings.length - i) / rankings.length) * 100),
      is_top_20: i < Math.ceil(rankings.length * 0.2),
    }));
  }

  async getHistory(userId: string, months: number) {
    const user = await this.usersService.findById(userId);
    if (!user) return [];

    const history = [];
    for (let i = months - 1; i >= 0; i--) {
      const { start, end, period } = this.getMonthRange(i);
      const isCurrentMonth = i === 0;

      const [coeffA, coeffB, coeffC] = await Promise.all([
        this.calculateCoefficientA(user, start, end),
        this.calculateCoefficientB(userId, start, end, isCurrentMonth),
        this.calculateCoefficientC(userId, start, end),
      ]);

      const monthlyScore = Math.round((coeffA.value * 30 + coeffC.value * 70) * 100) / 100;

      history.push({
        period,
        coefficient_a: coeffA.value,
        coefficient_b: coeffB.value,
        coefficient_c: coeffC.value,
        monthly_score: monthlyScore,
      });
    }
    return history;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async checkUpgradePrerequisites(userId: string, _quarter?: string) {
    const user = await this.usersService.findById(userId);
    if (!user) return null;

    const { start, end } = this.getMonthRange(0);
    const coeffB = await this.calculateCoefficientB(userId, start, end, true);

    const notLowPerformance = !user.statusNote?.includes('低绩效');

    const prerequisites = {
      coefficient_b_qualified: coeffB.qualified,
      not_in_low_performance: notLowPerformance,
      complaints_qualified: true, // TODO: wire in complaint data when available
      complaints_count: 0,
      not_in_promotion_restriction: true,
    };

    return {
      userId,
      all_met: prerequisites.coefficient_b_qualified &&
               prerequisites.not_in_low_performance &&
               prerequisites.complaints_qualified &&
               prerequisites.not_in_promotion_restriction,
      details: prerequisites,
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async getPromotionList(_quarter?: string) {
    const ranking = await this.getRanking();
    const top20 = ranking.filter(r => r.is_top_20);

    return Promise.all(
      top20.map(async r => {
        const prereq = await this.checkUpgradePrerequisites(r.userId);
        return { ...r, prerequisites: prereq?.details, all_conditions_met: prereq?.all_met ?? false };
      }),
    );
  }

  async getLowPerformanceList() {
    const allStaff = await this.usersService.findAll();
    return allStaff
      .filter(u => u.statusNote?.includes('低绩效'))
      .map(u => ({
        userId: u.id,
        name: u.name,
        level: u.level,
        dept: u.department,
        statusNote: u.statusNote,
      }));
  }

  async recalculate(period?: string) {
    const ranking = await this.getRanking(period);
    return {
      message: '绩效重新计算完成',
      period: period || 'current',
      total_staff: ranking.length,
      calculated_at: new Date().toISOString(),
    };
  }
}
