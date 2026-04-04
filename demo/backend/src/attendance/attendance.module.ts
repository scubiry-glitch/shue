import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AttendanceController } from './attendance.controller';
import { AttendanceService } from './attendance.service';
import { AttendanceRecord } from './attendance-record.entity';
import { NfcTag } from './nfc-tag.entity';

@Module({
  imports: [TypeOrmModule.forFeature([AttendanceRecord, NfcTag])],
  controllers: [AttendanceController],
  providers: [AttendanceService],
})
export class AttendanceModule {}
