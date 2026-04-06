import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { Appeal } from './appeal.entity';
import { AppealService } from './appeal.service';
import { AppealSlaService } from './appeal-sla.service';
import { AppealController } from './appeal.controller';
import { AttendanceRecord } from '../attendance/attendance-record.entity';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    TypeOrmModule.forFeature([Appeal, AttendanceRecord]),
  ],
  providers: [AppealService, AppealSlaService],
  controllers: [AppealController],
  exports: [AppealService, AppealSlaService],
})
export class AppealModule {}
