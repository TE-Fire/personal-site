import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CommonModule } from './common/common.module';
import { AuthModule } from './modules/auth/auth.module';
import { UserModule } from './modules/user/user.module';
import { PostModule } from './modules/post/post.module';
import { AppController } from './app.controller';

/**
 * 根模块 AppModule
 *
 * imports 顺序：
 *   1. ConfigModule —— 环境变量最先加载
 *   2. CommonModule —— 全局基础设施（PrismaService 等）
 *   3. 业务模块 —— Auth / User / Post
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    CommonModule,
    AuthModule,
    UserModule,
    PostModule,
  ],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}
