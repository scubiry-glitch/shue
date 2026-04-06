import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HouseAssignment } from './house-assignment.entity';
import { HouseService } from './house.service';
import { HouseController } from './house.controller';

@Module({
  imports: [TypeOrmModule.forFeature([HouseAssignment])],
  providers: [HouseService],
  controllers: [HouseController],
  exports: [HouseService],
})
export class HouseModule {}
