import { Controller, Get, Post, Body, Query, Param } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AttendanceRecord } from '../attendance/attendance-record.entity';

interface Appeal {
  id: string;
  recordId: string;
  userId: string;
  userName: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewComment?: string;
  createdAt: string;
  reviewedAt?: string;
}

// 内存存储
const appeals: Appeal[] = [
  { id: 'a1', recordId: 'r1', userId: 'user_001', userName: '张晓明', reason: '客户临时有事提前结束', status: 'pending', createdAt: new Date().toISOString() },
  { id: 'a2', recordId: 'r2', userId: 'user_001', userName: '张晓明', reason: '客户临时改期，等待时间短', status: 'approved', reviewComment: '情况属实，标记为有效', createdAt: new Date(Date.now() - 172800000).toISOString(), reviewedAt: new Date(Date.now() - 86400000).toISOString() },
  { id: 'a3', recordId: 'r3', userId: 'user_001', userName: '张晓明', reason: 'GPS定位不准', status: 'rejected', reviewComment: 'GPS偏差超500米，无法验证', createdAt: new Date(Date.now() - 432000000).toISOString(), reviewedAt: new Date(Date.now() - 345600000).toISOString() },
];

@ApiTags('申诉管理')
@Controller('appeals')
export class AppealController {
  constructor(
    @InjectRepository(AttendanceRecord)
    private recordRepo: Repository<AttendanceRecord>,
  ) {}

  @Get()
  @ApiOperation({ summary: '获取申诉列表' })
  getAppeals(@Query('userId') userId?: string, @Query('status') status?: string) {
    let result = [...appeals];
    if (userId) result = result.filter(a => a.userId === userId);
    if (status) result = result.filter(a => a.status === status);
    return { total: result.length, list: result };
  }

  @Post()
  @ApiOperation({ summary: '提交申诉' })
  async createAppeal(@Body() body: { recordId: string; userId: string; userName: string; reason: string }) {
    const appeal: Appeal = {
      id: 'a' + Date.now(),
      recordId: body.recordId,
      userId: body.userId,
      userName: body.userName,
      reason: body.reason,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    appeals.push(appeal);
    return appeal;
  }

  @Post(':id/review')
  @ApiOperation({ summary: '审核申诉' })
  async reviewAppeal(
    @Param('id') id: string,
    @Body() body: { action: 'approve' | 'reject'; comment: string },
  ) {
    const appeal = appeals.find(a => a.id === id);
    if (!appeal) return { error: '申诉不存在' };

    appeal.status = body.action === 'approve' ? 'approved' : 'rejected';
    appeal.reviewComment = body.comment;
    appeal.reviewedAt = new Date().toISOString();

    // 如果通过，更新打卡记录状态
    if (body.action === 'approve') {
      await this.recordRepo.update(
        { id: appeal.recordId } as any,
        { isAnomaly: false, status: 'VALID' as any },
      ).catch(() => {}); // 记录可能不存在
    }

    return appeal;
  }

  @Get('anomaly-records')
  @ApiOperation({ summary: '获取异常打卡记录 (可申诉)' })
  async getAnomalyRecords(@Query('userId') userId?: string) {
    const query = this.recordRepo.createQueryBuilder('r')
      .where('r.isAnomaly = :anomaly', { anomaly: true })
      .orderBy('r.createdAt', 'DESC');

    if (userId) query.andWhere('r.userId = :userId', { userId });

    const records = await query.getMany();
    return {
      total: records.length,
      list: records.map(r => ({
        ...r,
        hasAppeal: appeals.some(a => a.recordId === r.id),
        appealStatus: appeals.find(a => a.recordId === r.id)?.status,
      })),
    };
  }
}
