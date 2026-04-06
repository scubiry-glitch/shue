import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AttendanceModule } from './attendance/attendance.module';
import { PerformanceModule } from './performance/performance.module';
import { NotificationController } from './notification/notification.controller';
import { RoleConfigController } from './roles/role-config.controller';
import { AttendanceRecord } from './attendance/attendance-record.entity';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { User } from './users/user.entity';
import { AppealModule } from './appeal/appeal.module';
import { Appeal } from './appeal/appeal.entity';
import { StaffModule } from './staff/staff.module';
import { StatsModule } from './stats/stats.module';
import { HouseModule } from './house/house.module';

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
      migrations: [__dirname + '/migrations/*{.ts,.js}'],
      // 开发环境自动同步，生产环境必须手动执行 migration:run
      synchronize: process.env.NODE_ENV !== 'production',
      logging: process.env.NODE_ENV === 'development',
    }),
    TypeOrmModule.forFeature([AttendanceRecord, User, Appeal]),
    AuthModule,
    UsersModule,
    AttendanceModule,
    AppealModule,
    StaffModule,
    StatsModule,
    HouseModule,
    PerformanceModule,
  ],
  controllers: [
    AppController,
    NotificationController,
    RoleConfigController,
  ],
})
export class AppModule {}
