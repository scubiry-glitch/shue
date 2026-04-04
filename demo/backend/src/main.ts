import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  
  app.enableCors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  });

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
  console.log(`🚀 NFC考勤系统后端服务启动成功！端口: ${PORT}`);
  console.log(`📚 API文档: http://localhost:${PORT}/api-docs`);
  console.log(`🌐 管理页面: http://localhost:${PORT}/`);
}
bootstrap();
