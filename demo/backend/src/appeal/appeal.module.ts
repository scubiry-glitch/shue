import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Appeal } from './appeal.entity';
import { AppealService } from './appeal.service';
import { AppealController } from './appeal.controller';
import { AttendanceRecord } from '../attendance/attendance-record.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Appeal, AttendanceRecord])],
  providers: [AppealService],
  controllers: [AppealController],
  exports: [AppealService],
})
export class AppealModule {}
