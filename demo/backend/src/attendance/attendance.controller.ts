import { Controller, Post, Get, Body, Query, Param, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AttendanceService } from './attendance.service';
import { AttendanceRecord } from './attendance-record.entity';
import { NfcTag, TagType, TagStatus } from './nfc-tag.entity';
import { CheckInDto, CheckOutDto } from './dto';
import { Public } from '../auth/public.decorator';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { UserRole, User } from '../users/user.entity';
import { DEMO_NFC_TAG_DEFS, getDemoNfcTagDef } from './demo-nfc-tags';

@ApiTags('考勤打卡')
@ApiBearerAuth()
@Controller('attendance')
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Post('checkin')
  @ApiOperation({ summary: 'NFC打卡签到' })
  @ApiResponse({ status: 201, description: '打卡成功', type: AttendanceRecord })
  async checkIn(
    @Body() dto: CheckInDto,
    @CurrentUser() user: User,
  ): Promise<AttendanceRecord> {
    // 身份强制来自 JWT，防止伪造他人打卡
    dto.userId = user.id;
    dto.userName = user.name;
    if (!dto.role) dto.role = user.role;
    return this.attendanceService.checkIn(dto);
  }

  @Post('checkout')
  @ApiOperation({ summary: '签退' })
  @ApiResponse({ status: 200, description: '签退成功', type: AttendanceRecord })
  async checkOut(
    @Body() dto: CheckOutDto,
    @CurrentUser() user: User,
  ): Promise<AttendanceRecord> {
    // 校验记录归属权
    return this.attendanceService.checkOut(dto, user.id);
  }

  @Get('records')
  @Public()
  @ApiOperation({ summary: '获取打卡记录（仅返回当前登录用户数据，管理员可指定 userId）' })
  @ApiResponse({ status: 200, description: '获取成功', type: [AttendanceRecord] })
  async getRecords(
    @CurrentUser() user: User | undefined,
    @Query('userId') queryUserId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ): Promise<AttendanceRecord[]> {
    // 已登录：管理员可查任意用户；普通用户只能查自己
    // 未登录（演示页）：允许按 queryUserId 查询
    const targetUserId = user
      ? (user.role === UserRole.ADMIN && queryUserId ? queryUserId : user.id)
      : queryUserId;
    if (!targetUserId) return [];
    return this.attendanceService.getUserRecords(targetUserId, startDate, endDate);
  }

  @Get('stats/today')
  @Public()
  @ApiOperation({ summary: '获取今日统计' })
  @ApiResponse({ status: 200, description: '获取成功' })
  async getTodayStats(
    @CurrentUser() user: User | undefined,
    @Query('userId') queryUserId?: string,
  ): Promise<any> {
    const targetUserId = user
      ? (user.role === UserRole.ADMIN && queryUserId ? queryUserId : user.id)
      : queryUserId;
    if (!targetUserId) {
      return { totalCheckIns: 0, validCheckIns: 0, averageScore: 0, totalDuration: 0 };
    }
    return this.attendanceService.getTodayStats(targetUserId);
  }

  // ─── BL-6：当前在岗视图 ──────────────────────────────────────────────────

  @Get('on-duty')
  @ApiOperation({ summary: '获取当前在岗人员（有签到未签退），管理员可查全员' })
  async getOnDuty(
    @CurrentUser() user: User,
    @Query('userId') queryUserId?: string,
  ) {
    const targetUserId =
      user.role === UserRole.ADMIN && queryUserId ? queryUserId
      : user.role === UserRole.ADMIN ? undefined
      : user.id;
    return this.attendanceService.getOnDuty(targetUserId);
  }

  @Get('nfc-tags')
  @ApiOperation({ summary: '获取所有NFC标签' })
  @ApiResponse({ status: 200, description: '获取成功', type: [NfcTag] })
  async getNfcTags(): Promise<NfcTag[]> {
    return this.attendanceService.getAllNfcTags();
  }

  @Public()
  @Get('nfc-tags/lookup/:tagId')
  @ApiOperation({ summary: '按 tagId 解析房源/NFC（写卡 URL #checkin?tag= 使用）' })
  async lookupNfcTag(@Param('tagId') tagId: string) {
    const decoded = decodeURIComponent(tagId);
    const tag = await this.attendanceService.findNfcTagByIdOrDemo(decoded);
    if (!tag) throw new NotFoundException('未知 NFC 标签');
    const def = getDemoNfcTagDef(decoded);
    return {
      tagId: tag.tagId,
      tagType: tag.tagType,
      houseId: tag.houseId,
      officeId: tag.officeId,
      lat: tag.lat,
      lng: tag.lng,
      address: tag.address,
      name: def?.name || tag.address,
      status: tag.status,
    };
  }

  @Post('nfc-tags/init')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: '初始化NFC标签（演示用，仅管理员）' })
  async initNfcTags(): Promise<{ message: string; count: number }> {
    // 创建一些演示用的NFC标签
    const demoTags = DEMO_NFC_TAG_DEFS.map(d => ({
      tagId: d.tagId,
      tagType: d.tagType === 'HOUSE' ? TagType.HOUSE : TagType.OFFICE,
      houseId: d.houseId,
      officeId: d.officeId,
      lat: d.lat,
      lng: d.lng,
      address: d.address,
    }));

    const results = await Promise.all(
      demoTags.map(tag => this.attendanceService.createNfcTag(tag))
    );

    return { message: 'NFC标签初始化成功', count: results.length };
  }

  @Post('nfc-tags/write-report')
  @ApiOperation({ summary: '上报NFC写卡结果' })
  async reportWriteResult(@Body() body: {
    results: Array<{ tagId: string; url: string; status: string; writtenAt: string | null }>;
    stats: { success: number; fail: number; skip: number };
    timestamp: string;
  }): Promise<{ message: string; received: number }> {
    console.log(`[NFC写卡报告] ${body.timestamp} - 成功:${body.stats.success} 失败:${body.stats.fail} 跳过:${body.stats.skip}`);
    body.results.forEach(r => {
      console.log(`  ${r.status === 'done' ? '✓' : r.status === 'fail' ? '✗' : '⊘'} ${r.tagId} → ${r.url}`);
    });
    return { message: '写卡结果已记录', received: body.results.length };
  }

  @Public()
  @Post('nfc-tags/bind')
  @ApiOperation({ summary: '写卡成功后绑定NFC标签到房源' })
  async bindNfcTag(@Body() body: {
    tagId: string;
    houseId: string;
    houseName: string;
    address: string;
    lat: number;
    lng: number;
    url: string;
  }): Promise<any> {
    // 检查是否已存在
    const existing = await this.attendanceService.findNfcTag(body.tagId);
    if (existing) {
      // 更新
      existing.houseId = body.houseId;
      existing.address = body.address;
      existing.lat = body.lat;
      existing.lng = body.lng;
      existing.status = 'ACTIVE' as any;
      return this.attendanceService.saveNfcTag(existing);
    }
    // 新建
    return this.attendanceService.createNfcTag({
      tagId: body.tagId,
      tagType: TagType.HOUSE,
      houseId: body.houseId,
      lat: body.lat,
      lng: body.lng,
      address: body.address,
      status: TagStatus.ACTIVE,
    });
  }

  @Public()
  @Get('nfc-tags/houses')
  @ApiOperation({ summary: '获取可绑定的房源列表' })
  async getHouseList(): Promise<any[]> {
    // 返回全部房源（生产环境从房源系统获取）
    const tags = await this.attendanceService.getAllNfcTags();
    const boundHouseIds = new Set(tags.map(t => t.houseId).filter(Boolean));

    // 模拟房源列表（含已绑定状态）
    const houses = [
      { houseId: 'house_001', name: '静安寺公寓', address: '上海市静安区南京西路1266号', lat: 31.2304, lng: 121.4737 },
      { houseId: 'house_002', name: '徐家汇花园', address: '上海市徐汇区淮海中路999号', lat: 31.2222, lng: 121.4581 },
      { houseId: 'house_003', name: '虹桥路公寓', address: '上海市长宁区虹桥路1号', lat: 31.1956, lng: 121.4365 },
      { houseId: 'house_004', name: '陆家嘴花园', address: '上海市浦东新区陆家嘴环路1000号', lat: 31.2456, lng: 121.5054 },
      { houseId: 'house_005', name: '中山公园寓', address: '上海市长宁区长宁路1018号', lat: 31.2205, lng: 121.4170 },
      { houseId: 'house_006', name: '人民广场居', address: '上海市黄浦区南京西路325号', lat: 31.2328, lng: 121.4737 },
      { houseId: 'house_007', name: '世纪公园寓', address: '上海市浦东新区锦绣路1001号', lat: 31.2089, lng: 121.5467 },
      { houseId: 'house_008', name: '莘庄公寓', address: '上海市闵行区莘朱路88号', lat: 31.1117, lng: 121.3862 },
      { houseId: 'house_009', name: '海淀创业路', address: '北京市海淀区创业路2号', lat: 39.984, lng: 116.318 },
    ];

    return houses.map(h => ({
      ...h,
      bound: boundHouseIds.has(h.houseId),
      boundTagId: tags.find(t => t.houseId === h.houseId)?.tagId || null,
    }));
  }
}
