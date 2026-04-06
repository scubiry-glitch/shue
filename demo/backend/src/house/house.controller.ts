import { Controller, Get, Post, Delete, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { HouseService } from './house.service';
import { CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { UserRole, User } from '../users/user.entity';

@ApiTags('房源管理')
@ApiBearerAuth()
@Controller('houses')
export class HouseController {
  constructor(private readonly houseService: HouseService) {}

  @Get('assignments/mine')
  @ApiOperation({ summary: '查询我负责的房源列表' })
  getMyAssignments(@CurrentUser() user: User) {
    return this.houseService.listByUser(user.id);
  }

  @Get(':houseId/assignments')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: '查询某房源的分配记录（管理员）' })
  getAssignments(@Param('houseId') houseId: string) {
    return this.houseService.listByHouse(houseId);
  }

  @Post('assignments')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: '分配房源给用户或部门（管理员）' })
  assign(
    @Body() body: {
      houseId: string;
      userId?: string;
      departmentId?: string;
      role?: UserRole;
      validFrom: string;
      validTo?: string;
    },
  ) {
    return this.houseService.assign(body);
  }

  @Delete('assignments/:id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: '撤销房源分配（管理员）' })
  revoke(@Param('id') id: string) {
    return this.houseService.revoke(id);
  }
}
