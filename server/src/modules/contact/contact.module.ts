import { Module } from '@nestjs/common';
import { CommonModule } from '@/common/common.module';
import { RedisModule } from '../redis/redis.module';
import { ContactController } from './contact.controller';
import { ContactService } from './contact.service';

/**
 * Contact 模块 —— 公开展示的「联系方式」资料
 *   · 公开 GET /contact（ContactPage 消费，游客可看）
 *   · 管理 PUT /contact（需 JWT，admin 在 Profile 页编辑）
 *   · Service 层：接 Prisma（User 表扩列）+ Redis 1min 公共缓存（读写失败都降级）
 */
@Module({
  imports: [CommonModule, RedisModule],
  controllers: [ContactController],
  providers: [ContactService],
  exports: [ContactService],
})
export class ContactModule {}
