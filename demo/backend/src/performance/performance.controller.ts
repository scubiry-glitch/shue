import { Controller, Get, Post, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { PerformanceService } from './performance.service';

@ApiTags('绩效管理')
@Controller('performance')
export class PerformanceController {
  constructor(private readonly performanceService: PerformanceService) {}

  @Get('current')
  @ApiOperation({ summary: '获取当前绩效数据' })
  async getCurrentPerformance(@Query('userId') userId: string) {
    return this.performanceService.getCurrentPerformance(userId);
  }

  @Get('ranking')
  @ApiOperation({ summary: '获取AM通排排名数据' })
  async getRanking(@Query('period') period?: string) {
    return this.performanceService.getRanking(period);
  }

  @Get('history')
  @ApiOperation({ summary: '获取历史趋势' })
  async getHistory(@Query('userId') userId: string, @Query('months') months?: number) {
    return this.performanceService.getHistory(userId, months || 6);
  }

  @Get('upgrade-check')
  @ApiOperation({ summary: '升级前提条件校验' })
  async checkUpgradePrerequisites(@Query('userId') userId: string, @Query('quarter') quarter?: string) {
    return this.performanceService.checkUpgradePrerequisites(userId, quarter);
  }

  @Get('promotion-list')
  @ApiOperation({ summary: '获取晋降级候选人列表' })
  async getPromotionList(@Query('quarter') quarter?: string) {
    return this.performanceService.getPromotionList(quarter);
  }

  @Get('low-performance')
  @ApiOperation({ summary: '获取低绩效预警人员' })
  async getLowPerformanceList() {
    return this.performanceService.getLowPerformanceList();
  }

  @Post('calculate')
  @ApiOperation({ summary: '触发重新计算绩效' })
  async recalculate(@Query('period') period?: string) {
    return this.performanceService.recalculate(period);
  }
}
