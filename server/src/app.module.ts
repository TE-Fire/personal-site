import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CommonModule } from './common/common.module';
import { RedisModule } from './modules/redis/redis.module';
import { AuthModule } from './modules/auth/auth.module';
import { UserModule } from './modules/user/user.module';
import { AboutModule } from './modules/about/about.module';
import { PostModule } from './modules/post/post.module';
import { CategoryModule } from './modules/category/category.module';
import { TagModule } from './modules/tag/tag.module';
import { ContributionModule } from './modules/contribution/contribution.module';
import { AppController } from './app.controller';

/**
 * 根模块 AppModule
 *
 * imports 顺序：
 *   1. ConfigModule —— 环境变量最先加载
 *   2. CommonModule —— 全局基础设施（PrismaService 等）
 *   3. RedisModule  —— 全局 Redis（验证码/缓存/Token）
 *   4. 业务模块 —— Auth / User / About / Post / Contribution
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    CommonModule,
    RedisModule,
    AuthModule,
    UserModule,
    AboutModule,
    PostModule,
    CategoryModule,
    TagModule,
    ContributionModule,
  ],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}
