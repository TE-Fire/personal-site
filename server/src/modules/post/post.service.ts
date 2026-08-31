import { Injectable } from '@nestjs/common';
import { Prisma, PostStatus as PrismaPostStatus } from '@prisma/client';
import { PrismaService } from '@/common/prisma.service';
import { BusinessException } from '@/common/exception';
import { PostBizError } from './enums/post-biz-error.enum';
import {
  CreatePostDto,
  UpdatePostDto,
  QueryPostDto,
  PostVo,
  PostPageVo,
  calcMetrics,
  toPrismaStatus,
  toDtoStatus,
} from './dto/post.dto';

/**
 * Post 关联查询的 include 常量（详情接口用）
 * 列表接口用 POST_SELECT 排除 content，减少传输体积。
 */
const POST_INCLUDE = {
  category: { select: { id: true, name: true, sort: true } },
  tags: { include: { tag: { select: { id: true, name: true } } } },
  author: { select: { id: true, nickname: true, avatar: true } },
} satisfies Prisma.PostInclude;

/** 列表查询的 select 常量（排除 content，避免 10 篇文章传 640KB 正文） */
const POST_SELECT = {
  id: true,
  slug: true,
  title: true,
  excerpt: true,
  cover: true,
  featured: true,
  status: true,
  wordCount: true,
  readMinutes: true,
  createdAt: true,
  updatedAt: true,
  category: { select: { id: true, name: true, sort: true } },
  tags: { include: { tag: { select: { id: true, name: true } } } },
  author: { select: { id: true, nickname: true, avatar: true } },
} satisfies Prisma.PostSelect;

type PostListPayload = Prisma.PostGetPayload<{ select: typeof POST_SELECT }>;
type PostDetailPayload = Prisma.PostGetPayload<{ include: typeof POST_INCLUDE }>;

/**
 * Post Service — 基于 Prisma 的文章 CRUD
 *
 * 遵循 NestJS-Architecture-Guide.md 分层架构：
 *   Controller → Service → Prisma（不抽 Repository）
 *
 * 业务规则：
 *   · wordCount / readMinutes 由 calcMetrics() 服务端计算，DTO 不暴露
 *   · slug 全局唯一，catch Prisma P2002 → 抛 SLUG_CONFLICT
 *   · tagIds 关联前先校验存在；Update 用 replace 策略（deleteMany + create）
 *   · categoryId 传 null = 清空分类（disconnect）
 *   · DELETE 默认软删除（status → ARCHIVED），保留热力图贡献
 */
@Injectable()
export class PostService {
  constructor(private readonly prisma: PrismaService) {}

  /* ==================== 查询 ==================== */

  /**
   * 分页查询文章列表（不含 content）
   * @param dto 查询条件 + 分页
   * @returns PostPageVo 列表（content 为 undefined）
   */
  async query(dto: QueryPostDto): Promise<PostPageVo> {
    const page = dto.page ?? 1;
    const pageSize = dto.pageSize ?? 10;

    const where: Prisma.PostWhereInput = {};

    // keyword 模糊搜索 title OR excerpt
    if (dto.keyword) {
      where.OR = [
        { title: { contains: dto.keyword } },
        { excerpt: { contains: dto.keyword } },
      ];
    }
    if (dto.categoryId) {
      where.categoryId = dto.categoryId;
    }
    const prismaStatus = toPrismaStatus(dto.status);
    if (prismaStatus) {
      where.status = prismaStatus;
    }
    if (dto.featured !== undefined) {
      where.featured = dto.featured;
    }
    if (dto.tagIds?.length) {
      where.tags = { some: { tagId: { in: dto.tagIds } } };
    }

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.post.findMany({
        where,
        select: POST_SELECT,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.post.count({ where }),
    ]);

    return {
      list: rows.map((r) => this.toVo(r, false)),
      total,
      page,
      pageSize,
    };
  }

  /**
   * 按 id 查文章详情（含 content Markdown 原文）
   * @param publicOnly true = 游客模式，非 published 文章视为不存在
   */
  async findById(id: number, publicOnly = false): Promise<PostVo> {
    const post = await this.prisma.post.findUnique({
      where: { id },
      include: POST_INCLUDE,
    });
    if (!post) {
      throw new BusinessException(PostBizError.NOT_FOUND);
    }
    if (publicOnly && post.status !== PrismaPostStatus.PUBLISHED) {
      throw new BusinessException(PostBizError.NOT_FOUND);
    }
    return this.toVo(post, true);
  }

  /**
   * 按 slug 查文章详情（含 content Markdown 原文）
   * @param publicOnly true = 游客模式，非 published 文章视为不存在
   */
  async findBySlug(slug: string, publicOnly = false): Promise<PostVo> {
    const post = await this.prisma.post.findUnique({
      where: { slug },
      include: POST_INCLUDE,
    });
    if (!post) {
      throw new BusinessException(PostBizError.NOT_FOUND);
    }
    if (publicOnly && post.status !== PrismaPostStatus.PUBLISHED) {
      throw new BusinessException(PostBizError.NOT_FOUND);
    }
    return this.toVo(post, true);
  }

  /* ==================== 写入 ==================== */

  /**
   * 创建文章
   * @param dto    CreatePostDto
   * @param authorId  从 JWT req.user.id 注入
   */
  async create(dto: CreatePostDto, authorId: number): Promise<PostVo> {
    if (dto.categoryId) {
      await this.validateCategory(dto.categoryId);
    }
    if (dto.tagIds?.length) {
      await this.validateTags(dto.tagIds);
    }

    const { wordCount, readMinutes } = calcMetrics(dto.content);

    try {
      const post = await this.prisma.post.create({
        data: {
          slug: dto.slug,
          title: dto.title,
          excerpt: dto.excerpt ?? '',
          content: dto.content,
          cover: dto.cover,
          featured: dto.featured ?? false,
          status: toPrismaStatus(dto.status) ?? PrismaPostStatus.DRAFT,
          wordCount,
          readMinutes,
          author: { connect: { id: authorId } },
          category: dto.categoryId ? { connect: { id: dto.categoryId } } : undefined,
          tags: dto.tagIds?.length
            ? {
                create: dto.tagIds.map((tagId) => ({
                  tag: { connect: { id: tagId } },
                })),
              }
            : undefined,
        },
        include: POST_INCLUDE,
      });
      return this.toVo(post, true);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new BusinessException(PostBizError.SLUG_CONFLICT);
      }
      throw e;
    }
  }

  /**
   * 更新文章
   * - tagIds 为全量 replace（deleteMany 旧关联 + create 新关联）
   * - categoryId = null 表示清空分类（disconnect）
   * - content 变更时重新计算 wordCount / readMinutes
   */
  async update(id: number, dto: UpdatePostDto): Promise<PostVo> {
    const existing = await this.prisma.post.findUnique({ where: { id } });
    if (!existing) {
      throw new BusinessException(PostBizError.NOT_FOUND);
    }

    if (dto.categoryId !== undefined && dto.categoryId !== null) {
      await this.validateCategory(dto.categoryId);
    }
    if (dto.tagIds?.length) {
      await this.validateTags(dto.tagIds);
    }

    const data: Prisma.PostUpdateInput = {};
    if (dto.slug !== undefined) data.slug = dto.slug;
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.excerpt !== undefined) data.excerpt = dto.excerpt;
    if (dto.content !== undefined) {
      data.content = dto.content;
      const { wordCount, readMinutes } = calcMetrics(dto.content);
      data.wordCount = wordCount;
      data.readMinutes = readMinutes;
    }
    if (dto.cover !== undefined) data.cover = dto.cover;
    if (dto.featured !== undefined) data.featured = dto.featured;
    if (dto.status !== undefined) {
      const s = toPrismaStatus(dto.status);
      if (s) data.status = s;
    }
    // categoryId: null = disconnect(清空), number = connect, undefined = 不改
    if (dto.categoryId === null) {
      data.category = { disconnect: true };
    } else if (dto.categoryId !== undefined) {
      data.category = { connect: { id: dto.categoryId } };
    }
    // tagIds: 全量 replace
    if (dto.tagIds !== undefined) {
      data.tags = {
        deleteMany: {},
        create: dto.tagIds.map((tagId) => ({
          tag: { connect: { id: tagId } },
        })),
      };
    }

    try {
      const post = await this.prisma.post.update({
        where: { id },
        data,
        include: POST_INCLUDE,
      });
      return this.toVo(post, true);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError) {
        if (e.code === 'P2002') {
          throw new BusinessException(PostBizError.SLUG_CONFLICT);
        }
        if (e.code === 'P2025') {
          throw new BusinessException(PostBizError.NOT_FOUND);
        }
      }
      throw e;
    }
  }

  /**
   * 删除文章
   * @param hard true = 物理删除；false（默认）= 软删除 status → ARCHIVED
   */
  async remove(id: number, hard = false): Promise<void> {
    const existing = await this.prisma.post.findUnique({ where: { id } });
    if (!existing) {
      throw new BusinessException(PostBizError.NOT_FOUND);
    }

    if (hard) {
      await this.prisma.post.delete({ where: { id } });
    } else {
      await this.prisma.post.update({
        where: { id },
        data: { status: PrismaPostStatus.ARCHIVED },
      });
    }
  }

  /* ==================== 私有校验 ==================== */

  private async validateCategory(categoryId: number): Promise<void> {
    const category = await this.prisma.category.findUnique({
      where: { id: categoryId },
    });
    if (!category) {
      throw new BusinessException(PostBizError.CATEGORY_NOT_FOUND);
    }
  }

  private async validateTags(tagIds: number[]): Promise<void> {
    const tags = await this.prisma.tag.findMany({
      where: { id: { in: tagIds } },
      select: { id: true },
    });
    if (tags.length !== tagIds.length) {
      throw new BusinessException(PostBizError.TAG_NOT_FOUND);
    }
  }

  /* ==================== VO 转换 ==================== */

  /**
   * Prisma 实体 → PostVo
   * @param post       Prisma 查询结果（含 include 关联）
   * @param withContent true = 详情接口，返回 content；false = 列表接口，content = undefined
   */
  private toVo(
    post: PostListPayload | PostDetailPayload,
    withContent: boolean,
  ): PostVo {
    return {
      id: post.id,
      slug: post.slug,
      title: post.title,
      excerpt: post.excerpt,
      content: withContent ? (post as PostDetailPayload).content : undefined,
      cover: post.cover,
      featured: post.featured,
      status: toDtoStatus(post.status),
      wordCount: post.wordCount,
      readMinutes: post.readMinutes,
      category: post.category
        ? {
            id: post.category.id,
            name: post.category.name,
            sort: post.category.sort,
          }
        : null,
      tags: post.tags.map((pt) => ({
        id: pt.tag.id,
        name: pt.tag.name,
      })),
      author: {
        id: post.author.id,
        nickname: post.author.nickname,
        avatar: post.author.avatar,
      },
      createdAt: post.createdAt.toISOString(),
      updatedAt: post.updatedAt.toISOString(),
    };
  }
}
