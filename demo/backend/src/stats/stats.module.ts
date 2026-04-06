import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { StatsController } from './stats.controller';
import { StatsAggregationService } from './stats-aggregation.service';
import { UserDailyStats } from './user-daily-stats.entity';
import { AttendanceRecord } from '../attendance/attendance-record.entity';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    TypeOrmModule.forFeature([UserDailyStats, AttendanceRecord]),
  ],
  providers: [StatsAggregationService],
  controllers: [StatsController],
  exports: [StatsAggregationService],
})
export class StatsModule {}
