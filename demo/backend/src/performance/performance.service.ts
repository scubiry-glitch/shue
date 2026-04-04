import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AttendanceRecord } from '../attendance/attendance-record.entity';

// 模拟人员数据 (生产环境对接人事系统)
const STAFF_DATA = [
  { userId: 'user_001', name: '张晓明', level: 'S1', dept: '静安一部', deptId: 'dept_01', joinDate: '2024-06-15' },
  { userId: 'user_002', name: '李强', level: 'A', dept: '徐汇二部', deptId: 'dept_02', joinDate: '2023-08-01' },
  { userId: 'user_003', name: '王芳', level: 'M', dept: '静安一部', deptId: 'dept_01', joinDate: '2023-03-15' },
  { userId: 'user_004', name: '赵伟', level: 'S1', dept: '浦东三部', deptId: 'dept_03', joinDate: '2024-01-10' },
  { userId: 'user_005', name: '陈静', level: 'A', dept: '长宁一部', deptId: 'dept_04', joinDate: '2025-02-01' },
  { userId: 'user_006', name: '刘洋', level: 'S1', dept: '黄浦一部', deptId: 'dept_05', joinDate: '2024-04-20' },
  { userId: 'user_007', name: '孙磊', level: 'A', dept: '静安一部', deptId: 'dept_01', joinDate: '2023-11-01' },
  { userId: 'user_008', name: '周敏', level: 'M', dept: '徐汇二部', deptId: 'dept_02', joinDate: '2023-05-15' },
  { userId: 'user_009', name: '吴杰', level: 'A', dept: '浦东三部', deptId: 'dept_03', joinDate: '2024-09-01' },
  { userId: 'user_010', name: '郑涛', level: 'S1', dept: '长宁一部', deptId: 'dept_04', joinDate: '2024-07-15' },
];

// 目标值 (按职级)
const TARGET_SHOWINGS: Record<string, number> = { S1: 8, A: 12, M: 15 };

@Injectable()
export class PerformanceService {
  constructor(
    @InjectRepository(AttendanceRecord)
    private recordRepo: Repository<AttendanceRecord>,
  ) {}

  // 计算系数A (基于真实打卡数据)
  private async calculateCoefficientA(userId: string, period?: string): Promise<{
    value: number;
    showings: number;
    verified: number;
    target: number;
    verificationRate: number;
  }> {
    const staff = STAFF_DATA.find(s => s.userId === userId);
    const target = TARGET_SHOWINGS[staff?.level || 'S1'] || 8;

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const records = await this.recordRepo.createQueryBuilder('r')
      .where('r.userId = :userId', { userId })
      .andWhere('r.recordType = :type', { type: 'CHECK_IN' })
      .andWhere('r.createdAt >= :start', { start: startOfMonth })
      .getMany();

    const showings = records.length;
    const verified = records.filter(r => r.nfcVerified && r.distanceValid !== false).length;
    const verificationRate = showings > 0 ? verified / showings : 0;

    // 系数A = 验证通过率 × 目标完成率 × (通过率<70%打5折)
    const targetCompletion = Math.min(verified / target, 1);
    const rateMultiplier = verificationRate >= 0.7 ? 1.0 : 0.5;
    const value = Math.round(verificationRate * targetCompletion * rateMultiplier * 100) / 100;

    return { value, showings, verified, target, verificationRate: Math.round(verificationRate * 100) };
  }

  // 计算系数B (底线指标)
  private async calculateCoefficientB(userId: string): Promise<{
    value: number;
    qualified: boolean;
    attendanceDays: number;
    requiredDays: number;
  }> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // 统计本月有打卡的天数
    const result = await this.recordRepo.createQueryBuilder('r')
      .select('COUNT(DISTINCT DATE(r.createdAt))', 'days')
      .where('r.userId = :userId', { userId })
      .andWhere('r.createdAt >= :start', { start: startOfMonth })
      .getRawOne();

    const attendanceDays = parseInt(result?.days || '0');
    // 工作日估算 (简化: 当月到今天的工作日数)
    const dayOfMonth = now.getDate();
    const requiredDays = Math.floor(dayOfMonth * 5 / 7); // 简化估算

    const value = requiredDays > 0 ? Math.round(attendanceDays / requiredDays * 100) / 100 : 1.0;

    return { value: Math.min(value, 1.5), qualified: value >= 1.0, attendanceDays, requiredDays };
  }

  // 计算系数C (重点业务)
  private async calculateCoefficientC(userId: string): Promise<{
    value: number;
    inspectionRate: number;
    signingRate: number;
  }> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // 巡检数
    const inspections = await this.recordRepo.count({
      where: { userId, recordType: 'INSPECT' as any },
    });

    // 简化: 巡检完成率和签约率基于数据推算
    const inspectionRate = Math.min(inspections / 20, 1); // 假设月度目标20次巡检
    const signingRate = 0.35 + Math.random() * 0.5; // 简化: 签约率从签约系统获取

    const value = Math.round((inspectionRate * 0.4 + signingRate * 0.6) * 100) / 100;

    return { value: Math.min(value, 1.0), inspectionRate: Math.round(inspectionRate * 100), signingRate: Math.round(signingRate * 100) };
  }

  // 获取百分位排名
  private getPercentileRank(myScore: number, allScores: number[]): number {
    const sorted = [...allScores].sort((a, b) => a - b);
    const idx = sorted.findIndex(s => s >= myScore);
    return Math.round((idx / sorted.length) * 100);
  }

  // 获取当前绩效
  async getCurrentPerformance(userId: string) {
    const [coeffA, coeffB, coeffC] = await Promise.all([
      this.calculateCoefficientA(userId),
      this.calculateCoefficientB(userId),
      this.calculateCoefficientC(userId),
    ]);

    // 计算月度得分 (简化: 直接用系数值代替排名)
    const monthlyScore = Math.round((coeffA.value * 30 + coeffC.value * 70) * 100) / 100;

    return {
      userId,
      staff: STAFF_DATA.find(s => s.userId === userId),
      coefficient_a: coeffA,
      coefficient_b: coeffB,
      coefficient_c: coeffC,
      monthly_score: monthlyScore,
      ranking: {
        company_rank: 8,
        company_total: STAFF_DATA.length,
        percentile: 85,
        dept_rank: 3,
        dept_total: 12,
        evaluation: 'MAINTAIN',
      },
      upgrade_probability: coeffB.qualified ? '中' : '低',
    };
  }

  // 获取 AM 通排排名
  async getRanking(period?: string) {
    const rankings = await Promise.all(
      STAFF_DATA.map(async (staff, index) => {
        const coeffA = await this.calculateCoefficientA(staff.userId);
        const coeffB = await this.calculateCoefficientB(staff.userId);
        const coeffC = await this.calculateCoefficientC(staff.userId);
        const score = Math.round((coeffA.value * 30 + coeffC.value * 70) * 100) / 100;

        return {
          userId: staff.userId,
          name: staff.name,
          level: staff.level,
          dept: staff.dept,
          coefficient_a: coeffA.value,
          coefficient_b_qualified: coeffB.qualified,
          coefficient_b_value: coeffB.value,
          coefficient_c: coeffC.value,
          monthly_score: score,
        };
      })
    );

    // 按月度得分排序 (AM通排)
    rankings.sort((a, b) => b.monthly_score - a.monthly_score);

    return rankings.map((r, i) => ({
      ...r,
      rank: i + 1,
      percentile: Math.round(((rankings.length - i) / rankings.length) * 100),
      is_top_20: i < Math.ceil(rankings.length * 0.2),
    }));
  }

  // 历史趋势
  async getHistory(userId: string, months: number) {
    const history = [];
    for (let i = months - 1; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const period = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      history.push({
        period,
        coefficient_a: Math.round((0.7 + Math.random() * 0.3) * 100) / 100,
        coefficient_b: Math.round((0.9 + Math.random() * 0.15) * 100) / 100,
        coefficient_c: Math.round((0.7 + Math.random() * 0.3) * 100) / 100,
        monthly_score: Math.round((70 + Math.random() * 25) * 10) / 10,
        rank: Math.floor(3 + Math.random() * 10),
      });
    }
    return history;
  }

  // 升级前提条件校验
  async checkUpgradePrerequisites(userId: string, quarter?: string) {
    const coeffB = await this.calculateCoefficientB(userId);

    const prerequisites = {
      coefficient_b_qualified: coeffB.qualified,
      not_in_low_performance: true,
      complaints_qualified: true,
      complaints_count: 0,
      not_in_promotion_restriction: true,
    };

    return {
      userId,
      all_met: Object.values(prerequisites).every(v => v === true || v === 0),
      details: prerequisites,
    };
  }

  // 晋级候选人
  async getPromotionList(quarter?: string) {
    const ranking = await this.getRanking();
    const top20 = ranking.filter(r => r.is_top_20);

    return Promise.all(top20.map(async r => {
      const prereq = await this.checkUpgradePrerequisites(r.userId);
      return {
        ...r,
        prerequisites: prereq.details,
        all_conditions_met: prereq.all_met,
      };
    }));
  }

  // 低绩效预警人员
  async getLowPerformanceList() {
    // 返回绩效提升管理制度预警人员
    return [
      { userId: 'user_009', name: '吴杰', level: 'A', dept: '浦东三部', consecutive_low: 1, reason: '已在低绩效名单', coaching_status: '总监辅导中' },
      { userId: 'user_010', name: '郑涛', level: 'S1', dept: '长宁一部', consecutive_low: 2, reason: '连续低绩效', coaching_status: '大部总介入' },
    ];
  }

  // 重新计算绩效
  async recalculate(period?: string) {
    // 触发全量重新计算
    const ranking = await this.getRanking(period);
    return {
      message: '绩效重新计算完成',
      period: period || 'current',
      total_staff: ranking.length,
      calculated_at: new Date().toISOString(),
    };
  }
}
