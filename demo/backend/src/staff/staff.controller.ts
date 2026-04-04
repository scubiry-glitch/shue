import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

const STAFF_DATA = [
  { userId: 'user_001', name: '张晓明', level: 'S1', dept: '静安一部', deptId: 'dept_01', joinDate: '2024-06-15', device: 'iPhone 15 Pro', status: '正常' },
  { userId: 'user_002', name: '李强', level: 'A', dept: '徐汇二部', deptId: 'dept_02', joinDate: '2023-08-01', device: 'iPhone 14', status: '正常' },
  { userId: 'user_003', name: '王芳', level: 'M', dept: '静安一部', deptId: 'dept_01', joinDate: '2023-03-15', device: 'iPhone 14 Pro', status: '正常' },
  { userId: 'user_004', name: '赵伟', level: 'S1', dept: '浦东三部', deptId: 'dept_03', joinDate: '2024-01-10', device: 'Xiaomi 14', status: '正常' },
  { userId: 'user_005', name: '陈静', level: 'A', dept: '长宁一部', deptId: 'dept_04', joinDate: '2025-02-01', device: 'iPhone 15', status: '新入职(只升不降)' },
  { userId: 'user_006', name: '刘洋', level: 'S1', dept: '黄浦一部', deptId: 'dept_05', joinDate: '2024-04-20', device: 'Samsung S24', status: '正常' },
  { userId: 'user_007', name: '孙磊', level: 'A', dept: '静安一部', deptId: 'dept_01', joinDate: '2023-11-01', device: 'iPhone 14', status: '正常' },
  { userId: 'user_008', name: '周敏', level: 'M', dept: '徐汇二部', deptId: 'dept_02', joinDate: '2023-05-15', device: 'iPhone 15 Pro Max', status: '正常' },
  { userId: 'user_009', name: '吴杰', level: 'A', dept: '浦东三部', deptId: 'dept_03', joinDate: '2024-09-01', device: 'Xiaomi 13', status: '低绩效预警' },
  { userId: 'user_010', name: '郑涛', level: 'S1', dept: '长宁一部', deptId: 'dept_04', joinDate: '2024-07-15', device: 'iPhone 14', status: '正常' },
];

@ApiTags('人员管理')
@Controller('staff')
export class StaffController {
  @Get()
  @ApiOperation({ summary: '获取人员列表' })
  getStaffList(
    @Query('dept') dept?: string,
    @Query('level') level?: string,
    @Query('keyword') keyword?: string,
  ) {
    let result = [...STAFF_DATA];
    if (dept) result = result.filter(s => s.dept === dept);
    if (level) result = result.filter(s => s.level === level);
    if (keyword) result = result.filter(s => s.name.includes(keyword));
    return { total: result.length, list: result };
  }

  @Get('departments')
  @ApiOperation({ summary: '获取部门列表' })
  getDepartments() {
    return [
      { id: 'dept_01', name: '静安一部', headCount: 12 },
      { id: 'dept_02', name: '徐汇二部', headCount: 10 },
      { id: 'dept_03', name: '浦东三部', headCount: 8 },
      { id: 'dept_04', name: '长宁一部', headCount: 9 },
      { id: 'dept_05', name: '黄浦一部', headCount: 7 },
    ];
  }

  @Get('overview')
  @ApiOperation({ summary: '获取团队概览统计' })
  getOverview() {
    return {
      total_staff: STAFF_DATA.length,
      by_level: { S1: 4, A: 4, M: 2 },
      by_dept: { '静安一部': 3, '徐汇二部': 2, '浦东三部': 2, '长宁一部': 2, '黄浦一部': 1 },
      new_hires_this_month: 1,
      low_performance_count: 1,
    };
  }
}
