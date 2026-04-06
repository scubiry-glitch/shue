import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { UserRole } from '../users/user.entity';

/**
 * 房源分配表：记录哪些用户/角色负责哪些房源
 *
 * 规则：
 *  - checkIn 时校验当前用户在 validFrom~validTo 范围内有该房源的分配
 *  - ADMIN / ASSET_MANAGER 全局放行（不走此表）
 *  - 可以按 userId 指定个人，也可以按 departmentId 指定整个部门
 */
@Entity('house_assignments')
@Index(['houseId', 'userId'])
@Index(['houseId', 'departmentId'])
@Index(['userId', 'validTo'])
export class HouseAssignment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'house_id' })
  houseId: string;

  /** 分配给具体人（与 departmentId 二选一） */
  @Column({ name: 'user_id', nullable: true })
  userId: string;

  /** 分配给整个部门（与 userId 二选一） */
  @Column({ name: 'department_id', nullable: true })
  departmentId: string;

  /** 限定角色（null = 不限） */
  @Column({ type: 'enum', enum: UserRole, nullable: true })
  role: UserRole;

  @Column({ name: 'valid_from', type: 'date' })
  validFrom: string;

  @Column({ name: 'valid_to', type: 'date', nullable: true })
  validTo: string;

  @Column({ default: true, name: 'is_active' })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
