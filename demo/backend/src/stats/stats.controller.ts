import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AttendanceRecord } from '../attendance/attendance-record.entity';

@ApiTags('多角色统计')
@Controller('stats')
export class StatsController {
  constructor(
    @InjectRepository(AttendanceRecord)
    private recordRepo: Repository<AttendanceRecord>,
  ) {}

  @Get('house')
  @ApiOperation({ summary: '房源多角色打卡统计' })
  async getHouseStats(@Query('houseId') houseId?: string, @Query('period') period?: string) {
    const query = this.recordRepo.createQueryBuilder('r')
      .select('r.house_id', 'houseId')
      .addSelect('r.house_name', 'houseName')
      .addSelect('r.role', 'role')
      .addSelect('r.task_type', 'taskType')
      .addSelect('COUNT(*)', 'count')
      .addSelect('COUNT(DISTINCT r.user_id)', 'uniqueUsers')
      .groupBy('r.house_id')
      .addGroupBy('r.house_name')
      .addGroupBy('r.role')
      .addGroupBy('r.task_type');

    if (houseId) query.where('r.house_id = :houseId', { houseId });

    const rawData = await query.getRawMany();

    // 按房源聚合
    const houseMap: Record<string, any> = {};
    for (const row of rawData) {
      const key = row.houseId || 'unknown';
      if (!houseMap[key]) {
        houseMap[key] = {
          houseId: row.houseId,
          houseName: row.houseName,
          roles: {},
          totalRecords: 0,
        };
      }
      const role = row.role || 'UNKNOWN';
      if (!houseMap[key].roles[role]) houseMap[key].roles[role] = { tasks: {}, total: 0, uniqueUsers: 0 };
      const taskType = row.taskType || 'OTHER';
      houseMap[key].roles[role].tasks[taskType] = { count: parseInt(row.count), uniqueUsers: parseInt(row.uniqueUsers) };
      houseMap[key].roles[role].total += parseInt(row.count);
      houseMap[key].roles[role].uniqueUsers = Math.max(houseMap[key].roles[role].uniqueUsers, parseInt(row.uniqueUsers));
      houseMap[key].totalRecords += parseInt(row.count);
    }

    return Object.values(houseMap).sort((a: any, b: any) => b.totalRecords - a.totalRecords);
  }

  @Get('empty-views')
  @ApiOperation({ summary: '经纪人空看统计' })
  async getEmptyViewStats(@Query('houseId') houseId?: string) {
    const query = this.recordRepo.createQueryBuilder('r')
      .where('r.role = :role', { role: 'AGENT' })
      .andWhere('r.task_type = :taskType', { taskType: 'EMPTY_VIEW' });

    if (houseId) query.andWhere('r.house_id = :houseId', { houseId });

    const records = await query.orderBy('r.createdAt', 'DESC').getMany();

    // 按房源分组统计
    const byHouse: Record<string, any> = {};
    for (const r of records) {
      const key = r.houseId || 'unknown';
      if (!byHouse[key]) {
        byHouse[key] = { houseId: r.houseId, houseName: r.houseName, totalViews: 0, agents: new Set(), visits: [] };
      }
      byHouse[key].totalViews++;
      byHouse[key].agents.add(r.userId);
      byHouse[key].visits.push({
        userId: r.userId,
        userName: r.userName,
        time: r.checkInTime || r.createdAt,
        qualityScore: r.qualityScore,
      });
    }

    return Object.values(byHouse).map((h: any) => ({
      houseId: h.houseId,
      houseName: h.houseName,
      totalViews: h.totalViews,
      uniqueAgents: h.agents.size,
      recentVisits: h.visits.slice(0, 20),
    }));
  }

  @Get('by-role')
  @ApiOperation({ summary: '按角色统计任务完成情况' })
  async getStatsByRole(@Query('role') role: string, @Query('period') period?: string) {
    const query = this.recordRepo.createQueryBuilder('r')
      .where('r.role = :role', { role });

    const records = await query.orderBy('r.createdAt', 'DESC').getMany();

    // 按任务类型分组
    const byTask: Record<string, { count: number; totalDuration: number; users: Set<string> }> = {};
    // 按人员分组
    const byUser: Record<string, { name: string; tasks: Record<string, number>; totalDuration: number }> = {};

    for (const r of records) {
      const task = r.taskType || 'OTHER';
      if (!byTask[task]) byTask[task] = { count: 0, totalDuration: 0, users: new Set() };
      byTask[task].count++;
      byTask[task].totalDuration += r.durationSeconds || 0;
      byTask[task].users.add(r.userId);

      if (!byUser[r.userId]) byUser[r.userId] = { name: r.userName || r.userId, tasks: {}, totalDuration: 0 };
      byUser[r.userId].tasks[task] = (byUser[r.userId].tasks[task] || 0) + 1;
      byUser[r.userId].totalDuration += r.durationSeconds || 0;
    }

    return {
      role,
      totalRecords: records.length,
      taskBreakdown: Object.entries(byTask).map(([taskType, data]) => ({
        taskType,
        count: data.count,
        avgDurationMinutes: data.count > 0 ? Math.round(data.totalDuration / data.count / 60) : 0,
        uniqueUsers: data.users.size,
      })),
      userBreakdown: Object.entries(byUser).map(([userId, data]) => ({
        userId,
        userName: data.name,
        tasks: data.tasks,
        total: Object.values(data.tasks).reduce((a, b) => a + b, 0),
        avgDurationMinutes: Math.round(data.totalDuration / Object.values(data.tasks).reduce((a, b) => a + b, 0) / 60) || 0,
      })).sort((a, b) => b.total - a.total),
    };
  }
}
