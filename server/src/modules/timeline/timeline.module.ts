import { Module } from '@nestjs/common';
import { CommonModule } from '@/common/common.module';
import { RedisModule } from '../redis/redis.module';
import { TimelineController } from './timeline.controller';
import { TimelineService } from './timeline.service';

/**
 * Timeline 模块 —— 经历时间线 CRUD
 *   · 公开 GET /timeline（TimelinePage 消费，游客可看）
 *   · 管理 GET /timeline/admin/list（需 JWT，含已隐藏条目）
 *   · 管理 GET /timeline/admin/meta（需 JWT，编辑器候选标签）
 *   · 管理 POST /timeline（需 JWT，新建经历）
 *   · 管理 PUT /timeline/:id（需 JWT，更新经历）
 *   · 管理 DELETE /timeline/:id（需 JWT，删除经历）
 *   · Service 层：接 Prisma（TimelineNode 表）+ Redis 1min 公共缓存（读写失败都降级）
 */
@Module({
  imports: [CommonModule, RedisModule],
  controllers: [TimelineController],
  providers: [TimelineService],
  exports: [TimelineService],
})
export class TimelineModule {}
