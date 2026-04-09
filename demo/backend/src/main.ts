import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe, Logger } from '@nestjs/common';
import { join } from 'path';
import { AppModule } from './app.module';

function validateEnv() {
  const logger = new Logger('Bootstrap');

  // 生产环境必填项校验
  if (process.env.NODE_ENV === 'production') {
    const required = ['JWT_SECRET', 'DB_HOST', 'DB_USER', 'DB_PASS', 'DB_NAME'];
    const missing = required.filter(k => !process.env[k]);
    if (missing.length > 0) {
      throw new Error(`[Fatal] 生产环境缺少必填环境变量: ${missing.join(', ')}`);
    }

    if (process.env.JWT_SECRET === 'shue_jwt_secret_dev') {
      throw new Error('[Fatal] 生产环境不允许使用默认 JWT_SECRET，请设置强随机密钥');
    }

    if (!process.env.SUPABASE_JWT_SECRET) {
      throw new Error('[Fatal] 生产环境必须配置 SUPABASE_JWT_SECRET');
    }
  } else {
    // 开发环境仅提示
    if (!process.env.JWT_SECRET) {
      logger.warn('JWT_SECRET 未配置，使用开发默认值（生产环境禁止）');
    }
    if (!process.env.SUPABASE_JWT_SECRET) {
      logger.warn('SUPABASE_JWT_SECRET 未配置，/auth/login 将无法验证 Supabase token');
    }
  }
}

async function bootstrap() {
  validateEnv();

  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.enableCors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  });

  // P1-2: 全局 ValidationPipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,           // 自动剔除 DTO 中未声明的字段
      forbidNonWhitelisted: true, // 有多余字段时直接报错（防止注入）
      transform: true,           // 自动类型转换（string→number 等）
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // 提供静态文件
  app.useStaticAssets(join(__dirname, '..', 'public'));

  const config = new DocumentBuilder()
    .setTitle('NFC考勤系统 API')
    .setDescription('租务管家 NFC 考勤系统接口文档')
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api-docs', app, document);

  const PORT = process.env.PORT || 3010;
  await app.listen(PORT, '0.0.0.0');

  const logger = new Logger('Bootstrap');
  logger.log(`NFC考勤系统启动成功，端口: ${PORT}`);
  logger.log(`认证模式: Supabase JWT`);
  logger.log(`Supabase 项目: ${process.env.SUPABASE_URL || '(未配置)'}`);
  logger.log(`环境: ${process.env.NODE_ENV || 'development'}`);
  logger.log(`API文档: http://localhost:${PORT}/api-docs`);
}
bootstrap();
