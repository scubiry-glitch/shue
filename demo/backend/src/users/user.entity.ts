import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

export enum UserRole {
  ACCOUNT_MANAGER = 'ACCOUNT_MANAGER', // 客户经理
  AGENT = 'AGENT',                     // 经纪人
  HOUSE_MANAGER = 'HOUSE_MANAGER',     // 租户管家
  ASSET_MANAGER = 'ASSET_MANAGER',     // 资管经理
  ADMIN = 'ADMIN',                     // 管理员
}

export const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  [UserRole.ADMIN]: [
    'user:read', 'user:write', 'user:delete',
    'attendance:read', 'attendance:write',
    'stats:read', 'nfc:manage', 'appeal:manage',
    'staff:manage', 'role:manage',
  ],
  [UserRole.ACCOUNT_MANAGER]: [
    'attendance:read', 'attendance:write',
    'stats:read', 'appeal:create',
  ],
  [UserRole.AGENT]: [
    'attendance:read', 'attendance:write',
    'stats:read', 'appeal:create',
  ],
  [UserRole.HOUSE_MANAGER]: [
    'attendance:read', 'attendance:write',
    'stats:read', 'appeal:create',
  ],
  [UserRole.ASSET_MANAGER]: [
    'attendance:read', 'attendance:write',
    'stats:read', 'appeal:create',
  ],
};

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  @ApiProperty()
  id: string;

  @Column({ unique: true })
  @ApiProperty()
  email: string;

  @Column()
  @ApiProperty()
  name: string;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.AGENT })
  @ApiProperty({ enum: UserRole })
  role: UserRole;

  @Column({ nullable: true })
  @ApiProperty({ required: false })
  department: string;

  @Column({ nullable: true })
  @ApiProperty({ required: false })
  phone: string;

  // Supabase user ID (used in supabase auth mode)
  @Column({ nullable: true, name: 'supabase_id' })
  supabaseId: string;

  // Mock password (only used in mock mode, hashed with bcrypt in prod)
  @Column({ nullable: true, name: 'mock_password', select: false })
  mockPassword: string;

  // ─── Staff 扩展字段（原 StaffController 中的硬编码数据）────────────────────
  @Column({ nullable: true, length: 8 })
  @ApiProperty({ required: false, description: '职级 S1/A/M 等' })
  level: string;

  @Column({ type: 'date', nullable: true, name: 'join_date' })
  @ApiProperty({ required: false })
  joinDate: Date;

  @Column({ nullable: true, name: 'device_model', length: 64 })
  @ApiProperty({ required: false })
  deviceModel: string;

  @Column({ nullable: true, name: 'status_note', length: 128 })
  @ApiProperty({ required: false, description: '状态备注（如：低绩效预警）' })
  statusNote: string;

  @Column({ default: true, name: 'is_active' })
  @ApiProperty()
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  get permissions(): string[] {
    return ROLE_PERMISSIONS[this.role] || [];
  }
}
