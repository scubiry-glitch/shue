import { Module } from '@nestjs/common';
import { StaffController } from './staff.controller';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [UsersModule],
  controllers: [StaffController],
})
export class StaffModule {}
