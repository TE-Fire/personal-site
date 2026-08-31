import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/common/prisma.service';
import { BusinessException } from '@/common/exception';
import { getTagErrorInfo } from './enums/tag-biz-error.enum';
import { TagBizError } from './enums/tag-biz-error.enum';
import {
  TagVo,
  CreateTagDto,
  UpdateTagDto,
  MergeTagDto,
} from './dto/tag.dto';

/**
 * Tag Service — 基于 Prisma 的标签 CRUD + 合并
 *
 * 遵循 NestJS-Architecture-Guide.md 分层架构：Controller → Service → Prisma
 *
 * 重命名优势：Tag 表全局唯一 name，renameTag 只需 UPDATE 一行（PostTag 不变）
 * 合并逻辑（事务 + raw SQL，修改联合主键 tagId 列）：
 *   1. 删除重复 PostTag（文章同时有 source 和 target → 保留 target）
 *   2. UPDATE post_tag SET tag_id = target WHERE tag_id = source
 *   3. DELETE tag WHERE id = source
 *
 * 删除策略（逻辑外键模式，onDelete:Cascade 需手动执行）：
 *   删标签前，先删所有 PostTag where tagId = id，再删 Tag（事务）
 */
@Injectable()
export class TagService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 查询全部标签（含文章数）
   * 按文章数 DESC 排序（常用标签在前）
   */
  async findAll(): Promise<TagVo[]> {
    const tags = await this.prisma.tag.findMany({
      include: {
        _count: { select: { posts: true } },
      },
      orderBy: {
        posts: { _count: 'desc' },
      },
    });
    return tags.map((t) => ({
      id: t.id,
      name: t.name,
      postCount: t._count.posts,
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
    }));
  }

  /**
   * 创建标签
   */
  async create(dto: CreateTagDto): Promise<TagVo> {
    try {
      const tag = await this.prisma.tag.create({ data: { name: dto.name } });
      return this.toVo(tag, 0);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new BusinessException(getTagErrorInfo(TagBizError.NAME_CONFLICT));
      }
      throw e;
    }
  }

  /**
   * 重命名标签（只 UPDATE 一行，PostTag 关联不变）
   */
  async update(id: number, dto: UpdateTagDto): Promise<TagVo> {
    const existing = await this.prisma.tag.findUnique({ where: { id } });
    if (!existing) {
      throw new BusinessException(getTagErrorInfo(TagBizError.NOT_FOUND));
    }

    try {
      const tag = await this.prisma.tag.update({
        where: { id },
        data: { name: dto.name },
        include: { _count: { select: { posts: true } } },
      });
      return this.toVo(tag, tag._count.posts);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new BusinessException(getTagErrorInfo(TagBizError.NAME_CONFLICT));
      }
      throw e;
    }
  }

  /**
   * 删除标签
   * 逻辑外键模式：先删 PostTag，再删 Tag（事务）
   */
  async remove(id: number): Promise<void> {
    const existing = await this.prisma.tag.findUnique({ where: { id } });
    if (!existing) {
      throw new BusinessException(getTagErrorInfo(TagBizError.NOT_FOUND));
    }

    await this.prisma.$transaction([
      // 1. 删除所有 PostTag 关联
      this.prisma.postTag.deleteMany({ where: { tagId: id } }),
      // 2. 删除标签
      this.prisma.tag.delete({ where: { id } }),
    ]);
  }

  /**
   * 合并标签 — 把 source 的所有文章关联转到 target，然后删 source
   *
   * Prisma API 方式（不用 raw SQL，避免 MySQL 同表子查询限制）：
   *   1. 查出 target 的所有 postId → 识别重复（source 和 target 都有同一篇文章）
   *   2. 删除重复 PostTag（保留 target 的）
   *   3. 查出 source 剩余 PostTag → deleteMany + createMany（改联合主键 tagId 列）
   *   4. 删除 source Tag
   *
   * @param sourceId 被合并的标签（删除）
   * @param dto      { targetId } 合并目标标签（保留）
   * @returns 受影响的文章数
   */
  async merge(sourceId: number, dto: MergeTagDto): Promise<number> {
    const targetId = dto.targetId;

    if (sourceId === targetId) {
      throw new BusinessException(getTagErrorInfo(TagBizError.MERGE_SAME));
    }

    const [source, target] = await Promise.all([
      this.prisma.tag.findUnique({ where: { id: sourceId } }),
      this.prisma.tag.findUnique({ where: { id: targetId } }),
    ]);
    if (!source) {
      throw new BusinessException(getTagErrorInfo(TagBizError.NOT_FOUND));
    }
    if (!target) {
      throw new BusinessException(getTagErrorInfo(TagBizError.MERGE_TARGET_NOT_FOUND));
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. 查出 target 的所有 postId
      const targetPosts = await tx.postTag.findMany({
        where: { tagId: targetId },
        select: { postId: true },
      });
      const targetPostIds = targetPosts.map((p) => p.postId);

      // 2. 删除重复的 PostTag（source 和 target 都有同一篇文章 → 保留 target 的）
      if (targetPostIds.length > 0) {
        await tx.postTag.deleteMany({
          where: {
            tagId: sourceId,
            postId: { in: targetPostIds },
          },
        });
      }

      // 3. 查出 source 剩余的 PostTag → deleteMany + createMany（修改联合主键 tagId）
      const remaining = await tx.postTag.findMany({
        where: { tagId: sourceId },
        select: { postId: true },
      });
      await tx.postTag.deleteMany({ where: { tagId: sourceId } });
      if (remaining.length > 0) {
        await tx.postTag.createMany({
          data: remaining.map((p) => ({ postId: p.postId, tagId: targetId })),
        });
      }

      // 4. 删除 source Tag
      await tx.tag.delete({ where: { id: sourceId } });
      return remaining.length;
    });
  }

  /* ---------- VO 转换 ---------- */
  private toVo(
    t: { id: number; name: string; createdAt: Date; updatedAt: Date },
    postCount: number,
  ): TagVo {
    return {
      id: t.id,
      name: t.name,
      postCount,
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
    };
  }
}
