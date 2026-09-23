import { Module } from '@nestjs/common';
import { CommonModule } from '@/common/common.module';
import { RedisModule } from '../redis/redis.module';
import { PortfolioController } from './portfolio.controller';
import { PortfolioService } from './portfolio.service';

/**
 * Portfolio 模块 —— 作品集 CRUD
 *   · 公开 GET /portfolio（PortfolioPage 消费，游客可看）
 *   · 公开 GET /portfolio/:slug（作品详情页，游客可看）
 *   · 管理 GET /portfolio/admin/list（需 JWT，admin 后台用）
 *   · 管理 POST /portfolio（需 JWT，创建作品）
 *   · 管理 PUT /portfolio/reorder（需 JWT，批量排序）
 *   · 管理 PUT /portfolio/:id（需 JWT，更新作品）
 *   · 管理 DELETE /portfolio/:id（需 JWT，删除作品）
 *   · Service 层：接 Prisma（Work 表）+ Redis 1min 公共缓存（读写失败都降级）
 */
@Module({
  imports: [CommonModule, RedisModule],
  controllers: [PortfolioController],
  providers: [PortfolioService],
  exports: [PortfolioService],
})
export class PortfolioModule {}
