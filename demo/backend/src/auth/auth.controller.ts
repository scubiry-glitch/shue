import { Controller, Post, Get, Body, Headers, UnauthorizedException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { Public } from './public.decorator';

class MockLoginDto {
  email: string;
  password: string;
}

class SupabaseLoginDto {
  supabaseToken: string;
}

@ApiTags('认证授权')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * 获取当前认证模式（mock | supabase）
   */
  @Public()
  @Get('mode')
  @ApiOperation({ summary: '获取认证模式' })
  getAuthMode() {
    return { mode: this.authService.authMode };
  }

  /**
   * Mock 模式登录（仅 AUTH_MODE=mock 有效）
   */
  @Public()
  @Post('mock/login')
  @ApiOperation({ summary: 'Mock模式登录' })
  @ApiBody({ type: MockLoginDto })
  async mockLogin(@Body() dto: MockLoginDto) {
    if (this.authService.authMode !== 'mock') {
      throw new UnauthorizedException('当前不是mock模式，请使用Supabase登录');
    }
    return this.authService.mockLogin(dto.email, dto.password);
  }

  /**
   * 获取 Mock 用户列表（仅 AUTH_MODE=mock 有效，供前端展示快速登录）
   */
  @Public()
  @Get('mock/users')
  @ApiOperation({ summary: '获取Mock用户列表' })
  getMockUsers() {
    if (this.authService.authMode !== 'mock') {
      return { users: [] };
    }
    return { users: this.authService.getMockUserList() };
  }

  /**
   * Supabase 模式登录：传入 Supabase JWT，换取系统 JWT
   */
  @Public()
  @Post('supabase/login')
  @ApiOperation({ summary: 'Supabase模式登录（传入Supabase JWT）' })
  @ApiBody({ type: SupabaseLoginDto })
  async supabaseLogin(@Body() dto: SupabaseLoginDto) {
    if (this.authService.authMode !== 'supabase') {
      throw new UnauthorizedException('当前不是supabase模式，请使用mock登录');
    }
    return this.authService.validateSupabaseToken(dto.supabaseToken);
  }

  /**
   * 验证当前 token 并返回用户信息
   */
  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取当前登录用户信息' })
  getMe(@Headers('authorization') auth: string) {
    // The JwtAuthGuard (applied globally) already validated the token.
    // User is injected via request object; return from guard-set context.
    // Here we just acknowledge — actual user data comes from request in real impl.
    return { message: '已登录' };
  }
}
