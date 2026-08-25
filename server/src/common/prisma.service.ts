import { Injectable, OnModuleInit, Logger } from '@nestjs/common';

/**
 * Prisma Service（骨架占位模式）
 *
 * ─────────────────────────────────────────────────────
 * 阶段一（当前）：未接入数据库，仅保留类型与依赖注入管道
 *   · 不 extends PrismaClient（因尚未执行 prisma generate）
 *   · this.prisma 为 undefined，所有调用会打印 warning
 *
 * 阶段二（接入 MySQL 时）替换为真实 Prisma：
 *   1. 在 prisma/schema.prisma 中写好 model
 *   2. 执行 `npx prisma generate` + `npm run prisma:migrate`
 *   3. 修改下面的 import 与继承：
 *
 *      import { PrismaClient } from '@prisma/client';
 *
 *      @Injectable()
 *      export class PrismaService
 *        extends PrismaClient
 *        implements OnModuleInit {
 *        async onModuleInit() { await this.$connect(); }
 *      }
 * ─────────────────────────────────────────────────────
 */
@Injectable()
export class PrismaService implements OnModuleInit {
  private readonly logger = new Logger(PrismaService.name);
  readonly prisma: null = null;

  async onModuleInit() {
    this.logger.warn(
      'PrismaService 处于骨架占位模式。' +
        '写好 prisma/schema.prisma 并执行 `npm run prisma:generate` 后，' +
        '请按本文件顶部注释切换为真实 PrismaClient。',
    );
  }
}
