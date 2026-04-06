import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AttendanceModule } from './attendance/attendance.module';
import { PerformanceModule } from './performance/performance.module';
import { StaffController } from './staff/staff.controller';
import { NotificationController } from './notification/notification.controller';
import { AppealController } from './appeal/appeal.controller';
import { RoleConfigController } from './roles/role-config.controller';
import { StatsController } from './stats/stats.controller';
import { AttendanceRecord } from './attendance/attendance-record.entity';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { User } from './users/user.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT) || 5432,
      username: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASS || 'postgres',
      database: process.env.DB_NAME || 'nfc_attendance',
      entities: [__dirname + '/**/*.entity{.ts,.js}'],
      synchronize: true,
      logging: false,
    }),
    TypeOrmModule.forFeature([AttendanceRecord, User]),
    AuthModule,
    UsersModule,
    AttendanceModule,
    PerformanceModule,
  ],
  controllers: [
    AppController,
    StaffController,
    NotificationController,
    AppealController,
    RoleConfigController,
    StatsController,
  ],
})
export class AppModule {}
