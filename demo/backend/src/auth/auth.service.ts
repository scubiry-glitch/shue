import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';
import { User, UserRole, ROLE_PERMISSIONS } from '../users/user.entity';

export interface JwtPayload {
  sub: string;       // user id
  email: string;
  name: string;
  role: UserRole;
  mode: 'mock' | 'supabase';
  // Supabase JWT also contains these:
  aud?: string;
  iss?: string;
}

export interface AuthResult {
  token: string;
  refreshToken: string;
  expiresIn: number; // seconds
  user: {
    id: string;
    email: string;
    name: string;
    role: UserRole;
    department?: string;
    permissions: string[];
  };
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  get authMode(): 'mock' | 'supabase' {
    return (this.configService.get<string>('AUTH_MODE') || 'mock') as 'mock' | 'supabase';
  }

  private readonly ACCESS_TOKEN_EXPIRES = 60 * 60 * 2;    // 2小时
  private readonly REFRESH_TOKEN_EXPIRES = 60 * 60 * 24 * 30; // 30天

  private buildTokenPair(payload: JwtPayload): { token: string; refreshToken: string; expiresIn: number } {
    const token = this.jwtService.sign(payload, { expiresIn: this.ACCESS_TOKEN_EXPIRES });
    const refreshToken = this.jwtService.sign(
      { sub: payload.sub, type: 'refresh', mode: payload.mode },
      { expiresIn: this.REFRESH_TOKEN_EXPIRES },
    );
    return { token, refreshToken, expiresIn: this.ACCESS_TOKEN_EXPIRES };
  }

  // ─── Mock Mode ────────────────────────────────────────────────────────────

  async mockLogin(email: string, password: string): Promise<AuthResult> {
    const mockUser = this.usersService.findMockUserByEmail(email);
    if (!mockUser || mockUser.mockPassword !== password) {
      throw new UnauthorizedException('用户名或密码错误');
    }

    const payload: JwtPayload = {
      sub: mockUser.id,
      email: mockUser.email,
      name: mockUser.name,
      role: mockUser.role,
      mode: 'mock',
    };

    const tokens = this.buildTokenPair(payload);
    return {
      ...tokens,
      user: {
        id: mockUser.id,
        email: mockUser.email,
        name: mockUser.name,
        role: mockUser.role,
        department: mockUser.department,
        permissions: ROLE_PERMISSIONS[mockUser.role] || [],
      },
    };
  }

  async refreshAccessToken(refreshToken: string): Promise<{ token: string; expiresIn: number }> {
    let payload: any;
    try {
      payload = this.jwtService.verify(refreshToken);
    } catch {
      throw new UnauthorizedException('refresh token 无效或已过期，请重新登录');
    }
    if (payload.type !== 'refresh') {
      throw new UnauthorizedException('token 类型错误');
    }

    const mode: 'mock' | 'supabase' = payload.mode || 'mock';

    if (mode === 'mock') {
      const mockUser = this.usersService.getMockUsers().find(u => u.id === payload.sub);
      if (!mockUser) throw new UnauthorizedException('用户不存在');
      const newPayload: JwtPayload = {
        sub: mockUser.id,
        email: mockUser.email,
        name: mockUser.name,
        role: mockUser.role,
        mode: 'mock',
      };
      const token = this.jwtService.sign(newPayload, { expiresIn: this.ACCESS_TOKEN_EXPIRES });
      return { token, expiresIn: this.ACCESS_TOKEN_EXPIRES };
    } else {
      const user = await this.usersService.findById(payload.sub);
      if (!user) throw new UnauthorizedException('用户不存在');
      const newPayload: JwtPayload = {
        sub: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        mode: 'supabase',
      };
      const token = this.jwtService.sign(newPayload, { expiresIn: this.ACCESS_TOKEN_EXPIRES });
      return { token, expiresIn: this.ACCESS_TOKEN_EXPIRES };
    }
  }

  getMockUserList() {
    return this.usersService.getMockUsers();
  }

  // ─── Supabase Mode ────────────────────────────────────────────────────────

  /**
   * Validate a Supabase JWT and upsert the user into our DB.
   * The Supabase JWT is signed with SUPABASE_JWT_SECRET.
   */
  async validateSupabaseToken(supabaseToken: string): Promise<AuthResult> {
    const supabaseJwtSecret = this.configService.get<string>('SUPABASE_JWT_SECRET');
    if (!supabaseJwtSecret) {
      throw new UnauthorizedException('Supabase JWT secret未配置');
    }

    let supabasePayload: any;
    try {
      supabasePayload = this.jwtService.verify(supabaseToken, {
        secret: supabaseJwtSecret,
      });
    } catch (err) {
      this.logger.warn(`Supabase token验证失败: ${err.message}`);
      throw new UnauthorizedException('Supabase token无效或已过期');
    }

    // supabasePayload.sub = supabase user uuid
    // supabasePayload.email = user email
    const supabaseId: string = supabasePayload.sub;
    const email: string = supabasePayload.email || '';
    const name: string =
      supabasePayload.user_metadata?.full_name ||
      supabasePayload.user_metadata?.name ||
      email;

    // Upsert user in our DB
    const user = await this.usersService.upsertFromSupabase(supabaseId, email, name);

    // Issue our own app JWT pair
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      mode: 'supabase',
    };

    const tokens = this.buildTokenPair(payload);
    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        department: user.department,
        permissions: ROLE_PERMISSIONS[user.role] || [],
      },
    };
  }

  // ─── Token validation (used by JwtStrategy) ───────────────────────────────

  async validatePayload(payload: JwtPayload): Promise<User | null> {
    if (payload.mode === 'mock') {
      // For mock mode, construct a virtual user without DB lookup
      const mockUser = this.usersService.findMockUserByEmail(payload.email);
      if (!mockUser) return null;
      const user = new User();
      user.id = mockUser.id;
      user.email = mockUser.email;
      user.name = mockUser.name;
      user.role = mockUser.role;
      user.department = mockUser.department;
      user.isActive = true;
      return user;
    }
    return this.usersService.findById(payload.sub);
  }
}
