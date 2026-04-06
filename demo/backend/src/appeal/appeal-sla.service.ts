import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { Appeal, AppealStatus } from './appeal.entity';
import { AttendanceRecord, RecordStatus } from '../attendance/attendance-record.entity';

const REMIND_HOURS = 48;   // 48h 未审核：提醒
const AUTO_APPROVE_HOURS = 72; // 72h 未审核：自动通过

@Injectable()
export class AppealSlaService {
  private readonly logger = new Logger(AppealSlaService.name);

  constructor(
    @InjectRepository(Appeal)
    private readonly appealRepo: Repository<Appeal>,
    @InjectRepository(AttendanceRecord)
    private readonly recordRepo: Repository<AttendanceRecord>,
  ) {}

  /**
   * 每小时检查一次申诉 SLA
   * - 超过 48h 未审核 → 记录提醒日志（生产中接推送通知）
   * - 超过 72h 未审核 → 自动 APPROVED
   */
  @Cron('0 0 * * * *') // 每小时整点
  async checkSla(): Promise<void> {
    const now = new Date();

    const remindThreshold = new Date(now.getTime() - REMIND_HOURS * 3600 * 1000);
    const autoApproveThreshold = new Date(now.getTime() - AUTO_APPROVE_HOURS * 3600 * 1000);

    // ── 自动通过（> 72h）──────────────────────────────────────────────────
    const toAutoApprove = await this.appealRepo.find({
      where: {
        status: AppealStatus.PENDING,
        createdAt: LessThan(autoApproveThreshold),
      },
    });

    for (const appeal of toAutoApprove) {
      appeal.status = AppealStatus.APPROVED;
      appeal.reviewComment = `系统自动通过：申诉提交后超过 ${AUTO_APPROVE_HOURS} 小时未审核`;
      appeal.reviewedAt = now;
      await this.appealRepo.save(appeal);

      // 同步更新打卡记录
      await this.recordRepo.update(
        { id: appeal.recordId },
        { isAnomaly: false, status: RecordStatus.VALID },
      ).catch(() => {});

      this.logger.log(`[SLA] 申诉 ${appeal.id} 自动通过（超过 ${AUTO_APPROVE_HOURS}h 未审核）`);
    }

    // ── 提醒（48h < t < 72h）────────────────────────────────────────────────
    const toRemind = await this.appealRepo.find({
      where: {
        status: AppealStatus.PENDING,
        createdAt: LessThan(remindThreshold),
      },
    });

    // 过滤掉已超过自动通过阈值的（已在上面处理）
    const pendingRemind = toRemind.filter(
      a => a.createdAt > autoApproveThreshold,
    );

    for (const appeal of pendingRemind) {
      const hoursElapsed = Math.round((now.getTime() - appeal.createdAt.getTime()) / 3600000);
      this.logger.warn(
        `[SLA提醒] 申诉 ${appeal.id}（用户: ${appeal.userName}）已等待 ${hoursElapsed}h，请尽快审核`,
      );
      // TODO: 生产环境通过 NotificationService 推送消息给审核人员
    }

    if (toAutoApprove.length > 0 || pendingRemind.length > 0) {
      this.logger.log(`[SLA检查] 自动通过 ${toAutoApprove.length} 条，待提醒 ${pendingRemind.length} 条`);
    }
  }

  /** 查询当前 SLA 状态（给管理员看板用） */
  async getSlaStats() {
    const now = new Date();
    const remindThreshold = new Date(now.getTime() - REMIND_HOURS * 3600 * 1000);
    const autoThreshold = new Date(now.getTime() - AUTO_APPROVE_HOURS * 3600 * 1000);

    const pending = await this.appealRepo.find({ where: { status: AppealStatus.PENDING } });

    return {
      totalPending: pending.length,
      overdueRemind: pending.filter(a => a.createdAt < remindThreshold && a.createdAt >= autoThreshold).length,
      overdueAutoApprove: pending.filter(a => a.createdAt < autoThreshold).length,
      slaConfig: { remindHours: REMIND_HOURS, autoApproveHours: AUTO_APPROVE_HOURS },
    };
  }
}
