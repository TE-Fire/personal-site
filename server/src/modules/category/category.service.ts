import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/common/prisma.service';
import { BusinessException } from '@/common/exception';
import { getCategoryErrorInfo } from './enums/category-biz-error.enum';
import { CategoryBizError } from './enums/category-biz-error.enum';
import {
  CategoryVo,
  CreateCategoryDto,
  UpdateCategoryDto,
} from './dto/category.dto';

/**
 * Category Service — 基于 Prisma 的分类 CRUD
 *
 * 遵循 NestJS-Architecture-Guide.md 分层架构：Controller → Service → Prisma
 *
 * 删除策略（逻辑外键模式，onDelete:SetNull 需手动执行）：
 *   删分类前，先把所有 Post.categoryId 置 null，再删 Category（事务）
 */
@Injectable()
export class CategoryService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 查询全部分类（含文章数）
   * 按 sort ASC 排序
   */
  async findAll(): Promise<CategoryVo[]> {
    const categories = await this.prisma.category.findMany({
      include: {
        _count: { select: { posts: true } },
      },
      orderBy: { sort: 'asc' },
    });
    return categories.map((c) => ({
      id: c.id,
      name: c.name,
      sort: c.sort,
      postCount: c._count.posts,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    }));
  }

  /**
   * 创建分类
   * @param dto      name + sort
   * @param authorId 从 JWT 注入
   */
  async create(dto: CreateCategoryDto, authorId: number): Promise<CategoryVo> {
    try {
      const category = await this.prisma.category.create({
        data: {
          name: dto.name,
          sort: dto.sort ?? 0,
          author: { connect: { id: authorId } },
        },
      });
      return this.toVo(category, 0);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new BusinessException(getCategoryErrorInfo(CategoryBizError.NAME_CONFLICT));
      }
      throw e;
    }
  }

  /**
   * 更新分类（name / sort）
   */
  async update(id: number, dto: UpdateCategoryDto): Promise<CategoryVo> {
    const existing = await this.prisma.category.findUnique({ where: { id } });
    if (!existing) {
      throw new BusinessException(getCategoryErrorInfo(CategoryBizError.NOT_FOUND));
    }

    const data: Prisma.CategoryUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.sort !== undefined) data.sort = dto.sort;

    try {
      const category = await this.prisma.category.update({
        where: { id },
        data,
        include: { _count: { select: { posts: true } } },
      });
      return this.toVo(category, category._count.posts);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new BusinessException(getCategoryErrorInfo(CategoryBizError.NAME_CONFLICT));
      }
      throw e;
    }
  }

  /**
   * 删除分类
   * 逻辑外键模式：先 Post.categoryId = null，再删 Category（事务）
   */
  async remove(id: number): Promise<void> {
    const existing = await this.prisma.category.findUnique({ where: { id } });
    if (!existing) {
      throw new BusinessException(getCategoryErrorInfo(CategoryBizError.NOT_FOUND));
    }

    await this.prisma.$transaction([
      // 1. 解除关联：文章分类置空
      this.prisma.post.updateMany({
        where: { categoryId: id },
        data: { categoryId: null },
      }),
      // 2. 删除分类
      this.prisma.category.delete({ where: { id } }),
    ]);
  }

  /* ---------- VO 转换 ---------- */
  private toVo(
    c: { id: number; name: string; sort: number; createdAt: Date; updatedAt: Date },
    postCount: number,
  ): CategoryVo {
    return {
      id: c.id,
      name: c.name,
      sort: c.sort,
      postCount,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    };
  }
}
