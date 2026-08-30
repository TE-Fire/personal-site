import { Module } from '@nestjs/common';
import { CommonModule } from '@/common/common.module';
import { RedisModule } from '../redis/redis.module';
import { ContributionController } from './contribution.controller';
import { ContributionService } from './contribution.service';

/**
 * Contribution 模块 —— 贡献热力图
 *
 * 三个数据源（方案 D 三态）：
 *   · SITE  本站聚合（Phase 1 已实现：Post / Life / Note 业务表 created_at 按日统计）
 *   · GITHUB GitHub GraphQL（Phase 2 实现：user.contributionsCollection）
 *   · MERGED 合并视图（Phase 3 实现：SITE + GITHUB 按 date 合并 count）
 *
 * 架构要点：
 *   · Controller 层：三态各自独立路由，SITE 用 OptionalJWT（游客默认 userId=1）
 *   · Service 层：Redis 二级缓存（6h / 24h / 6h），DB 聚合防御真实表不存在
 *   · 导出 ContributionService：供 AboutService 在 admin 更新热力图配置时删缓存钩子调用
 */
@Module({
  imports: [CommonModule, RedisModule],
  controllers: [ContributionController],
  providers: [ContributionService],
  exports: [ContributionService],
})
export class ContributionModule {}
