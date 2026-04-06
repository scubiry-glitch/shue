import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole } from './user.entity';

// Default mock users for development / mock mode
const MOCK_USERS = [
  {
    id: 'mock_admin_001',
    email: 'admin@demo.com',
    name: '系统管理员',
    role: UserRole.ADMIN,
    department: '管理部',
    mockPassword: 'admin123',
  },
  {
    id: 'mock_user_001',
    email: 'zhangsan@demo.com',
    name: '张三',
    role: UserRole.AGENT,
    department: '经纪部',
    mockPassword: '123456',
  },
  {
    id: 'mock_user_002',
    email: 'lisi@demo.com',
    name: '李四',
    role: UserRole.HOUSE_MANAGER,
    department: '管家部',
    mockPassword: '123456',
  },
  {
    id: 'mock_user_003',
    email: 'wangwu@demo.com',
    name: '王五',
    role: UserRole.ACCOUNT_MANAGER,
    department: '客户部',
    mockPassword: '123456',
  },
  {
    id: 'mock_user_004',
    email: 'zhaoliu@demo.com',
    name: '赵六',
    role: UserRole.ASSET_MANAGER,
    department: '资管部',
    mockPassword: '123456',
  },
];

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  async findById(id: string): Promise<User | null> {
    return this.userRepo.findOne({ where: { id, isActive: true } });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.userRepo.findOne({ where: { email, isActive: true } });
  }

  async findBySupabaseId(supabaseId: string): Promise<User | null> {
    return this.userRepo.findOne({ where: { supabaseId, isActive: true } });
  }

  async findAll(): Promise<User[]> {
    return this.userRepo.find({ where: { isActive: true } });
  }

  async upsertFromSupabase(supabaseId: string, email: string, name: string): Promise<User> {
    let user = await this.findBySupabaseId(supabaseId);
    if (!user) {
      user = await this.findByEmail(email);
    }
    if (!user) {
      user = this.userRepo.create({
        email,
        name: name || email,
        role: UserRole.AGENT,
        supabaseId,
      });
    } else {
      user.supabaseId = supabaseId;
      user.name = name || user.name;
    }
    return this.userRepo.save(user);
  }

  async ensureMockUsersExist(): Promise<void> {
    for (const mockUser of MOCK_USERS) {
      const existing = await this.findByEmail(mockUser.email);
      if (!existing) {
        const user = this.userRepo.create({
          ...mockUser,
          isActive: true,
        });
        await this.userRepo.save(user);
      }
    }
  }

  getMockUsers() {
    return MOCK_USERS.map(({ mockPassword: _, ...u }) => u);
  }

  findMockUserByEmail(email: string) {
    return MOCK_USERS.find(u => u.email === email) || null;
  }
}
