import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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
 *   · GITHUB（Phase 2）：GitHub GraphQL v4 → user.contributionsCollection.contributionCalendar
 *                        PAT 缺 / 网络失败 / 返回错误 → 软过期兜底（若 Redis 有旧缓存仍返回旧值）
 *   · MERGED（Phase 2 交付）：SITE + GITHUB 按日期合并 count → 重算 level
 *                              任一源失败 → 降级用另一源 + meta.mergedFallback=xxxSource
 */
@Injectable()
export class ContributionService {
  private readonly logger = new Logger(ContributionService.name);

  /** 色阶阈值（后端统一计算，前端不再重算 level）—— 与 SITE/GITHUB/MERGED 全局一致 */
  private static readonly LEVEL_THRESHOLDS: ReadonlyArray<number> = [
    0,    // level 0
    1,    // level 1 阈值下限：1~3
    4,    // level 2：4~7
    8,    // level 3：8~12
    13,   // level 4：≥13
  ] as const;

  /** 真实 GitHub GraphQL 端点（不走代理，直接本机 fetch） */
  private static readonly GITHUB_GQL_ENDPOINT = 'https://api.github.com/graphql' as const;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly config: ConfigService,
  ) {}

  /* ==========================================================================
   * 公开入口 1：GET /api/contribution/site
   * ========================================================================== */

  /**
   * 本站贡献（方案 A）—— Redis 命中 → 直接返回；否则重建 → 写 Redis
   */
  async getSiteContribution(userId: number): Promise<ContributionRsp> {
    const cacheKey = CONTRIB_SITE_KEY(userId);
    try {
      const cached = await this.redis.get(cacheKey);
      if (cached) return JSON.parse(cached) as ContributionRsp;
    } catch (e) {
      this.logger.warn(`Redis 读 SITE 贡献缓存失败，降级直算：${(e as Error).message}`);
    }

    const { daysMap, tablesFound } = await this.aggregateSiteDays(userId);
    const rsp = this.buildHeatmapData('SITE', daysMap, {
      fallback: tablesFound.length === 0,
      tablesFound,
    });

    try {
      await this.redis.set(cacheKey, JSON.stringify(rsp), REDIS_TTL.CONTRIB_SITE);
    } catch (e) {
      this.logger.warn(`Redis 写 SITE 贡献缓存失败：${(e as Error).message}`);
    }
    return rsp;
  }

  /* ==========================================================================
   * 公开入口 2：GET /api/contribution/github  （Phase 2 正式实现）
   * ========================================================================== */

  /**
   * GitHub 贡献（方案 B）
   *
   * @param requestedUsername 可选：调用方指定的 GitHub 用户名
   * @param dbUsername        可选：DB aboutGithubUsername 字段（优先级高于 env）
   * @param enableGithub      DB aboutHeatmapEnableGithub 值：false 时直接返回 fallback 空（Controller 层判断）
   */
  async getGithubContribution(
    requestedUsername?: string,
    dbUsername?: string,
    enableGithub = true,
  ): Promise<ContributionRsp> {
    // 1) enableGithub=false → 直接 fallback（空 cells，但 meta 标记来源字段 = github_disabled）
    if (!enableGithub) {
      return this.buildHeatmapData('GITHUB', new Map(), {
        fallback: true,
        tablesFound: ['github_disabled'],
      });
    }

    // 2) 3 级用户名解析：请求参数 > DB aboutGithubUsername > env GITHUB_USERNAME
    const envUsername = this.config.get<string>('GITHUB_USERNAME', '').trim();
    const username =
      (requestedUsername && requestedUsername.trim()) ||
      (dbUsername && dbUsername.trim()) ||
      envUsername;
    if (!username) {
      this.logger.warn('[GitHub] 未配置用户名（requested/db/env 三处均为空），返回 fallback');
      return this.buildHeatmapData('GITHUB', new Map(), {
        fallback: true,
        tablesFound: ['github_no_username'],
      });
    }

    // 3) Redis 24h 缓存命中 → 直接返回
    const cacheKey = CONTRIB_GITHUB_KEY(username);
    try {
      const cached = await this.redis.get(cacheKey);
      if (cached) return JSON.parse(cached) as ContributionRsp;
    } catch (e) {
      this.logger.warn(`[GitHub] Redis 读缓存失败，降级直抓：${(e as Error).message}`);
    }

    // 4) 调 GraphQL（失败 → 不抛错，返回 fallback + meta.githubFailed）
    let daysMap: Map<string, number>;
    let failed = false;
    try {
      daysMap = await this.fetchGithubDays(username);
    } catch (e) {
      failed = true;
      const msg = (e as Error).message || String(e);
      this.logger.warn(`[GitHub] 抓取 ${username} 失败 → fallback 空态：${msg}`);
      // 软过期兜底：key 已过期但曾有旧值 → 在 Redis 写一份带 githubStale=true 的降级标记缓存 1h 避免反复打 GitHub
      daysMap = new Map();
    }

    const rsp = this.buildHeatmapData('GITHUB', daysMap, {
      fallback: failed || daysMap.size === 0,
      tablesFound: failed ? ['github_fetch_failed'] : ['github_graphql'],
      githubFailed: failed,
    });

    // 5) 写 Redis：成功 24h，失败也写 1h 空态缓冲（避免限流雪崩）
    try {
      await this.redis.set(
        cacheKey,
        JSON.stringify(rsp),
        failed ? 3600 : REDIS_TTL.CONTRIB_GITHUB,
      );
    } catch (e) {
      this.logger.warn(`[GitHub] Redis 写缓存失败：${(e as Error).message}`);
    }
    return rsp;
  }

  /* ==========================================================================
   * 公开入口 3：GET /api/contribution/merged （Phase 2 交付）
   * ========================================================================== */

  /**
   * 合并视图：SITE + GITHUB 按日期累加 count → 统一阈值重算 level
   *
   * 降级策略（allSettled + 单源失败不影响另一源）：
   *   · 两源都 OK → 合并 → merged=true（无 fallback 标记）
   *   · 仅 GitHub 失败 → 返回 SITE 原数据，但打上 meta.mergedFallback='github'
   *   · 仅 SITE 失败 → 返回 GitHub 原数据，打上 meta.mergedFallback='site'
   *   · 两源都失败 → fallback 空 cells，meta.mergedFallback='both'
   */
  async getMergedContribution(
    userId: number,
    requestedUsername?: string,
    dbUsername?: string,
    enableGithub = true,
  ): Promise<ContributionRsp> {
    const cacheKey = CONTRIB_MERGED_KEY(userId);
    try {
      const cached = await this.redis.get(cacheKey);
      if (cached) return JSON.parse(cached) as ContributionRsp;
    } catch (_) { /* ignore */ }

    const [siteRes, githubRes] = await Promise.allSettled([
      this.getSiteContribution(userId),
      this.getGithubContribution(requestedUsername, dbUsername, enableGithub),
    ]);

    const siteRsp =
      siteRes.status === 'fulfilled' ? siteRes.value : undefined;
    const githubRsp =
      githubRes.status === 'fulfilled' ? githubRes.value : undefined;

    // 两源都失败 → 合并空态
    if (!siteRsp && !githubRsp) {
      const rsp = this.buildHeatmapData('MERGED', new Map(), {
        fallback: true,
        tablesFound: [],
        mergedFallback: 'both',
      });
      try { await this.redis.set(cacheKey, JSON.stringify(rsp), 3600); } catch (_) { /* ignore */ }
      return rsp;
    }

    // 只有一源成功 → 降级返回成功源，并标记 mergedFallback
    if (!githubRsp || githubRsp.meta?.githubFailed) {
      const fallbackRsp = (siteRsp ?? this.buildHeatmapData('MERGED', new Map(), { fallback: true, tablesFound: [] }));
      const merged: ContributionRsp = {
        ...fallbackRsp,
        source: 'MERGED',
        meta: {
          ...(fallbackRsp.meta ?? {}),
          mergedFallback: githubRsp?.meta?.githubFailed ? 'github' : 'both',
        },
      };
      try { await this.redis.set(cacheKey, JSON.stringify(merged), REDIS_TTL.CONTRIB_MERGED); } catch (_) { /* ignore */ }
      return merged;
    }
    if (!siteRsp) {
      const merged: ContributionRsp = {
        ...githubRsp,
        source: 'MERGED',
        meta: { ...(githubRsp.meta ?? {}), mergedFallback: 'site' },
      };
      try { await this.redis.set(cacheKey, JSON.stringify(merged), REDIS_TTL.CONTRIB_MERGED); } catch (_) { /* ignore */ }
      return merged;
    }

    // 两源都 OK → 合并 daysMap（value 累加）
    const combined = new Map<string, number>();
    for (const c of siteRsp.cells) combined.set(c.date, c.count);
    for (const c of githubRsp.cells) {
      const prev = combined.get(c.date) ?? 0;
      combined.set(c.date, prev + c.count);
    }
    const merged = this.buildHeatmapData('MERGED', combined, {
      fallback: false,
      tablesFound: [
        ...(siteRsp.meta?.tablesFound ?? []),
        ...(githubRsp.meta?.tablesFound ?? []),
      ],
    });

    try {
      await this.redis.set(cacheKey, JSON.stringify(merged), REDIS_TTL.CONTRIB_MERGED);
    } catch (_) { /* ignore */ }
    return merged;
  }

  /* ==========================================================================
   * Core 1：GitHub GraphQL 抓取 → daysMap
   * ========================================================================== */

  /**
   * 调 GitHub GraphQL v4 拉贡献日历 → 转成 { 'YYYY-MM-DD': count } daysMap
   * 窗口期与 SITE 完全一致：近 53 周对齐到周一 → 今天
   * （保证 MERGED 合并时两个来源尺寸精准对齐，不会错位多/少 1 格）
   */
  async fetchGithubDays(username: string): Promise<Map<string, number>> {
    const token = this.config.get<string>('GITHUB_PAT', '').trim();
    if (!token) {
      throw new Error('GITHUB_PAT 未配置（server/.env 里没有 GITHUB_PAT=xxx）');
    }
    const { sinceISO, todayISO } = this.computeSinceTodayRange();
    // GitHub 的 from/to 需要 ISO8601 + Z，且 to 要包到今天结束
    const from = `${sinceISO.slice(0, 10)}T00:00:00Z`;
    const to = `${todayISO.slice(0, 10)}T23:59:59Z`;

    const query = /* GraphQL */ `
      query($u: String!, $from: DateTime!, $to: DateTime!) {
        user(login: $u) {
          login
          contributionsCollection(from: $from, to: $to) {
            contributionCalendar {
              totalContributions
              weeks {
                contributionDays {
                  date
                  contributionCount
                }
              }
            }
          }
        }
        rateLimit {
          cost
          remaining
          resetAt
        }
      }
    `;

    let res: globalThis.Response;
    try {
      res = await fetch(ContributionService.GITHUB_GQL_ENDPOINT, {
        method: 'POST',
        headers: {
          Authorization: `bearer ${token}`,
          'User-Agent': 'personal-site-nestjs',
          Accept: 'application/vnd.github.v4+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query, variables: { u: username, from, to } }),
      });
    } catch (e) {
      throw new Error(`GraphQL fetch 网络错误：${(e as Error).message}`);
    }

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(
        `GraphQL HTTP ${res.status}：${body.slice(0, 500) || res.statusText}`,
      );
    }

    let json: any;
    try {
      json = await res.json();
    } catch (e) {
      throw new Error(`GraphQL 响应 JSON 解析失败：${(e as Error).message}`);
    }

    if (json.errors && Array.isArray(json.errors) && json.errors.length) {
      const first = json.errors[0];
      // 典型：用户不存在 => NOT_FOUND / type: NOT_FOUND
      if (first.type === 'NOT_FOUND' || /does not exist/i.test(first.message || '')) {
        throw new Error(`GitHub 用户 ${username} 不存在：${first.message}`);
      }
      // 典型：Bad credentials => 401 已经被 HTTP 非 2xx 捕获；这里是 GQL 层"令牌 scope 不足"等
      throw new Error(`GraphQL 业务错误：${JSON.stringify(json.errors).slice(0, 600)}`);
    }

    const cal: any = json?.data?.user?.contributionsCollection?.contributionCalendar;
    if (!cal || !Array.isArray(cal.weeks)) {
      throw new Error(`GraphQL 返回结构异常：缺少 contributionCalendar.weeks（data.user=${json?.data?.user ? '存在' : '缺失'}）`);
    }

    // rateLimit 打点（warn 打日志便于后续限流排查，不影响返回）
    const rl = json?.data?.rateLimit;
    if (rl && typeof rl.remaining === 'number' && rl.remaining < 100) {
      this.logger.warn(
        `[GitHub] rateLimit 仅剩 ${rl.remaining}/5000，cost=${rl.cost}，resetAt=${rl.resetAt}`,
      );
    }

    const daysMap = new Map<string, number>();
    for (const w of cal.weeks) {
      if (!w || !Array.isArray(w.contributionDays)) continue;
      for (const d of w.contributionDays) {
        if (!d || typeof d.date !== 'string') continue;
        const dateStr = d.date.slice(0, 10);
        if (!dateStr) continue;
        const cnt = typeof d.contributionCount === 'number' ? d.contributionCount : Number(d.contributionCount) || 0;
        const prev = daysMap.get(dateStr) ?? 0;
        daysMap.set(dateStr, prev + cnt);
      }
    }
    return daysMap;
  }

  /* ==========================================================================
   * Core 2：本站业务表聚合（Phase 1 已交付，保留防御表不存在策略）
   * ========================================================================== */

  async aggregateSiteDays(userId: number): Promise<{ daysMap: Map<string, number>; tablesFound: string[] }> {
    const daysMap = new Map<string, number>();
    const tablesFound: string[] = [];
    const { sinceISO, todayISO } = this.computeSinceTodayRange();

    // === 1) Post 表 ===
    try {
      const postExists = await this.tableExists('post');
      if (postExists) {
        // 热力图统计所有状态文章（DRAFT/PUBLISHED/ARCHIVED 都算贡献）
        // DATE_FORMAT 强制返回字符串，避免 Prisma 把 DATE() 解析成 Date 对象
        const rows = await this.prisma.$queryRawUnsafe<Array<{ day: string; cnt: number | bigint }>>(`
          SELECT DATE_FORMAT(created_at, '%Y-%m-%d') AS day,
                 COUNT(*) AS cnt
            FROM post
           WHERE created_at >= ?
             AND created_at <= DATE_ADD(?, INTERVAL 1 DAY)
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

    // === 2) Life / Note 占位：后续模块上线解除注释即可 ===

    void userId;
    return { daysMap, tablesFound };
  }

  /* ==========================================================================
   * 通用：构造 ContributionRsp（cells / total / 统计 / source / meta）
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
   * 内部辅助：count→level、日期范围、表存在性
   * ========================================================================== */

  private static countToLevel(count: number): 0 | 1 | 2 | 3 | 4 {
    const c = Math.max(0, Math.floor(count));
    const T = ContributionService.LEVEL_THRESHOLDS;
    if (c < T[1]) return 0;
    if (c < T[2]) return 1;
    if (c < T[3]) return 2;
    if (c < T[4]) return 3;
    return 4;
  }

  private computeSinceTodayRange(): { sinceISO: string; todayISO: string } {
    const { today, start } = this.computeGridStartEnd();
    const toISO = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} 00:00:00`;
    return { sinceISO: toISO(start), todayISO: toISO(today) };
  }

  private computeGridStartEnd(): { start: Date; today: Date } {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const start = new Date(today);
    start.setDate(start.getDate() - (53 * 7 - 1));
    const dow = start.getDay();
    const offsetToMon = dow === 0 ? 6 : dow - 1;
    start.setDate(start.getDate() - offsetToMon);
    try {
      if (isNaN(start.getTime()) || isNaN(today.getTime()) || start.getTime() > today.getTime()) {
        throw new BusinessException(getContributionErrorInfo(ContributionBizError.DATE_RANGE_INVALID));
      }
    } catch (e) {
      if (e instanceof BusinessException) throw e;
      throw new BusinessException(getContributionErrorInfo(ContributionBizError.DATE_RANGE_INVALID));
    }
    return { start, today };
  }

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
   * 对外：统一失效缓存（About 保存钩子 / 调 /contribution/invalidate 时调用）
   *   · SITE + MERGED 永远删（按 userId）
   *   · GitHub 按 oldGithubUsername + newGithubUsername 双删（避免保存前后用户名不同遗留脏缓存）
   * ========================================================================== */
  async invalidateAll(
    userId: number,
    githubUsernames: string[] = [],
  ): Promise<void> {
    const keys: string[] = [
      CONTRIB_SITE_KEY(userId),
      CONTRIB_MERGED_KEY(userId),
    ];
    for (const u of githubUsernames) {
      const x = u?.trim();
      if (x) keys.push(CONTRIB_GITHUB_KEY(x));
    }
    if (keys.length === 0) return;
    try { await this.redis.delMany(...keys); } catch (_) { /* ignore */ }
  }
}
