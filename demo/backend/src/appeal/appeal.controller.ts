import { Controller, Get, Post, Body, Query, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AppealService } from './appeal.service';
import { AppealSlaService } from './appeal-sla.service';
import { AppealStatus } from './appeal.entity';
import { CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { UserRole, User } from '../users/user.entity';

@ApiTags('申诉管理')
@ApiBearerAuth()
@Controller('appeals')
export class AppealController {
  constructor(
    private readonly appealService: AppealService,
    private readonly appealSlaService: AppealSlaService,
  ) {}

  @Get()
  @ApiOperation({ summary: '获取申诉列表（普通用户只看自己，管理员可全查）' })
  getAppeals(
    @CurrentUser() user: User,
    @Query('userId') queryUserId?: string,
    @Query('status') status?: AppealStatus,
  ) {
    const targetUserId =
      user.role === UserRole.ADMIN && queryUserId ? queryUserId : user.id;
    return this.appealService.findAll(
      user.role === UserRole.ADMIN && !queryUserId ? undefined : targetUserId,
      status,
    );
  }

  @Post()
  @ApiOperation({ summary: '提交申诉' })
  async createAppeal(
    @Body() body: { recordId: string; reason: string },
    @CurrentUser() user: User,
  ) {
    return this.appealService.create({
      recordId: body.recordId,
      userId: user.id,
      userName: user.name,
      reason: body.reason,
    });
  }

  @Post(':id/review')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: '审核申诉（仅管理员）' })
  async reviewAppeal(
    @Param('id') id: string,
    @Body() body: { action: 'approve' | 'reject'; comment: string },
    @CurrentUser() reviewer: User,
  ) {
    return this.appealService.review(id, body.action, body.comment, reviewer.id);
  }

  @Get('sla/stats')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: '申诉 SLA 状态（管理员）' })
  getSlaStats() {
    return this.appealSlaService.getSlaStats();
  }

  @Get('anomaly-records')
  @ApiOperation({ summary: '获取可申诉的异常打卡记录' })
  async getAnomalyRecords(@CurrentUser() user: User, @Query('userId') queryUserId?: string) {
    const targetUserId =
      user.role === UserRole.ADMIN && queryUserId ? queryUserId : user.id;
    return this.appealService.getAnomalyRecords(targetUserId);
  }
}
