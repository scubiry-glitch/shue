import { Injectable, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HouseAssignment } from './house-assignment.entity';
import { UserRole } from '../users/user.entity';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class HouseService {
  constructor(
    @InjectRepository(HouseAssignment)
    private readonly assignmentRepo: Repository<HouseAssignment>,
    private readonly configService: ConfigService,
  ) {}

  /**
   * 验证用户是否有权限在该房源打卡
   * ADMIN / ASSET_MANAGER 全局放行
   */
  async assertCanAccessHouse(
    userId: string,
    userRole: UserRole,
    departmentId: string | undefined,
    houseId: string,
  ): Promise<void> {
    // 全局角色免检
    if (userRole === UserRole.ADMIN || userRole === UserRole.ASSET_MANAGER) return;

    const today = new Date().toISOString().slice(0, 10);

    const qb = this.assignmentRepo.createQueryBuilder('a')
      .where('a.houseId = :houseId', { houseId })
      .andWhere('a.isActive = true')
      .andWhere('a.validFrom <= :today', { today })
      .andWhere('(a.validTo IS NULL OR a.validTo >= :today)', { today });

    // 匹配个人 OR 部门
    qb.andWhere(
      '(a.userId = :userId OR a.departmentId = :departmentId)',
      { userId, departmentId: departmentId || '' },
    );

    let assignment: HouseAssignment | null = null;
    try {
      assignment = await qb.getOne();
    } catch (err: any) {
      const authMode = this.configService.get<string>('AUTH_MODE') || 'mock';
      // 兼容历史演示库：house_assignments 尚未建表时，mock 模式先放行，避免 checkin 500
      if (authMode === 'mock' && (err?.code === '42P01' || String(err?.message || '').includes('house_assignments'))) {
        return;
      }
      throw err;
    }
    if (!assignment) {
      throw new ForbiddenException(
        `您没有访问该房源的权限（houseId: ${houseId}），请联系管理员分配`,
      );
    }
  }

  // ─── 分配管理 ─────────────────────────────────────────────────────────────

  async assign(data: {
    houseId: string;
    userId?: string;
    departmentId?: string;
    role?: UserRole;
    validFrom: string;
    validTo?: string;
  }): Promise<HouseAssignment> {
    const entity = this.assignmentRepo.create({ ...data, isActive: true });
    return this.assignmentRepo.save(entity);
  }

  async revoke(id: string): Promise<void> {
    await this.assignmentRepo.update(id, { isActive: false });
  }

  async listByHouse(houseId: string): Promise<HouseAssignment[]> {
    return this.assignmentRepo.find({ where: { houseId, isActive: true } });
  }

  async listByUser(userId: string): Promise<HouseAssignment[]> {
    const today = new Date().toISOString().slice(0, 10);
    return this.assignmentRepo.createQueryBuilder('a')
      .where('a.userId = :userId', { userId })
      .andWhere('a.isActive = true')
      .andWhere('a.validFrom <= :today', { today })
      .andWhere('(a.validTo IS NULL OR a.validTo >= :today)', { today })
      .getMany();
  }
}
