import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';
import { User, UserRole, ROLE_PERMISSIONS } from '../users/user.entity';

export interface JwtPayload {
  sub: string;   // user id (our DB uuid)
  email: string;
  name: string;
  role: UserRole;
  aud?: string;
  iss?: string;
}

export interface AuthResult {
  token: string;
  refreshToken: string;
  expiresIn: number;
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

  private readonly ACCESS_TOKEN_EXPIRES = 60 * 60 * 2;       // 2h
  private readonly REFRESH_TOKEN_EXPIRES = 60 * 60 * 24 * 30; // 30d

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  private buildTokenPair(payload: JwtPayload): { token: string; refreshToken: string; expiresIn: number } {
    const token = this.jwtService.sign(payload, { expiresIn: this.ACCESS_TOKEN_EXPIRES });
    const refreshToken = this.jwtService.sign(
      { sub: payload.sub, type: 'refresh' },
      { expiresIn: this.REFRESH_TOKEN_EXPIRES },
    );
    return { token, refreshToken, expiresIn: this.ACCESS_TOKEN_EXPIRES };
  }

  /**
   * 用 Supabase JWT 换取 App JWT。
   * 移动端先向 Supabase Auth 登录，拿到 access_token 后调用此方法。
   */
  async loginWithSupabaseToken(supabaseToken: string): Promise<AuthResult> {
    const secret = this.configService.get<string>('SUPABASE_JWT_SECRET');
    if (!secret) {
      throw new UnauthorizedException('SUPABASE_JWT_SECRET 未配置，请联系管理员');
    }

    let supabasePayload: any;
    try {
      supabasePayload = this.jwtService.verify(supabaseToken, { secret });
    } catch (err) {
      this.logger.warn(`Supabase token 验证失败: ${err.message}`);
      throw new UnauthorizedException('Supabase token 无效或已过期，请重新登录');
    }

    const supabaseId: string = supabasePayload.sub;
    const email: string = supabasePayload.email || '';
    const name: string =
      supabasePayload.user_metadata?.full_name ||
      supabasePayload.user_metadata?.name ||
      email;

    const user = await this.usersService.upsertFromSupabase(supabaseId, email, name);

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
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

    const user = await this.usersService.findById(payload.sub);
    if (!user) throw new UnauthorizedException('用户不存在');

    const newPayload: JwtPayload = {
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    };
    const token = this.jwtService.sign(newPayload, { expiresIn: this.ACCESS_TOKEN_EXPIRES });
    return { token, expiresIn: this.ACCESS_TOKEN_EXPIRES };
  }

  /** JwtStrategy 回调：验证 payload 并返回完整 User 对象 */
  async validatePayload(payload: JwtPayload): Promise<User | null> {
    return this.usersService.findById(payload.sub);
  }
}
