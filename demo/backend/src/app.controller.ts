import { Controller, Get, Redirect } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('系统')
@Controller()
export class AppController {
  @Get()
  @Redirect('/api-docs', 302)
  @ApiOperation({ summary: '首页重定向到API文档' })
  redirectToDocs() {
    return;
  }

  @Get('health')
  @ApiOperation({ summary: '健康检查' })
  health() {
    return {
      status: 'ok',
      service: 'NFC考勤系统',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('config/nfc')
  @ApiOperation({ summary: '获取NFC写卡配置' })
  getNfcConfig() {
    return {
      nfcDomain: process.env.NFC_DOMAIN || 'nfc.meizu.life',
      urlTemplate: `https://${process.env.NFC_DOMAIN || 'nfc.meizu.life'}/h5/#checkin?tag={tag_id}`,
    };
  }
}
