import { Injectable, Logger } from '@nestjs/common';
import { Prisma, PostStatus as PrismaPostStatus } from '@prisma/client';
import { PrismaService } from '@/common/prisma.service';
import { RedisService } from '@/modules/redis/redis.service';
import { BusinessException } from '@/common/exception';
import {
  CACHE_POST_DETAIL_KEY,
  REDIS_TTL,
} from '@/common/constants/redis-keys';
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

/** 空值缓存标记 — 防穿透：查不到的文章也缓存，短 TTL */
const NULL_FLAG = '{"__null__":true}';
/** 空值缓存 TTL（秒）— 比 normal TTL 短，保证新文章发布后能尽快被查到 */
const NULL_TTL = 60;

/**
 * Post Service — 基于 Prisma 的文章 CRUD + Redis 缓存
 *
 * 遵循 NestJS-Architecture-Guide.md 分层架构：
 *   Controller → Service → Prisma（不抽 Repository）
 *
 * 缓存设计（遵循 Development-Spec.md §4.9）：
 *   · 防穿透：查不到的文章缓存 NULL_FLAG（TTL=60s），下次同 key 直接命中不查 DB
 *   · 防击穿：singleflight Map 复用同 key 的并发 Promise，只查一次 DB
 *   · 防雪崩：TTL 随机化（base + 0~10%），错峰过期
 *   · 降级：Redis 读/写全 try/catch，挂了走 DB 不影响业务
 *   · 缓存只对游客（publicOnly=true）生效；博主请求直接走 DB
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
  private readonly logger = new Logger(PostService.name);
  /** singleflight Map：相同 key 的并发请求复用同一 Promise（防击穿） */
  private readonly inflight = new Map<string, Promise<PostVo>>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

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
   * @param publicOnly true = 游客模式（走缓存 + 非 published 视为不存在）
   *                   false = 博主模式（不走缓存，可查草稿/归档）
   */
  async findById(id: number, publicOnly = false): Promise<PostVo> {
    return this.findCached(
      CACHE_POST_DETAIL_KEY(`id:${id}`),
      async () => {
        const post = await this.prisma.post.findUnique({
          where: { id },
          include: POST_INCLUDE,
        });
        if (!post) return null;
        if (publicOnly && post.status !== PrismaPostStatus.PUBLISHED) return null;
        return this.toVo(post, true);
      },
      publicOnly,
    );
  }

  /**
   * 按 slug 查文章详情（含 content Markdown 原文）
   * @param publicOnly true = 游客模式（走缓存 + 非 published 视为不存在）
   *                   false = 博主模式（不走缓存，可查草稿/归档）
   */
  async findBySlug(slug: string, publicOnly = false): Promise<PostVo> {
    return this.findCached(
      CACHE_POST_DETAIL_KEY(`slug:${slug}`),
      async () => {
        const post = await this.prisma.post.findUnique({
          where: { slug },
          include: POST_INCLUDE,
        });
        if (!post) return null;
        if (publicOnly && post.status !== PrismaPostStatus.PUBLISHED) return null;
        return this.toVo(post, true);
      },
      publicOnly,
    );
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
      // 删 slug 空值缓存（之前可能有人查过这个 slug 触发了 NULL_FLAG）
      await this.invalidateDetail(post.id, post.slug);
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
   * - slug 变更时删旧 slug + 新 slug + id 三个缓存 key
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
      // 失效缓存：删 id + 旧 slug
      await this.invalidateDetail(id, existing.slug);
      // slug 变了 → 新 slug 也要删（可能有人查过新 slug 触发了 NULL_FLAG）
      if (dto.slug && dto.slug !== existing.slug) {
        try {
          await this.redis.del(CACHE_POST_DETAIL_KEY(`slug:${post.slug}`));
        } catch (e) {
          this.logger.warn(`Redis 删新 slug 缓存失败：${(e as Error).message}`);
        }
      }
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
    // 失效缓存
    await this.invalidateDetail(id, existing.slug);
  }

  /* ==================== 缓存私有方法 ==================== */

  /**
   * 缓存查询通用包装（只对游客 publicOnly=true 生效）
   *
   * 防穿透：查不到的文章缓存 NULL_FLAG（TTL=60s），下次同 key 直接命中
   * 防击穿：singleflight Map 复用同 key 的并发 Promise，只查一次 DB
   * 防雪崩：TTL 随机化（base + 0~10%），错峰过期
   * 降级  ：Redis 读/写全 try/catch，挂了走 DB 不影响业务
   *
   * @param cacheKey  Redis key（由 redis-keys.ts 构造）
   * @param dbQuery   DB 查询函数（返回 null = 文章不存在/不可见）
   * @param publicOnly true = 游客模式（走缓存）；false = 博主模式（走 DB）
   */
  private async findCached(
    cacheKey: string,
    dbQuery: () => Promise<PostVo | null>,
    publicOnly: boolean,
  ): Promise<PostVo> {
    // 博主模式：不走缓存，直接查 DB
    if (!publicOnly) {
      const post = await dbQuery();
      if (!post) throw new BusinessException(PostBizError.NOT_FOUND);
      return post;
    }

    // 1. 读 Redis 缓存
    try {
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        // 空值缓存命中 → 防穿透
        if (cached === NULL_FLAG) {
          throw new BusinessException(PostBizError.NOT_FOUND);
        }
        // 正常缓存命中
        return JSON.parse(cached) as PostVo;
      }
    } catch (e) {
      // BusinessException 直接 re-throw
      if (e instanceof BusinessException) throw e;
      // Redis 读失败 / JSON.parse 失败 → 降级走 DB
      this.logger.warn(`Redis 缓存读取异常，降级查 DB：${(e as Error).message}`);
    }

    // 2. singleflight：防击穿，同 key 并发请求复用同一 Promise
    const existing = this.inflight.get(cacheKey);
    if (existing) return existing;

    // 3. 查 DB + 写缓存
    const promise = (async () => {
      const post = await dbQuery();
      if (!post) {
        // 防穿透：空值缓存
        try {
          await this.redis.set(cacheKey, NULL_FLAG, this.randomTtl(NULL_TTL));
        } catch (e) {
          this.logger.warn(`Redis 写空值缓存失败：${(e as Error).message}`);
        }
        throw new BusinessException(PostBizError.NOT_FOUND);
      }
      // 写正常缓存（TTL 随机化防雪崩）
      try {
        await this.redis.set(
          cacheKey,
          JSON.stringify(post),
          this.randomTtl(REDIS_TTL.CACHE_POST_DETAIL),
        );
      } catch (e) {
        this.logger.warn(`Redis 写缓存失败：${(e as Error).message}`);
      }
      return post;
    })();

    this.inflight.set(cacheKey, promise);
    try {
      return await promise;
    } finally {
      this.inflight.delete(cacheKey);
    }
  }

  /**
   * TTL 随机化（防雪崩）：base + 0~10% 随机偏移
   * 例如 base=3600 → 实际 3600~3960 秒，错峰过期
   */
  private randomTtl(base: number): number {
    return base + Math.floor(Math.random() * base * 0.1);
  }

  /**
   * 失效文章详情缓存（删 id + slug 两个 key）
   */
  private async invalidateDetail(id: number, slug: string): Promise<void> {
    try {
      await this.redis.delMany(
        CACHE_POST_DETAIL_KEY(`id:${id}`),
        CACHE_POST_DETAIL_KEY(`slug:${slug}`),
      );
    } catch (e) {
      this.logger.warn(`Redis 删缓存失败：${(e as Error).message}`);
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
