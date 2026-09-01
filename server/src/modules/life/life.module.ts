import { Module } from '@nestjs/common';
import { LifeController } from './life.controller';
import { LifeService } from './life.service';
import { LocalStorageService } from './storage.service';

/**
 * Life Module — 生活碎片模块
 *
 * 组成：
 *   · LifeController  — 碎片 + 相册 REST API + 上传
 *   · LifeService     — 碎片/相册 CRUD（Prisma 直接操作，无缓存层）
 *   · LocalStorageService — 本地文件存储（格式/大小校验 + 删除清理）
 *
 * 依赖：
 *   · PrismaService — 全局（CommonModule @Global()），无需 imports PrismaModule
 */
@Module({
  controllers: [LifeController],
  providers: [LifeService, LocalStorageService],
  exports: [LifeService, LocalStorageService],
})
export class LifeModule {}
