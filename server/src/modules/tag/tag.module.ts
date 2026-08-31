import { Module } from '@nestjs/common';
import { TagController } from './tag.controller';
import { TagService } from './tag.service';

/**
 * Tag 模块 — 文章标签管理
 *   · 公开 GET /api/tags（含每个标签的文章数）
 *   · 管理 POST/PUT/DELETE /api/tags（需 JWT）
 *   · 合并 POST /api/tags/:id/merge（把当前标签合并到目标标签）
 */
@Module({
  controllers: [TagController],
  providers: [TagService],
  exports: [TagService],
})
export class TagModule {}
