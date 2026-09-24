import { Injectable, Logger } from '@nestjs/common';
import { Prisma, TimelineKind as PrismaTimelineKind } from '@prisma/client';
import { PrismaService } from '@/common/prisma.service';
import { RedisService } from '../redis/redis.service';
import { BusinessException } from '@/common/exception';
import {
  TIMELINE_LIST_KEY,
  REDIS_TTL,
} from '@/common/constants/redis-keys';
import {
  TimelineBizError,
  getTimelineErrorInfo,
} from './enums/timeline-biz-error.enum';
import {
  CreateTimelineNodeDto,
  UpdateTimelineNodeDto,
  TimelineNodeRsp,
  TimelineMetaRsp,
} from './dto/timeline.dto';

/** Prisma TimelineNode 行类型（用于 mapRowToRsp 入参类型收窄） */
type TimelineRow = {
  id: number;
  kind: PrismaTimelineKind;
  title: string;
  subTitle: string;
  startedAt: string;
  endedAt: string;
  ongoing: boolean;
  description: string;
  tags: Prisma.JsonValue;
  visible: boolean;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * Timeline Service — 经历时间线 CRUD
 *
 * 分层架构：Controller → Service → Prisma（不抽 Repository）
 *
 * 缓存策略（同 About / Contact / Portfolio）：
 *   · 公开列表：Redis 60s 缓存，admin 增改删后主动失效
 *   · Redis 读/写失败时降级直连 DB，不影响业务
 *
 * 排序规则：按 startedAt 倒序（时间线天然由近及远），同月按 id 倒序。
 */
@Injectable()
export class TimelineService {
  private readonly logger = new Logger(TimelineService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /* ============================== 公开读 ============================== */

  /**
   * 获取公开经历列表（visible=true，按 startedAt 倒序）
   * 流程：Redis 命中 → 返回；否则查 DB → 写 Redis（60s）→ 返回
   * Redis 任何异常 → 降级直连 DB，不影响业务。
   */
  async getPublicNodes(): Promise<TimelineNodeRsp[]> {
    // 1. 先读 Redis
    try {
      const cached = await this.redis.get(TIMELINE_LIST_KEY);
      if (cached) {
        return JSON.parse(cached) as TimelineNodeRsp[];
      }
    } catch (err) {
      this.logger.warn(
        `Redis 读 Timeline 列表缓存失败，降级查 DB：${(err as Error).message}`,
      );
    }

    // 2. 查 DB
    const rows = await this.prisma.timelineNode.findMany({
      where: { visible: true },
      orderBy: [{ startedAt: 'desc' }, { id: 'desc' }],
    });

    const rsp = rows.map((r) => this.mapRowToRsp(r as TimelineRow));

    // 3. 写 Redis（1 分钟）
    try {
      await this.redis.set(
        TIMELINE_LIST_KEY,
        JSON.stringify(rsp),
        REDIS_TTL.TIMELINE_PUBLIC,
      );
    } catch (err) {
      this.logger.warn(
        `Redis 写 Timeline 列表缓存失败（不影响返回）：${(err as Error).message}`,
      );
    }

    return rsp;
  }

  /* ============================== 管理读 ============================== */

  /**
   * 获取全部经历（含 visible=false），管理员后台用
   * 不加缓存（管理员需要实时数据）
   */
  async getAdminNodes(): Promise<TimelineNodeRsp[]> {
    const rows = await this.prisma.timelineNode.findMany({
      orderBy: [{ startedAt: 'desc' }, { id: 'desc' }],
    });
    return rows.map((r) => this.mapRowToRsp(r as TimelineRow));
  }

  /**
   * 编辑器元数据：候选标签（全表 tags 去重，按出现次数降序，取前 30）
   * 用于「标签不手输，从已有词库选」的交互。
   */
  async getMeta(): Promise<TimelineMetaRsp> {
    const rows = await this.prisma.timelineNode.findMany({
      select: { tags: true },
    });

    const counter = new Map<string, number>();
    for (const row of rows) {
      const tags = Array.isArray(row.tags) ? (row.tags as string[]) : [];
      for (const tag of tags) {
        if (typeof tag !== 'string' || !tag.trim()) continue;
        const key = tag.trim();
        counter.set(key, (counter.get(key) ?? 0) + 1);
      }
    }

    const tags = [...counter.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 30)
      .map(([name]) => name);

    return { tags };
  }

  /* ============================== 写入 ============================== */

  /**
   * 创建经历
   * 1. 校验时间区间
   * 2. Prisma create
   * 3. 删除 Redis 列表缓存
   */
  async createNode(dto: CreateTimelineNodeDto): Promise<TimelineNodeRsp> {
    this.assertDateRange(dto.startedAt, dto.endedAt, dto.ongoing ?? false);

    let node: TimelineRow;
    try {
      node = (await this.prisma.timelineNode.create({
        data: {
          kind: dto.kind,
          title: dto.title,
          subTitle: dto.subTitle ?? '',
          startedAt: dto.startedAt,
          endedAt: dto.ongoing ? '' : (dto.endedAt ?? ''),
          ongoing: dto.ongoing ?? false,
          description: dto.description,
          tags: dto.tags ?? [],
          visible: dto.visible ?? true,
        },
      })) as TimelineRow;
    } catch (err) {
      this.logger.error(`createNode Prisma failed: ${(err as Error).message}`);
      throw new BusinessException(
        getTimelineErrorInfo(TimelineBizError.SAVE_FAILED),
      );
    }

    await this.invalidateListCache();
    return this.mapRowToRsp(node);
  }

  /**
   * 更新经历（PATCH 语义：只更新 dto 中出现的字段）
   * 1. 查旧记录（校验存在）
   * 2. 合并校验时间区间（用「更新后」的终值判断）
   * 3. Prisma update
   * 4. 删 Redis 列表缓存
   */
  async updateNode(
    id: number,
    dto: UpdateTimelineNodeDto,
  ): Promise<TimelineNodeRsp> {
    // ① 查旧记录
    const existing = (await this.prisma.timelineNode.findUnique({
      where: { id },
    })) as TimelineRow | null;
    if (!existing) {
      throw new BusinessException(
        getTimelineErrorInfo(TimelineBizError.DATA_MISSING),
      );
    }

    // ② 用「更新后的终值」校验时间区间
    const nextStartedAt = dto.startedAt ?? existing.startedAt;
    const nextOngoing = dto.ongoing ?? existing.ongoing;
    const nextEndedAt =
      dto.endedAt !== undefined ? dto.endedAt : existing.endedAt;
    this.assertDateRange(nextStartedAt, nextEndedAt, nextOngoing);

    // ③ 构造更新数据
    const data: Prisma.TimelineNodeUpdateInput = {};
    if (dto.kind !== undefined) data.kind = dto.kind;
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.subTitle !== undefined) data.subTitle = dto.subTitle;
    if (dto.startedAt !== undefined) data.startedAt = dto.startedAt;
    if (dto.ongoing !== undefined) data.ongoing = dto.ongoing;
    // ongoing=true 时结束时间强制清空，避免出现「进行中 + 有结束时间」的矛盾态
    if (nextOngoing) {
      data.endedAt = '';
    } else if (dto.endedAt !== undefined) {
      data.endedAt = dto.endedAt;
    }
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.tags !== undefined) data.tags = dto.tags;
    if (dto.visible !== undefined) data.visible = dto.visible;

    let node: TimelineRow;
    try {
      node = (await this.prisma.timelineNode.update({
        where: { id },
        data,
      })) as TimelineRow;
    } catch (err) {
      this.logger.error(`updateNode Prisma failed: ${(err as Error).message}`);
      throw new BusinessException(
        getTimelineErrorInfo(TimelineBizError.SAVE_FAILED),
      );
    }

    await this.invalidateListCache();
    return this.mapRowToRsp(node);
  }

  /**
   * 删除经历（物理删除）
   * 1. 查旧记录（校验存在）
   * 2. Prisma delete
   * 3. 删 Redis 列表缓存
   */
  async deleteNode(id: number): Promise<void> {
    const existing = await this.prisma.timelineNode.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) {
      throw new BusinessException(
        getTimelineErrorInfo(TimelineBizError.DATA_MISSING),
      );
    }

    try {
      await this.prisma.timelineNode.delete({ where: { id } });
    } catch (err) {
      this.logger.error(`deleteNode Prisma failed: ${(err as Error).message}`);
      throw new BusinessException(
        getTimelineErrorInfo(TimelineBizError.DELETE_FAILED),
      );
    }

    await this.invalidateListCache();
  }

  /* ============================== 内部：校验 & 缓存 ============================== */

  /**
   * 时间区间校验
   *   · startedAt / endedAt 均要求 YYYY-MM 格式（前端用 month 输入框，后端兜底）
   *   · ongoing=true 时忽略 endedAt
   *   · endedAt 非空且早于 startedAt → 报错
   */
  private assertDateRange(
    startedAt: string,
    endedAt: string | undefined,
    ongoing: boolean,
  ): void {
    const monthRe = /^\d{4}-(0[1-9]|1[0-2])$/;
    if (!monthRe.test(startedAt)) {
      throw new BusinessException(
        TimelineBizError.DATE_RANGE_INVALID,
        '开始时间格式应为 YYYY-MM',
      );
    }
    if (ongoing || !endedAt) return;

    if (!monthRe.test(endedAt)) {
      throw new BusinessException(
        TimelineBizError.DATE_RANGE_INVALID,
        '结束时间格式应为 YYYY-MM',
      );
    }
    if (endedAt < startedAt) {
      throw new BusinessException(
        getTimelineErrorInfo(TimelineBizError.DATE_RANGE_INVALID),
      );
    }
  }

  /** 删除公开列表缓存（失败忽略，最多 1 分钟自然过期） */
  private async invalidateListCache(): Promise<void> {
    try {
      await this.redis.del(TIMELINE_LIST_KEY);
    } catch (err) {
      this.logger.warn(
        `Redis 删 Timeline 列表缓存失败（1 分钟后自然过期）：${(err as Error).message}`,
      );
    }
  }

  /* ============================== 内部：行 → 响应 ============================== */

  private mapRowToRsp(row: TimelineRow): TimelineNodeRsp {
    return {
      id: row.id,
      kind: row.kind,
      title: row.title,
      subTitle: row.subTitle || '',
      startedAt: row.startedAt,
      endedAt: row.endedAt || '',
      ongoing: row.ongoing,
      description: row.description,
      tags: Array.isArray(row.tags) ? (row.tags as string[]) : [],
      visible: row.visible,
      updatedAt:
        row.updatedAt instanceof Date
          ? row.updatedAt.toISOString()
          : String(row.updatedAt),
    };
  }
}
