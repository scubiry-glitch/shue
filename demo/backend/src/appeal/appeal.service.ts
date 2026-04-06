import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Appeal, AppealStatus } from './appeal.entity';
import { AttendanceRecord, RecordStatus } from '../attendance/attendance-record.entity';

@Injectable()
export class AppealService {
  constructor(
    @InjectRepository(Appeal)
    private readonly appealRepo: Repository<Appeal>,
    @InjectRepository(AttendanceRecord)
    private readonly recordRepo: Repository<AttendanceRecord>,
  ) {}

  async findAll(userId?: string, status?: AppealStatus): Promise<{ total: number; list: Appeal[] }> {
    const where: any = {};
    if (userId) where.userId = userId;
    if (status) where.status = status;
    const list = await this.appealRepo.find({ where, order: { createdAt: 'DESC' } });
    return { total: list.length, list };
  }

  async create(data: {
    recordId: string;
    userId: string;
    userName?: string;
    reason: string;
  }): Promise<Appeal> {
    // 防止对同一条记录重复申诉
    const existing = await this.appealRepo.findOne({
      where: { recordId: data.recordId, userId: data.userId, status: AppealStatus.PENDING },
    });
    if (existing) {
      throw new ForbiddenException('该记录已存在待审核申诉，请勿重复提交');
    }

    const appeal = this.appealRepo.create({
      recordId: data.recordId,
      userId: data.userId,
      userName: data.userName,
      reason: data.reason,
      status: AppealStatus.PENDING,
    });
    return this.appealRepo.save(appeal);
  }

  async review(
    id: string,
    action: 'approve' | 'reject',
    comment: string,
    reviewerId: string,
  ): Promise<Appeal> {
    const appeal = await this.appealRepo.findOne({ where: { id } });
    if (!appeal) throw new NotFoundException('申诉不存在');
    if (appeal.status !== AppealStatus.PENDING) {
      throw new ForbiddenException('该申诉已审核，不可重复操作');
    }

    appeal.status = action === 'approve' ? AppealStatus.APPROVED : AppealStatus.REJECTED;
    appeal.reviewComment = comment;
    appeal.reviewerId = reviewerId;
    appeal.reviewedAt = new Date();

    // 通过时更新打卡记录状态
    if (action === 'approve') {
      await this.recordRepo.update(
        { id: appeal.recordId },
        { isAnomaly: false, status: RecordStatus.VALID },
      ).catch(() => {});
    }

    return this.appealRepo.save(appeal);
  }

  async getAnomalyRecords(userId?: string): Promise<any[]> {
    const query = this.recordRepo
      .createQueryBuilder('r')
      .where('r.isAnomaly = :anomaly', { anomaly: true })
      .orderBy('r.createdAt', 'DESC');

    if (userId) query.andWhere('r.userId = :userId', { userId });

    const records = await query.getMany();

    // 关联申诉状态
    const appeals = await this.appealRepo.find({
      where: records.map(r => ({ recordId: r.id })),
    });
    const appealMap = new Map(appeals.map(a => [a.recordId, a]));

    return records.map(r => ({
      ...r,
      hasAppeal: appealMap.has(r.id),
      appealStatus: appealMap.get(r.id)?.status || null,
    }));
  }
}
