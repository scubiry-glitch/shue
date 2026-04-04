import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, IsOptional, IsEnum, IsArray, IsBoolean, IsObject } from 'class-validator';
import { RecordType } from './attendance-record.entity';

export class CheckInDto {
  @ApiProperty({ description: 'NFC标签ID', example: 'house_001_shanghai' })
  @IsString()
  nfcTagId: string;

  @ApiProperty({ description: '用户ID', example: 'user_001' })
  @IsString()
  userId: string;

  @ApiProperty({ description: '用户姓名', example: '张三', required: false })
  @IsString()
  @IsOptional()
  userName?: string;

  @ApiProperty({ description: '打卡类型', enum: RecordType, default: RecordType.CHECK_IN })
  @IsEnum(RecordType)
  recordType: RecordType;

  // ===== 多角色多任务新增 =====

  @ApiProperty({ description: '角色', example: 'AGENT', required: false })
  @IsString()
  @IsOptional()
  role?: string;

  @ApiProperty({ description: '任务类型', example: 'EMPTY_VIEW', required: false })
  @IsString()
  @IsOptional()
  taskType?: string;

  @ApiProperty({ description: '任务数据(JSON)', example: {}, required: false })
  @IsObject()
  @IsOptional()
  taskData?: any;

  // ===== 原有字段 =====

  @ApiProperty({ description: 'GPS纬度', example: 31.2304, required: false })
  @IsNumber()
  @IsOptional()
  gpsLat?: number;

  @ApiProperty({ description: 'GPS经度', example: 121.4737, required: false })
  @IsNumber()
  @IsOptional()
  gpsLng?: number;

  @ApiProperty({ description: 'GPS精度(米)', example: 10, required: false })
  @IsNumber()
  @IsOptional()
  gpsAccuracy?: number;

  @ApiProperty({ description: '设备ID', example: 'device_ios_001', required: false })
  @IsString()
  @IsOptional()
  deviceId?: string;

  @ApiProperty({ description: '设备型号', example: 'iPhone14,2', required: false })
  @IsString()
  @IsOptional()
  deviceModel?: string;

  @ApiProperty({ description: '照片列表', example: [], required: false })
  @IsArray()
  @IsOptional()
  photos?: any[];
}

export class CheckOutDto {
  @ApiProperty({ description: '打卡记录ID', example: 'uuid-xxx' })
  @IsString()
  recordId: string;

  @ApiProperty({ description: 'GPS纬度', example: 31.2304, required: false })
  @IsNumber()
  @IsOptional()
  gpsLat?: number;

  @ApiProperty({ description: 'GPS经度', example: 121.4737, required: false })
  @IsNumber()
  @IsOptional()
  gpsLng?: number;

  @ApiProperty({ description: '签退时补充的任务数据', required: false })
  @IsObject()
  @IsOptional()
  taskData?: any;
}

export class QueryRecordsDto {
  @ApiProperty({ description: '用户ID', example: 'user_001' })
  @IsString()
  userId: string;

  @ApiProperty({ description: '开始日期', example: '2025-04-01', required: false })
  @IsString()
  @IsOptional()
  startDate?: string;

  @ApiProperty({ description: '结束日期', example: '2025-04-03', required: false })
  @IsString()
  @IsOptional()
  endDate?: string;
}
