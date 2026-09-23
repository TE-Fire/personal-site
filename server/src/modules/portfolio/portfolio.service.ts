import { Injectable, Logger } from '@nestjs/common';
import { Prisma, WorkStatus as PrismaWorkStatus } from '@prisma/client';
import { PrismaService } from '@/common/prisma.service';
import { RedisService } from '../redis/redis.service';
import { BusinessException } from '@/common/exception';
import {
  PORTFOLIO_LIST_KEY,
  PORTFOLIO_DETAIL_KEY,
  REDIS_TTL,
} from '@/common/constants/redis-keys';
import {
  PortfolioBizError,
  getPortfolioErrorInfo,
} from './enums/portfolio-biz-error.enum';
import {
  CreateWorkDto,
  UpdateWorkDto,
  WorkRsp,
  WorkLinks,
  WorkMetaRsp,
  VocabKind,
} from './dto/portfolio.dto';

/** Prisma Work 行类型（用于 mapRowToRsp 入参类型收窄） */
type WorkRow = {
  id: number;
  slug: string;
  title: string;
  summary: string;
  description: string;
  cover: string;
  tags: Prisma.JsonValue;
  category: string;
  links: Prisma.JsonValue;
  finishedAt: string;
  highlight: boolean;
  sortOrder: number;
  status: PrismaWorkStatus;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * Portfolio Service — 作品集 CRUD
 *
 * 分层架构：Controller → Service → Prisma（不抽 Repository）
 *
 * 缓存策略（同 About / Contact）：
 *   · 公开列表 / 详情：Redis 60s 缓存，admin 增改删后主动失效
 *   · Redis 读/写失败时降级直连 DB，不影响业务
 */
@Injectable()
export class PortfolioService {
  private readonly logger = new Logger(PortfolioService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /* ============================== 公开读 ============================== */

  /**
   * 获取公开作品列表（status=PUBLISHED，按 sortOrder 升序）
   * 流程：Redis 命中 → 返回；否则查 DB → 写 Redis（60s）→ 返回
   * Redis 任何异常 → 降级直连 DB，不影响业务。
   */
  async getPublicWorks(): Promise<WorkRsp[]> {
    // 1. 先读 Redis
    try {
      const cached = await this.redis.get(PORTFOLIO_LIST_KEY);
      if (cached) {
        return JSON.parse(cached) as WorkRsp[];
      }
    } catch (err) {
      this.logger.warn(
        `Redis 读 Portfolio 列表缓存失败，降级查 DB：${(err as Error).message}`,
      );
    }

    // 2. 查 DB
    const rows = await this.prisma.work.findMany({
      where: { status: PrismaWorkStatus.PUBLISHED },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    });

    const rsp = rows.map((r) => this.mapRowToRsp(r as WorkRow));

    // 3. 写 Redis（1 分钟）
    try {
      await this.redis.set(
        PORTFOLIO_LIST_KEY,
        JSON.stringify(rsp),
        REDIS_TTL.PORTFOLIO_PUBLIC,
      );
    } catch (err) {
      this.logger.warn(
        `Redis 写 Portfolio 列表缓存失败（不影响返回）：${(err as Error).message}`,
      );
    }

    return rsp;
  }

  /**
   * 按 slug 获取单个公开作品（仅 PUBLISHED）
   * 流程：Redis 命中 → 返回；否则查 DB → 写 Redis（60s）→ 返回
   * Redis 任何异常 → 降级直连 DB，不影响业务。
   */
  async getWorkBySlug(slug: string): Promise<WorkRsp> {
    const detailKey = PORTFOLIO_DETAIL_KEY(slug);

    // 1. 先读 Redis
    try {
      const cached = await this.redis.get(detailKey);
      if (cached) {
        return JSON.parse(cached) as WorkRsp;
      }
    } catch (err) {
      this.logger.warn(
        `Redis 读 Portfolio 详情缓存失败，降级查 DB：${(err as Error).message}`,
      );
    }

    // 2. 查 DB
    const row = (await this.prisma.work.findUnique({
      where: { slug },
    })) as WorkRow | null;

    if (!row || row.status !== PrismaWorkStatus.PUBLISHED) {
      throw new BusinessException(
        getPortfolioErrorInfo(PortfolioBizError.DATA_MISSING),
      );
    }

    const rsp = this.mapRowToRsp(row);

    // 3. 写 Redis（1 分钟）
    try {
      await this.redis.set(
        detailKey,
        JSON.stringify(rsp),
        REDIS_TTL.PORTFOLIO_PUBLIC,
      );
    } catch (err) {
      this.logger.warn(
        `Redis 写 Portfolio 详情缓存失败（不影响返回）：${(err as Error).message}`,
      );
    }

    return rsp;
  }

  /* ============================== 管理员读 ============================== */

  /**
   * 获取全部作品（含 DRAFT / ARCHIVED），管理员后台用
   * 不加缓存（管理员需要实时数据）
   */
  async getAdminWorks(): Promise<WorkRsp[]> {
    const rows = await this.prisma.work.findMany({
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    });
    return rows.map((r) => this.mapRowToRsp(r as WorkRow));
  }

  /* ============================== 写入 ============================== */

  /**
   * 创建作品
   * 1. Prisma create
   * 2. 删除 Redis 列表缓存（新作品出现在列表）
   * 3. 返回 WorkRsp
   */
  async createWork(dto: CreateWorkDto): Promise<WorkRsp> {
    let work: WorkRow;
    try {
      work = (await this.prisma.work.create({
        data: {
          slug: dto.slug,
          title: dto.title,
          summary: dto.summary ?? '',
          description: dto.description,
          cover: dto.cover ?? '',
          tags: dto.tags,
          category: dto.category ?? '独立项目',
          links: dto.links ?? {},
          finishedAt: dto.finishedAt ?? '',
          highlight: dto.highlight ?? false,
          sortOrder: dto.sortOrder ?? 0,
          status: (dto.status as PrismaWorkStatus) ?? PrismaWorkStatus.PUBLISHED,
        },
      })) as WorkRow;
    } catch (err) {
      this.logger.error(`createWork Prisma failed: ${(err as Error).message}`);
      throw new BusinessException(
        getPortfolioErrorInfo(PortfolioBizError.SAVE_FAILED),
      );
    }

    // 删列表缓存（失败忽略，最多 1 分钟自然过期）
    await this.invalidateListCache();

    return this.mapRowToRsp(work);
  }

  /**
   * 更新作品
   * 1. 查旧记录（校验存在 + 取旧 slug 用于清缓存）
   * 2. Prisma update（仅更新 dto 中定义的字段）
   * 3. 删 Redis 列表 + 详情缓存（旧 slug + 新 slug）
   * 4. 返回 WorkRsp
   */
  async updateWork(id: number, dto: UpdateWorkDto): Promise<WorkRsp> {
    // ① 查旧记录
    const existing = (await this.prisma.work.findUnique({
      where: { id },
    })) as WorkRow | null;
    if (!existing) {
      throw new BusinessException(
        getPortfolioErrorInfo(PortfolioBizError.DATA_MISSING),
      );
    }
    const oldSlug = existing.slug;

    // ② 构造更新数据（仅更新 dto 中定义的字段）
    const data: Prisma.WorkUpdateInput = {};
    if (dto.slug !== undefined) data.slug = dto.slug;
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.summary !== undefined) data.summary = dto.summary;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.cover !== undefined) data.cover = dto.cover;
    if (dto.tags !== undefined) data.tags = dto.tags;
    if (dto.category !== undefined) data.category = dto.category;
    if (dto.links !== undefined) data.links = dto.links;
    if (dto.finishedAt !== undefined) data.finishedAt = dto.finishedAt;
    if (dto.highlight !== undefined) data.highlight = dto.highlight;
    if (dto.sortOrder !== undefined) data.sortOrder = dto.sortOrder;
    if (dto.status !== undefined) data.status = dto.status as PrismaWorkStatus;

    let work: WorkRow;
    try {
      work = (await this.prisma.work.update({
        where: { id },
        data,
      })) as WorkRow;
    } catch (err) {
      this.logger.error(`updateWork Prisma failed: ${(err as Error).message}`);
      throw new BusinessException(
        getPortfolioErrorInfo(PortfolioBizError.SAVE_FAILED),
      );
    }

    // ③ 删列表 + 详情缓存（旧 slug + 新 slug，slug 未变时只删一次）
    await this.invalidateListCache();
    await this.invalidateDetailCache(oldSlug);
    if (dto.slug && dto.slug !== oldSlug) {
      await this.invalidateDetailCache(dto.slug);
    }

    return this.mapRowToRsp(work);
  }

  /**
   * 删除作品（物理删除）
   * 1. 查旧记录（校验存在 + 取 slug 用于清缓存）
   * 2. Prisma delete
   * 3. 删 Redis 列表 + 详情缓存
   */
  async deleteWork(id: number): Promise<void> {
    // ① 查旧记录
    const existing = (await this.prisma.work.findUnique({
      where: { id },
      select: { slug: true },
    }));
    if (!existing) {
      throw new BusinessException(
        getPortfolioErrorInfo(PortfolioBizError.DATA_MISSING),
      );
    }

    // ② 删除
    try {
      await this.prisma.work.delete({ where: { id } });
    } catch (err) {
      this.logger.error(`deleteWork Prisma failed: ${(err as Error).message}`);
      throw new BusinessException(
        getPortfolioErrorInfo(PortfolioBizError.DELETE_FAILED),
      );
    }

    // ③ 删列表 + 详情缓存
    await this.invalidateListCache();
    await this.invalidateDetailCache(existing.slug);
  }

  /**
   * 批量更新排序
   * @param ids 按新顺序排列的作品 id 数组，sortOrder = 数组索引
   */
  async reorderWorks(ids: number[]): Promise<void> {
    await this.prisma.$transaction(
      ids.map((id, index) =>
        this.prisma.work.update({
          where: { id },
          data: { sortOrder: index },
        }),
      ),
    );

    // 删列表缓存
    await this.invalidateListCache();
  }

  /* ============================== 词库（分类/标签候选值） ============================== */

  /** 校验词库类型参数合法（URL 路径参数不可信） */
  private assertKind(kind: VocabKind): void {
    if (kind !== 'CATEGORY' && kind !== 'TAG') {
      throw new BusinessException(
        getPortfolioErrorInfo(PortfolioBizError.VOCAB_SAVE_FAILED),
      );
    }
  }

  /**
   * 获取词库（管理端编辑器/管理弹窗用）
   * 返回 = 词库表词条 ∪ 作品表实际用到的值（并集去重排序）。
   * 并集的好处：历史作品里手输过的值自动进入候选；词库表则承载「提前新增的空词条」。
   */
  async getAdminMeta(): Promise<WorkMetaRsp> {
    const [vocabRows, works] = await Promise.all([
      this.prisma.workVocab.findMany({ orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] }),
      this.prisma.work.findMany({ select: { category: true, tags: true } }),
    ]);

    const categories = new Set<string>();
    const tags = new Set<string>();
    for (const v of vocabRows) {
      if (v.kind === 'CATEGORY') categories.add(v.name);
      else tags.add(v.name);
    }
    for (const w of works) {
      if (w.category) categories.add(w.category);
      for (const t of this.safeStringArray(w.tags)) tags.add(t);
    }

    const sortCn = (a: string, b: string) => a.localeCompare(b, 'zh-Hans-CN');
    return {
      categories: Array.from(categories).sort(sortCn),
      tags: Array.from(tags).sort(sortCn),
    };
  }

  /** 新增词条（同类型内重名 → 报错） */
  async addVocab(kind: VocabKind, name: string): Promise<void> {
    this.assertKind(kind);
    const trimmed = name.trim();
    if (!trimmed) {
      throw new BusinessException(
        getPortfolioErrorInfo(PortfolioBizError.VOCAB_SAVE_FAILED),
      );
    }
    const dup = await this.prisma.workVocab.findFirst({
      where: { kind, name: trimmed },
    });
    if (dup) {
      throw new BusinessException(
        getPortfolioErrorInfo(PortfolioBizError.VOCAB_DUPLICATE),
      );
    }
    const maxSort = await this.prisma.workVocab.aggregate({
      where: { kind },
      _max: { sortOrder: true },
    });
    try {
      await this.prisma.workVocab.create({
        data: { kind, name: trimmed, sortOrder: (maxSort._max.sortOrder ?? 0) + 1 },
      });
    } catch (err) {
      this.logger.error(`addVocab Prisma failed: ${(err as Error).message}`);
      throw new BusinessException(
        getPortfolioErrorInfo(PortfolioBizError.VOCAB_SAVE_FAILED),
      );
    }
    // 新词条不影响已有作品的展示值，无需清缓存
  }

  /**
   * 重命名/合并词条。
   *   · 分类：批量 update work.category（from → to），词库表同步改名或删除重复项
   *   · 标签：逐条改写 work.tags 数组（移除 from，并入 to，去重），词库表同上
   * 合并语义：to 已存在时，from 词条删除，作品全部归并到 to。
   */
  async renameVocab(kind: VocabKind, from: string, to: string): Promise<void> {
    this.assertKind(kind);
    const fromTrimmed = from.trim();
    const toTrimmed = to.trim();
    if (!fromTrimmed || !toTrimmed) {
      throw new BusinessException(
        getPortfolioErrorInfo(PortfolioBizError.VOCAB_SAVE_FAILED),
      );
    }
    if (fromTrimmed === toTrimmed) return; // 无变化

    // 找到所有受影响的作品（用于逐条改写 tags / 清详情缓存）
    const affected =
      kind === 'CATEGORY'
        ? await this.prisma.work.findMany({
            where: { category: fromTrimmed },
            select: { id: true, slug: true, tags: true },
          })
        : await this.prisma.work.findMany({
            select: { id: true, slug: true, tags: true },
          });

    try {
      await this.prisma.$transaction(async (tx) => {
        if (kind === 'CATEGORY') {
          if (affected.length > 0) {
            await tx.work.updateMany({
              where: { category: fromTrimmed },
              data: { category: toTrimmed },
            });
          }
        } else {
          // 标签：数组里 from → to，去重
          for (const w of affected) {
            const tags = this.safeStringArray(w.tags);
            if (!tags.includes(fromTrimmed)) continue;
            const next = Array.from(
              new Set(tags.map((t) => (t === fromTrimmed ? toTrimmed : t))),
            );
            await tx.work.update({ where: { id: w.id }, data: { tags: next } });
          }
        }

        // 词库表：to 不存在 → 改名；已存在 → 删除 from（合并）
        const target = await tx.workVocab.findFirst({
          where: { kind, name: toTrimmed },
        });
        const source = await tx.workVocab.findFirst({
          where: { kind, name: fromTrimmed },
        });
        if (source) {
          if (target) {
            await tx.workVocab.delete({ where: { id: source.id } });
          } else {
            await tx.workVocab.update({
              where: { id: source.id },
              data: { name: toTrimmed },
            });
          }
        }
      });
    } catch (err) {
      this.logger.error(`renameVocab Prisma failed: ${(err as Error).message}`);
      throw new BusinessException(
        getPortfolioErrorInfo(PortfolioBizError.VOCAB_SAVE_FAILED),
      );
    }

    // 清缓存：列表 + 受影响作品的详情
    await this.invalidateListCache();
    for (const w of affected) {
      await this.invalidateDetailCache(w.slug);
    }
  }

  /**
   * 删除词条。
   *   · 标签：从所有作品的 tags 数组中移除（标签是轻量描述，直接剥离）
   *   · 分类：仍被作品引用时拒绝删除（提示先合并），未引用才允许删
   */
  async deleteVocab(kind: VocabKind, name: string): Promise<void> {
    this.assertKind(kind);
    const trimmed = name.trim();
    if (!trimmed) {
      throw new BusinessException(
        getPortfolioErrorInfo(PortfolioBizError.VOCAB_SAVE_FAILED),
      );
    }

    let affected: Array<{ id: number; slug: string; tags: Prisma.JsonValue }> = [];

    if (kind === 'CATEGORY') {
      const inUse = await this.prisma.work.count({ where: { category: trimmed } });
      if (inUse > 0) {
        throw new BusinessException(
          getPortfolioErrorInfo(PortfolioBizError.VOCAB_CATEGORY_IN_USE),
        );
      }
    } else {
      affected = await this.prisma.work.findMany({
        select: { id: true, slug: true, tags: true },
      });
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        if (kind === 'TAG') {
          for (const w of affected) {
            const tags = this.safeStringArray(w.tags);
            if (!tags.includes(trimmed)) continue;
            await tx.work.update({
              where: { id: w.id },
              data: { tags: tags.filter((t) => t !== trimmed) },
            });
          }
        }
        await tx.workVocab.deleteMany({ where: { kind, name: trimmed } });
      });
    } catch (err) {
      this.logger.error(`deleteVocab Prisma failed: ${(err as Error).message}`);
      throw new BusinessException(
        getPortfolioErrorInfo(PortfolioBizError.VOCAB_SAVE_FAILED),
      );
    }

    if (affected.length > 0) {
      await this.invalidateListCache();
      for (const w of affected) {
        await this.invalidateDetailCache(w.slug);
      }
    }
  }

  /* ============================== 内部：缓存失效 ============================== */

  /** 删除列表缓存（失败忽略，最多 1 分钟自然过期） */
  private async invalidateListCache(): Promise<void> {
    try {
      await this.redis.del(PORTFOLIO_LIST_KEY);
    } catch (err) {
      this.logger.warn(
        `Redis 删 Portfolio 列表缓存失败：${(err as Error).message}`,
      );
    }
  }

  /** 删除单个详情缓存（失败忽略） */
  private async invalidateDetailCache(slug: string): Promise<void> {
    try {
      await this.redis.del(PORTFOLIO_DETAIL_KEY(slug));
    } catch (err) {
      this.logger.warn(
        `Redis 删 Portfolio 详情缓存失败（slug=${slug}）：${(err as Error).message}`,
      );
    }
  }

  /* ============================== 内部：映射 ============================== */

  /** Prisma Work 行 → WorkRsp */
  private mapRowToRsp(row: WorkRow): WorkRsp {
    return {
      id: row.id,
      slug: row.slug,
      title: row.title,
      summary: row.summary || '',
      description: row.description || '',
      cover: row.cover || '',
      tags: this.safeStringArray(row.tags),
      category: row.category || '独立项目',
      links: this.safeLinks(row.links),
      finishedAt: row.finishedAt || '',
      highlight: Boolean(row.highlight),
      sortOrder: row.sortOrder,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  /** JSON → string[]，防御：非数组 / null / 类型不一致一律转空数组 */
  private safeStringArray(v: unknown): string[] {
    if (!Array.isArray(v)) return [];
    return v.filter((x) => typeof x === 'string') as string[];
  }

  /** JSON → WorkLinks，防御：非对象一律返回空对象 */
  private safeLinks(v: unknown): WorkLinks {
    if (!v || typeof v !== 'object' || Array.isArray(v)) return {};
    const obj = v as Record<string, unknown>;
    const links: WorkLinks = {};
    if (typeof obj.homepage === 'string') links.homepage = obj.homepage;
    if (typeof obj.repo === 'string') links.repo = obj.repo;
    if (typeof obj.demo === 'string') links.demo = obj.demo;
    return links;
  }
}
