import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Prisma Service
 *
 * 全局唯一的 PrismaClient 实例（CommonModule @Global() 已导出）
 * 其他 Service 通过依赖注入直接使用：
 *
 *   constructor(private readonly prisma: PrismaService) {}
 *
 *   const user = await this.prisma.user.findUnique({ where: { id: 1 } });
 *
 * 注意：PrismaClient 已经做了连接池管理，不要自己 new PrismaClient()
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    await this.$connect();
    this.logger.log('PrismaClient connected');
  }
}
