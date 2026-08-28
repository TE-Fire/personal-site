import { Global, Module } from '@nestjs/common';
import { RedisService } from './redis.service';

/**
 * 全局 Redis 模块
 * 提供 ioredis 客户端，所有模块均可注入 RedisService
 */
@Global()
@Module({
  providers: [RedisService],
  exports: [RedisService],
})
export class RedisModule {}
