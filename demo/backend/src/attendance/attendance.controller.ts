import { Controller, Post, Get, Body, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AttendanceService } from './attendance.service';
import { AttendanceRecord } from './attendance-record.entity';
import { NfcTag, TagType, TagStatus } from './nfc-tag.entity';
import { CheckInDto, CheckOutDto, QueryRecordsDto } from './dto';

@ApiTags('考勤打卡')
@Controller('attendance')
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Post('checkin')
  @ApiOperation({ summary: 'NFC打卡签到' })
  @ApiResponse({ status: 201, description: '打卡成功', type: AttendanceRecord })
  async checkIn(@Body() dto: CheckInDto): Promise<AttendanceRecord> {
    return this.attendanceService.checkIn(dto);
  }

  @Post('checkout')
  @ApiOperation({ summary: '签退' })
  @ApiResponse({ status: 200, description: '签退成功', type: AttendanceRecord })
  async checkOut(@Body() dto: CheckOutDto): Promise<AttendanceRecord> {
    return this.attendanceService.checkOut(dto);
  }

  @Get('records')
  @ApiOperation({ summary: '获取打卡记录' })
  @ApiResponse({ status: 200, description: '获取成功', type: [AttendanceRecord] })
  async getRecords(
    @Query('userId') userId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ): Promise<AttendanceRecord[]> {
    return this.attendanceService.getUserRecords(userId, startDate, endDate);
  }

  @Get('stats/today')
  @ApiOperation({ summary: '获取今日统计' })
  @ApiResponse({ status: 200, description: '获取成功' })
  async getTodayStats(@Query('userId') userId: string): Promise<any> {
    return this.attendanceService.getTodayStats(userId);
  }

  @Get('nfc-tags')
  @ApiOperation({ summary: '获取所有NFC标签' })
  @ApiResponse({ status: 200, description: '获取成功', type: [NfcTag] })
  async getNfcTags(): Promise<NfcTag[]> {
    return this.attendanceService.getAllNfcTags();
  }

  @Post('nfc-tags/init')
  @ApiOperation({ summary: '初始化NFC标签（演示用）' })
  async initNfcTags(): Promise<{ message: string; count: number }> {
    // 创建一些演示用的NFC标签
    const demoTags = [
      { tagId: 'house_001_shanghai', tagType: TagType.HOUSE, houseId: 'house_001', lat: 31.2304, lng: 121.4737, address: '上海市静安区南京西路1266号' },
      { tagId: 'house_002_shanghai', tagType: TagType.HOUSE, houseId: 'house_002', lat: 31.2222, lng: 121.4581, address: '上海市徐汇区淮海中路999号' },
      { tagId: 'house_003_shanghai', tagType: TagType.HOUSE, houseId: 'house_003', lat: 31.1956, lng: 121.4365, address: '上海市长宁区虹桥路1号' },
      { tagId: 'office_001_main', tagType: TagType.OFFICE, officeId: 'office_001', lat: 31.2456, lng: 121.5054, address: '上海市浦东新区陆家嘴环路1000号' },
    ];

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
    ];

    return houses.map(h => ({
      ...h,
      bound: boundHouseIds.has(h.houseId),
      boundTagId: tags.find(t => t.houseId === h.houseId)?.tagId || null,
    }));
  }
}
