import { Controller, Post, Get, Body, Request, UnauthorizedException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { Public } from './public.decorator';

class SupabaseLoginDto {
  supabaseToken: string;
}

@ApiTags('认证授权')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * 移动端用 Supabase access_token 换取 App JWT
   * 流程: 移动端 → Supabase Auth → supabaseToken → POST /auth/login → App JWT
   */
  @Public()
  @Post('login')
  @ApiOperation({ summary: '登录（传入 Supabase access_token）' })
  @ApiBody({ type: SupabaseLoginDto })
  async login(@Body() dto: SupabaseLoginDto) {
    if (!dto.supabaseToken) {
      throw new UnauthorizedException('supabaseToken 不能为空');
    }
    return this.authService.loginWithSupabaseToken(dto.supabaseToken);
  }

  /**
   * 用 refreshToken 换取新的 accessToken
   */
  @Public()
  @Post('refresh')
  @ApiOperation({ summary: '刷新 accessToken' })
  @ApiBody({ schema: { properties: { refreshToken: { type: 'string' } } } })
  async refresh(@Body('refreshToken') refreshToken: string) {
    if (!refreshToken) {
      throw new UnauthorizedException('refreshToken 不能为空');
    }
    return this.authService.refreshAccessToken(refreshToken);
  }

  /**
   * 获取当前登录用户信息
   */
  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取当前登录用户' })
  getMe(@Request() req: any) {
    const user = req.user;
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      department: user.department,
      permissions: user.permissions,
    };
  }
}
