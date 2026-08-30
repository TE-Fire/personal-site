import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/common/prisma.service';
import { RedisService } from '../redis/redis.service';
import { BusinessException } from '@/common/exception';
import {
  CONTRIB_SITE_KEY,
  CONTRIB_GITHUB_KEY,
  CONTRIB_MERGED_KEY,
  REDIS_TTL,
} from '@/common/constants/redis-keys';
import {
  ContributionBizError,
  getContributionErrorInfo,
} from './enums/contribution-biz-error.enum';
import type {
  ContributionRsp,
  ContributionSource,
  DayCellRsp,
} from './dto/contribution.dto';

/**
 * Contribution 贡献热力图核心服务
 *
 * 数据源：
 *   · SITE（Phase 1）：MySQL 中 post/life/note 三张业务表的 created_at 按日聚合
 *                    表尚未建立时防御返回空 daysMap，不影响全量 cells 网格生成
 *   · GITHUB（Phase 2）：GitHub GraphQL user.contributionsCollection
 *   · MERGED（Phase 3）：SITE + GITHUB 按 date 合并 count
 */
@Injectable()
export class ContributionService {
  private readonly logger = new Logger(ContributionService.name);

  /** 色阶阈值（由后端统一计算，前端不再重算 level） */
  private static readonly LEVEL_THRESHOLDS: ReadonlyArray<number> = [
    0,    // level 0
    1,    // level 1 阈值下限
    4,    // level 2
    8,    // level 3
    13,   // level 4
  ];

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /* ==========================================================================
   * 公开入口：GET /api/contribution/site
   * ========================================================================== */

  /**
   * 本站贡献（方案 A）—— Redis 命中 → 直接返回；否则重建 → 写 Redis
   * userId 当前阶段固定为 1（个人博客只有一个 admin），设计为动态参数是为了 Phase 2/3 复用
   */
  async getSiteContribution(userId: number): Promise<ContributionRsp> {
    const cacheKey = CONTRIB_SITE_KEY(userId);

    // 1. 读缓存
    try {
      const cached = await this.redis.get(cacheKey);
      if (cached) return JSON.parse(cached) as ContributionRsp;
    } catch (e) {
      this.logger.warn(`Redis 读 SITE 贡献缓存失败，降级直算：${(e as Error).message}`);
    }

    // 2. 聚合本站各来源表
    const { daysMap, tablesFound } = await this.aggregateSiteDays(userId);

    // 3. 生成全量 cells + 统计（即使 daysMap 空，也生成 53 周格子）
    const rsp = this.buildHeatmapData('SITE', daysMap, {
      fallback: tablesFound.length === 0,
      tablesFound,
    });

    // 4. 写缓存（6h），失败不影响返回
    try {
      await this.redis.set(cacheKey, JSON.stringify(rsp), REDIS_TTL.CONTRIB_SITE);
    } catch (e) {
      this.logger.warn(`Redis 写 SITE 贡献缓存失败：${(e as Error).message}`);
    }

    return rsp;
  }

  /* ==========================================================================
   * Phase 2 / 3 入口占位（避免 Controller 报 404，暂时返回空 cells）
   * ========================================================================== */

  /** GitHub 贡献（Phase 2 实现，当前返回空） */
  async getGithubContribution(_username: string): Promise<ContributionRsp> {
    // TODO Phase 2: GraphQL fetch + 软过期缓存兜底
    return this.buildHeatmapData('GITHUB', new Map(), { fallback: true, tablesFound: [] });
  }

  /** 合并视图（Phase 3 实现，当前返回 SITE 原样） */
  async getMergedContribution(userId: number): Promise<ContributionRsp> {
    const cacheKey = CONTRIB_MERGED_KEY(userId);
    try {
      const cached = await this.redis.get(cacheKey);
      if (cached) return JSON.parse(cached) as ContributionRsp;
    } catch (_) { /* ignore */ }
    // Phase 3 TODO: getSiteContribution + getGithubContribution → 合并
    const siteRsp = await this.getSiteContribution(userId);
    const merged: ContributionRsp = { ...siteRsp, source: 'MERGED' };
    try { await this.redis.set(cacheKey, JSON.stringify(merged), REDIS_TTL.CONTRIB_MERGED); } catch (_) { /* ignore */ }
    return merged;
  }

  /* ==========================================================================
   * 核心：本站聚合（Phase 1 只聚合 Post，Life / Note 占位预留）
   * ========================================================================== */

  /**
   * 聚合本站真实业务表的按日贡献次数
   *
   * 防御策略（核心！因为目前 DB 中只有 user 表）：
   *   · 每张来源表先通过 information_schema.TABLES 检查是否存在
   *   · 不存在 → 跳过（不抛错，不影响其他来源）
   *   · 存在 → $queryRaw 按 DATE(created_at) 分组计数
   *   · 任何一张表查询失败 → 只打 warn，不影响整体
   */
  async aggregateSiteDays(userId: number): Promise<{ daysMap: Map<string, number>; tablesFound: string[] }> {
    const daysMap = new Map<string, number>();
    const tablesFound: string[] = [];
    const { sinceISO, todayISO } = this.computeSinceTodayRange();

    // === 1) Post 表（博客文章 status=published 视为 1 次贡献） ===
    try {
      const postExists = await this.tableExists('post');
      if (postExists) {
        // 兼容两种存储：status 是 TINYINT(1)=published 或 VARCHAR='published'
        // 真实字段 status 为 Int 时取值 1（与 User.status 风格一致），为字符串时 'published'
        const rows = await this.prisma.$queryRawUnsafe<Array<{ day: string; cnt: number | bigint }>>(`
          SELECT DATE(CONVERT_TZ(created_at, @@session.time_zone, '+08:00')) AS day,
                 COUNT(*) AS cnt
            FROM post
           WHERE created_at >= ?
             AND created_at <= DATE_ADD(?, INTERVAL 1 DAY)
             AND (status = 1 OR status = 'published')
        GROUP BY day
        `, sinceISO, todayISO) as Array<{ day: string; cnt: number | bigint }>;
        for (const r of rows) {
          const d = typeof r.day === 'string' ? r.day.slice(0, 10) : '';
          if (!d) continue;
          const cnt = typeof r.cnt === 'bigint' ? Number(r.cnt) : r.cnt;
          const prev = daysMap.get(d) ?? 0;
          daysMap.set(d, prev + cnt);
        }
        tablesFound.push('post');
      }
    } catch (e) {
      this.logger.warn(`Post 贡献聚合跳过（非致命，继续后续来源）：${(e as Error).message}`);
    }

    // === 2) Life 表（Phase 1 占位，上线时解除注释 + 调整 WHERE published=1 === 真） ===
    // try {
    //   if (await this.tableExists('life')) {
    //     const rows = await this.prisma.$queryRawUnsafe<...>(
    //       "SELECT DATE(created_at) AS day, COUNT(*) AS cnt FROM life WHERE created_at>=? AND created_at<=? AND published=1 GROUP BY day",
    //       sinceISO, todayISO
    //     );
    //     for (const r of rows) addDay(daysMap, r.day, Number(r.cnt));
    //     tablesFound.push('life');
    //   }
    // } catch (e) { this.logger.warn(`Life 聚合跳过：${e.message}`); }

    // === 3) Note 表（Phase 1 占位，后续笔记模块上线时解除注释） ===
    // try {
    //   if (await this.tableExists('note')) {
    //     const rows = await this.prisma.$queryRawUnsafe<...>(
    //       "SELECT DATE(created_at) AS day, COUNT(*) AS cnt FROM note WHERE created_at>=? AND created_at<=? AND is_draft=0 GROUP BY day",
    //       sinceISO, todayISO
    //     );
    //     for (const r of rows) addDay(daysMap, r.day, Number(r.cnt));
    //     tablesFound.push('note');
    //   }
    // } catch (e) { this.logger.warn(`Note 聚合跳过：${e.message}`); }

    // 避免未使用警告
    void userId;

    return { daysMap, tablesFound };
  }

  /* ==========================================================================
   * 生成 HeatmapData（cells / total / bestDay / currentStreak / longestStreak）
   * ========================================================================== */

  buildHeatmapData(
    source: ContributionSource,
    daysMap: Map<string, number>,
    meta: NonNullable<ContributionRsp['meta']>,
  ): ContributionRsp {
    const { today, start } = this.computeGridStartEnd();

    const cells: DayCellRsp[] = [];
    let total = 0;
    let bestDay: { date: string; count: number } = { date: '', count: 0 };

    // 按天生成网格：start 是 53 周前的周一，一直走到 today
    const DAY_MS = 24 * 3600 * 1000;
    const cursor = new Date(start);
    while (cursor.getTime() <= today.getTime()) {
      const y = cursor.getFullYear();
      const m = String(cursor.getMonth() + 1).padStart(2, '0');
      const d = String(cursor.getDate()).padStart(2, '0');
      const dateStr = `${y}-${m}-${d}`;
      const count = daysMap.get(dateStr) ?? 0;
      const level = ContributionService.countToLevel(count);
      cells.push({ date: dateStr, count, level });
      total += count;
      if (count > bestDay.count) bestDay = { date: dateStr, count };
      cursor.setTime(cursor.getTime() + DAY_MS);
    }

    // 连续活跃天数计算：cells 按日期升序（上面 while 生成即为升序，今天在末尾）
    let currentStreak = 0;
    for (let i = cells.length - 1; i >= 0; i--) {
      if (cells[i].count > 0) currentStreak++;
      else break;
    }
    let longestStreak = 0;
    let tmp = 0;
    for (const c of cells) {
      if (c.count > 0) {
        tmp++;
        if (tmp > longestStreak) longestStreak = tmp;
      } else {
        tmp = 0;
      }
    }

    return {
      cells,
      total,
      bestDay,
      currentStreak,
      longestStreak,
      source,
      meta,
    };
  }

  /* ==========================================================================
   * 内部辅助
   * ========================================================================== */

  /** count → level：0 / 1-3 / 4-7 / 8-12 / ≥13 */
  private static countToLevel(count: number): 0 | 1 | 2 | 3 | 4 {
    const c = Math.max(0, Math.floor(count));
    const T = ContributionService.LEVEL_THRESHOLDS;
    if (c < T[1]) return 0;
    if (c < T[2]) return 1;
    if (c < T[3]) return 2;
    if (c < T[4]) return 3;
    return 4;
  }

  /**
   * 计算 since / today ISO 字符串（给 $queryRaw BETWEEN 用）
   * since = 53 周 - 1 天前；today = 今天（UTC+8 当日结束）
   */
  private computeSinceTodayRange(): { sinceISO: string; todayISO: string } {
    const { today, start } = this.computeGridStartEnd();
    const toISO = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} 00:00:00`;
    return { sinceISO: toISO(start), todayISO: toISO(today) };
  }

  /**
   * 计算热力图起止日期：
   *   start：最近 53 周前，对齐到周一（和前端 generateMockData 一致 → GitHub 风格周视图：周一为一周起点）
   *   today：今天（只保留日期部分，0 时 0 分）
   */
  private computeGridStartEnd(): { start: Date; today: Date } {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const start = new Date(today);
    // 53 周 × 7 天 - 1 = 370 天前
    start.setDate(start.getDate() - (53 * 7 - 1));
    // 对齐到周一（getDay: 0=Sun，周一到周日偏移 0-6）
    const dow = start.getDay();
    const offsetToMon = dow === 0 ? 6 : dow - 1;
    start.setDate(start.getDate() - offsetToMon);
    try {
      // 基本合理性校验
      if (isNaN(start.getTime()) || isNaN(today.getTime()) || start.getTime() > today.getTime()) {
        throw new BusinessException(getContributionErrorInfo(ContributionBizError.DATE_RANGE_INVALID));
      }
    } catch (e) {
      if (e instanceof BusinessException) throw e;
      throw new BusinessException(getContributionErrorInfo(ContributionBizError.DATE_RANGE_INVALID));
    }
    return { start, today };
  }

  /** 通过 information_schema 检查某表是否存在（防御：Post/Life/Note 模块还没建表） */
  private async tableExists(tableName: string): Promise<boolean> {
    try {
      const rows = await this.prisma.$queryRawUnsafe<Array<{ cnt: number | bigint }>>(`
        SELECT COUNT(*) AS cnt
          FROM information_schema.TABLES
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = ?
         LIMIT 1
      `, tableName) as Array<{ cnt: number | bigint }>;
      const cnt = rows[0]?.cnt;
      return (typeof cnt === 'bigint' ? Number(cnt) : cnt ?? 0) > 0;
    } catch (e) {
      this.logger.warn(`检查 ${tableName} 是否存在失败（按不存在处理）：${(e as Error).message}`);
      return false;
    }
  }

  /* ==========================================================================
   * 对外：失效所有贡献缓存（Phase 2/3 追加 GitHub/Merged key 时这里也要加）
   * ========================================================================== */
  async invalidateAll(userId: number, githubUsername?: string): Promise<void> {
    const keys: string[] = [
      CONTRIB_SITE_KEY(userId),
      CONTRIB_MERGED_KEY(userId),
    ];
    if (githubUsername) keys.push(CONTRIB_GITHUB_KEY(githubUsername));
    if (keys.length === 0) return;
    try { await this.redis.delMany(...keys); } catch (_) { /* ignore */ }
  }
}
