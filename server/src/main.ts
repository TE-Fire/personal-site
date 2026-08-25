import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/global-exception.filter';
import { buildValidationPipe } from './common/validation.pipe';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    cors: true,
    bufferLogs: true,
  });

  const logger = new Logger('Bootstrap');
  const port = process.env.PORT ? Number(process.env.PORT) : 3000;
  const apiPrefix = process.env.API_PREFIX ?? 'api';

  /* ---------- 全局中间件 ---------- */
  app.use(helmet());

  // CORS：从 .env 解析，多域名逗号分隔
  const origins = (process.env.CORS_ORIGIN ?? '*')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  app.enableCors({
    origin: origins.length === 1 && origins[0] === '*' ? '*' : origins,
    credentials: true,
  });

  /* ---------- 全局路由前缀 ---------- */
  app.setGlobalPrefix(apiPrefix, {
    exclude: [{ path: 'health', method: 0 as any }], // 健康检查排除
  });

  /* ---------- 全局管道：参数校验 ---------- */
  app.useGlobalPipes(buildValidationPipe());

  /* ---------- 全局异常过滤器：统一响应结构 ---------- */
  app.useGlobalFilters(new GlobalExceptionFilter());

  /* ---------- Swagger 文档 ---------- */
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Personal Site API')
    .setDescription('个人站点后端接口文档 · NestJS + Prisma')
    .setVersion('0.0.1')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup(`${apiPrefix}/docs`, app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      docExpansion: 'list',
      filter: true,
    },
  });

  await app.listen(port);

  logger.log(`🚀 Server running on http://localhost:${port}`);
  logger.log(`📖 Swagger docs:   http://localhost:${port}/${apiPrefix}/docs`);
  logger.log(`💚 Health check:   http://localhost:${port}/health`);
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[bootstrap failed]', err);
  process.exit(1);
});
