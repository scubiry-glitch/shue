import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from '../users/users.service';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../users/user.entity';

@ApiTags('人员管理')
@ApiBearerAuth()
@Controller('staff')
export class StaffController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @ApiOperation({ summary: '获取人员列表（从 users 表读取）' })
  async getStaffList(
    @Query('department') department?: string,
    @Query('role') role?: UserRole,
    @Query('keyword') keyword?: string,
  ) {
    const users = await this.usersService.findAll();

    let result = users.map(u => ({
      userId: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      department: u.department,
      level: u.level,
      joinDate: u.joinDate,
      deviceModel: u.deviceModel,
      status: u.statusNote || '正常',
    }));

    if (department) result = result.filter(s => s.department === department);
    if (role) result = result.filter(s => s.role === role);
    if (keyword) result = result.filter(s => s.name.includes(keyword) || s.email.includes(keyword));

    return { total: result.length, list: result };
  }

  @Get('departments')
  @ApiOperation({ summary: '获取部门列表（从 users 表聚合）' })
  async getDepartments() {
    const users = await this.usersService.findAll();
    const deptMap = new Map<string, number>();
    for (const u of users) {
      if (u.department) {
        deptMap.set(u.department, (deptMap.get(u.department) || 0) + 1);
      }
    }
    return Array.from(deptMap.entries()).map(([name, headCount]) => ({ name, headCount }));
  }

  @Get('overview')
  @ApiOperation({ summary: '获取团队概览统计' })
  @Roles(UserRole.ADMIN)
  async getOverview() {
    const users = await this.usersService.findAll();

    const byRole: Record<string, number> = {};
    const byDept: Record<string, number> = {};

    for (const u of users) {
      byRole[u.role] = (byRole[u.role] || 0) + 1;
      if (u.department) {
        byDept[u.department] = (byDept[u.department] || 0) + 1;
      }
    }

    return {
      totalStaff: users.length,
      byRole,
      byDept,
    };
  }
}
