import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/common/prisma.service';
import { RedisService } from '../redis/redis.service';
import { BusinessException } from '@/common/exception';
import { Result } from '@/common/result';
import {
  ABOUT_PUBLIC_KEY,
  REDIS_TTL,
} from '@/common/constants/redis-keys';
import { ContributionService } from '../contribution/contribution.service';
import { UpdateAboutDto } from './dto/update-about.dto';
import { AboutBizError, getAboutErrorInfo } from './enums/about-biz-error.enum';
import type { AboutRsp, HeatmapSource, HighlightStatRsp, SkillGroupRsp } from './dto/about.dto';

/**
 * About 公开展示字段类型（直接映射 Prisma 返回的行对象结构，用于 TS 类型收窄）
 */
interface AboutUserRow {
  id: number;
  nickname: string | null;
  username: string;
  avatar: string | null;
  aboutShortBio: string;
  aboutLongBio: unknown;
  aboutSkills: unknown;
  aboutHighlightStats: unknown;
  aboutInterests: unknown;
  aboutTags: unknown;
  aboutLocation: string;
  aboutAvailable: boolean;
  aboutNowDoing: unknown;
  aboutHeatmapSource: string;
  aboutHeatmapEnableGithub: boolean;
  aboutGithubUsername: string;
  aboutGithubLink: string;
}

@Injectable()
export class AboutService {
  private readonly logger = new Logger(AboutService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly contributionService: ContributionService,
  ) {}

  /* ============================== 公开读：GET /api/about ============================== */

  /**
   * 获取 About 公开展示数据
   * 流程：Redis 命中 → 返回；否则查 DB → 写 Redis（60s）→ 返回
   * Redis 任何异常（挂/未启动/超时）→ 降级直连 DB，不影响业务。
   */
  async getPublicAbout(): Promise<AboutRsp> {
    // 1. 先读 Redis
    try {
      const cached = await this.redis.get(ABOUT_PUBLIC_KEY);
      if (cached) {
        return JSON.parse(cached) as AboutRsp;
      }
    } catch (err) {
      this.logger.warn(`Redis 读 About 缓存失败，降级查 DB：${(err as Error).message}`);
    }

    // 2. 查 DB：取第一行 user（个人博客只有一个博主）
    const row = (await this.prisma.user.findFirst({
      select: {
        id: true,
        nickname: true,
        username: true,
        avatar: true,
        aboutShortBio: true,
        aboutLongBio: true,
        aboutSkills: true,
        aboutHighlightStats: true,
        aboutInterests: true,
        aboutTags: true,
        aboutLocation: true,
        aboutAvailable: true,
        aboutNowDoing: true,
        aboutHeatmapSource: true,
        aboutHeatmapEnableGithub: true,
        aboutGithubUsername: true,
        aboutGithubLink: true,
      },
    })) as AboutUserRow | null;

    if (!row) {
      throw new BusinessException(
        getAboutErrorInfo(AboutBizError.DATA_MISSING),
      );
    }

    const rsp = this.mapRowToRsp(row);

    // 3. 写 Redis（1 分钟）
    try {
      await this.redis.set(
        ABOUT_PUBLIC_KEY,
        JSON.stringify(rsp),
        REDIS_TTL.ABOUT_PUBLIC,
      );
    } catch (err) {
      this.logger.warn(`Redis 写 About 缓存失败（不影响返回）：${(err as Error).message}`);
    }

    return rsp;
  }

  /* ============================== 管理员改：PUT /api/about ============================== */

  /**
   * 当前登录 admin 保存 About 展示字段
   * 1. Prisma update 当前行 id
   * 2. 删除 Redis 缓存（让下次 GET 重建）
   * 3. 返回完整 AboutRsp（前端立即 setState，不用再 GET）
   */
  async saveAbout(userId: number, dto: UpdateAboutDto): Promise<AboutRsp> {
    // ① 先读旧值 → 用于判断 githubUsername / enableGithub 是否变化，决定要删哪些 GitHub key
    let oldGithubUsername = '';
    try {
      const prev = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { aboutGithubUsername: true, aboutHeatmapEnableGithub: true },
      });
      oldGithubUsername = prev?.aboutGithubUsername?.trim() ?? '';
    } catch (_) { /* ignore，读失败就当旧用户名空 */ }

    // ② 写入 DB
    const nextGithubUsername = typeof dto.githubUsername === 'string' ? dto.githubUsername.trim() : undefined;
    try {
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          aboutShortBio: dto.shortBio,
          aboutLocation: dto.location,
          aboutAvailable: dto.available,
          aboutLongBio: dto.longBio as any,
          aboutTags: dto.tags as any,
          aboutInterests: dto.interests as any,
          aboutNowDoing: dto.nowDoing as any,
          aboutHighlightStats: dto.highlightStats as any,
          aboutSkills: dto.skillGroups as any,
          // ========== 热力图 4 配置字段 ==========
          ...(typeof dto.heatmapSource === 'string'
            ? { aboutHeatmapSource: dto.heatmapSource }
            : {}),
          ...(typeof dto.heatmapEnableGithub === 'boolean'
            ? { aboutHeatmapEnableGithub: dto.heatmapEnableGithub }
            : {}),
          ...(typeof nextGithubUsername === 'string'
            ? { aboutGithubUsername: nextGithubUsername }
            : {}),
          ...(typeof dto.githubLink === 'string'
            ? { aboutGithubLink: dto.githubLink }
            : {}),
        },
      });
    } catch (err) {
      this.logger.error(`saveAbout Prisma failed: ${(err as Error).message}`);
      throw new BusinessException(getAboutErrorInfo(AboutBizError.SAVE_FAILED));
    }

    // ③ 删 About 公开缓存（失败忽略，最多 1 分钟自然过期）
    try {
      await this.redis.del(ABOUT_PUBLIC_KEY);
    } catch (e) {
      this.logger.warn(`Redis 删 About 缓存失败：${(e as Error).message}`);
    }

    // ④ 贡献缓存失效钩子：
    //    · 永远删 SITE + MERGED（按 userId）
    //    · githubUsername 有变化（旧≠新）→ 删旧用户名 + 新用户名两个 GitHub key
    //    · heatmapEnableGithub 从 true→false / false→true → 也刷新 GitHub key （避免遗留空态/真实态脏缓存）
    try {
      const githubKeysToInvalidate: string[] = [];
      if (oldGithubUsername) githubKeysToInvalidate.push(oldGithubUsername);
      if (nextGithubUsername && nextGithubUsername !== oldGithubUsername) {
        githubKeysToInvalidate.push(nextGithubUsername);
      }
      await this.contributionService.invalidateAll(userId, githubKeysToInvalidate);
    } catch (e) {
      this.logger.warn(`贡献缓存失效钩子失败（不影响 About 返回）：${(e as Error).message}`);
    }

    // ⑤ 直接再读一次 DB（重建链路，保证返回最新值）
    return this.getPublicAbout();
  }

  /**
   * [已废弃] 原手动删 SITE key 逻辑已迁移到 ContributionService.invalidateAll，
   * 保留此方法签名是为了避免外部调用方编译挂，实际上已不被内部使用。
   * @deprecated 请使用 ContributionService.invalidateAll(userId)
   */
  async invalidateContributionCache(userId: number): Promise<void> {
    await this.contributionService.invalidateAll(userId);
  }

  /* ============================== 内部：映射 ============================== */

  private mapRowToRsp(row: AboutUserRow): AboutRsp {
    // DB 中 aboutHeatmapSource 可能是脏值（历史遗留/手工改库），做合法枚举兜底
    const VALID_SOURCES: HeatmapSource[] = ['SITE', 'GITHUB', 'MERGED'];
    const heatmapSource: HeatmapSource =
      VALID_SOURCES.includes((row.aboutHeatmapSource || 'SITE') as HeatmapSource)
        ? (row.aboutHeatmapSource as HeatmapSource)
        : 'SITE';

    return {
      name: row.nickname?.trim() || row.username,
      avatar: row.avatar || null,
      shortBio: row.aboutShortBio || '',
      longBio: this.safeStringArray(row.aboutLongBio),
      highlightStats: this.safeHighlightStats(row.aboutHighlightStats),
      location: row.aboutLocation || '',
      available: Boolean(row.aboutAvailable),
      tags: this.safeStringArray(row.aboutTags),
      interests: this.safeStringArray(row.aboutInterests),
      skillGroups: this.safeSkillGroups(row.aboutSkills),
      nowDoing: this.safeStringArray(row.aboutNowDoing),
      heatmapSource,
      heatmapEnableGithub: Boolean(row.aboutHeatmapEnableGithub),
      githubUsername: row.aboutGithubUsername ?? '',
      githubLink: row.aboutGithubLink ?? '',
    };
  }

  /** JSON → string[]，防御：非数组 / null / 类型不一致一律转空数组，避免 500 */
  private safeStringArray(v: unknown): string[] {
    if (!Array.isArray(v)) return [];
    return v.filter((x) => typeof x === 'string') as string[];
  }

  private safeHighlightStats(v: unknown): HighlightStatRsp[] {
    if (!Array.isArray(v)) return [];
    return v
      .filter(
        (x) =>
          x &&
          typeof x === 'object' &&
          typeof (x as any).label === 'string' &&
          typeof (x as any).value === 'string',
      )
      .map((x) => ({
        label: (x as any).label as string,
        value: (x as any).value as string,
      }));
  }

  private safeSkillGroups(v: unknown): SkillGroupRsp[] {
    if (!Array.isArray(v)) return [];
    return v
      .filter(
        (x) =>
          x &&
          typeof x === 'object' &&
          typeof (x as any).id === 'string' &&
          typeof (x as any).title === 'string' &&
          Array.isArray((x as any).items),
      )
      .map((x) => {
        const g = x as any;
        const variant = ['default', 'secondary', 'outline'].includes(g.variant)
          ? g.variant
          : 'default';
        return {
          id: g.id as string,
          title: g.title as string,
          variant,
          items: this.safeStringArray(g.items),
        };
      });
  }
}

/* ============================================================
 *  Export Result.ok 辅助（Controller 直接返回）
 * ============================================================ */
export function aboutResult<T>(data: T, msg?: string) {
  return Result.ok(data, msg);
}
