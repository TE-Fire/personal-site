/**
 * Contribution 模块返回 DTO
 *
 * 与前端 ContributionHeatmap.vue 的 HeatmapData 接口保持一致（零前端改造）。
 * 三个来源 SITE / GITHUB / MERGED 共用同一份返回结构。
 */

/** 单一日期单元格（与前端 DayCell 1:1） */
export interface DayCellRsp {
  /** 日期，ISO YYYY-MM-DD（东八区当天截断，不包含时分秒，保证前端匹配一致） */
  date: string;
  /** 当日贡献次数（SITE：发布日记/博客/笔记加权求和；GITHUB：GitHub contributionCount 原始） */
  count: number;
  /** 色阶档位：0 空底色 / 1 浅紫 / 2 中紫 / 3 深紫 / 4 最暗紫。阈值由后端统一计算，前端不再重算。 */
  level: 0 | 1 | 2 | 3 | 4;
}

/** 贡献来源标记（前端 Tab 高亮用） */
export type ContributionSource = 'SITE' | 'GITHUB' | 'MERGED';

/**
 * 统一贡献热力图返回体
 *   · cells 长度 = 过去 53 周 × 7 天对齐后，只统计到"今天"（未到的日期不返回）
 *   · 即使没有任何数据，cells 也包含 N 条 count=0 level=0 的 DayCell（保证前端网格有格子，不会白屏）
 */
export interface ContributionRsp {
  cells: DayCellRsp[];
  /** 期间总贡献（sum(count)） */
  total: number;
  /** 单日最佳：日期 + 贡献次数 */
  bestDay: { date: string; count: number };
  /** 当前连续活跃天数（从今天倒推 count>0 的连续天数） */
  currentStreak: number;
  /** 期间最长连续活跃天数 */
  longestStreak: number;
  /** 实际来源：SITE/GITHUB/MERGED */
  source: ContributionSource;
  /** 可选元信息：后端告知前端是否走了 fallback / 是否所有来源表都不存在（用于前端显示空态提示） */
  meta?: {
    /** true = 没有任何真实来源数据（SITE 表都没建 / GitHub 配置没开），cells 全是占位 */
    fallback?: boolean;
    /** 实际被成功聚合的来源表（供调试，Phase1 可能为空数组） */
    tablesFound?: string[];
    /** GitHub 软过期标记（true = 返回了 24h 之前的旧缓存，因为 fetch 失败） */
    githubStale?: boolean;
    /** GitHub 本次抓取失败（true=GITHUB/MERGED 入口里给前端展示「GitHub 暂不可用」） */
    githubFailed?: boolean;
    /** MERGED 视图降级标记：'site'=仅 SITE 可用 / 'github'=仅 GitHub 可用 / 'both'=两源都失败 */
    mergedFallback?: 'site' | 'github' | 'both';
  };
}
