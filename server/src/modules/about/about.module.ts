import { Module } from '@nestjs/common';
import { CommonModule } from '@/common/common.module';
import { RedisModule } from '../redis/redis.module';
import { AboutController } from './about.controller';
import { AboutService } from './about.service';

/**
 * About 模块 —— 公开展示的「关于我」资料
 *   · 公开 GET /about（AboutPage / HomePage / DraggableWidget 消费）
 *   · 管理 PUT /about（需 JWT，admin 在 Profile 页编辑）
 *   · Service 层：接 Prisma（User 表扩列）+ Redis 1min 公共缓存（读写失败都降级）
 */
@Module({
  imports: [CommonModule, RedisModule],
  controllers: [AboutController],
  providers: [AboutService],
  exports: [AboutService],
})
export class AboutModule {}
