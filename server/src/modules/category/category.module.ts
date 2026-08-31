import { Module } from '@nestjs/common';
import { CategoryController } from './category.controller';
import { CategoryService } from './category.service';

/**
 * Category 模块 — 文章分类管理
 *   · 公开 GET /api/categories（含每个分类的文章数）
 *   · 管理 POST/PUT/DELETE /api/categories（需 JWT）
 */
@Module({
  controllers: [CategoryController],
  providers: [CategoryService],
  exports: [CategoryService],
})
export class CategoryModule {}
