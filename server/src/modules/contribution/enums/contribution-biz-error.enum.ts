/**
 * Contribution 模块业务异常枚举
 *
 * 枚举值命名空间：2xxx（与通用 BizError 0xx / Auth 1xxx / Captcha 10xx 错开）
 *   · 2001 ~ 2099 Contribution 通用 / 本站聚合失败
 *   · 2100 ~ 2199 GitHub 抓取（Phase 2）
 *
 * 所有枚举必须实现 getContributionErrorInfo() → IErrorInfo，
 * 交给 BusinessException 统一处理，最终通过 GlobalExceptionFilter 返回前端。
 */
import type { IErrorInfo } from '@/common/interfaces/error.interface';

export enum ContributionBizError {
  /** 本站贡献聚合失败（DB 异常 / queryRaw 语法错误等） */
  SITE_AGGREGATE_FAIL = 2001,
  /** 热力图聚合 53 周的 since 日期计算异常（极端时区） */
  DATE_RANGE_INVALID = 2002,

  // ---- Phase 2 预留 ----
  /** GitHub 用户名未配置（enableGithub=true 但 githubUsername 空） */
  GITHUB_USERNAME_MISSING = 2101,
  /** GitHub GraphQL 调用失败（网络 5xx / 超时） */
  GITHUB_FETCH_FAIL = 2102,
  /** GitHub PAT rate limit（PAT 5k/h，匿名 60/h） */
  GITHUB_RATE_LIMIT = 2103,
  /** GitHub 返回的 contributionsCalendar 结构不符合预期 */
  GITHUB_PAYLOAD_INVALID = 2104,
}

export function getContributionErrorInfo(err: ContributionBizError): IErrorInfo {
  const MSG: Record<ContributionBizError, string> = {
    [ContributionBizError.SITE_AGGREGATE_FAIL]: '本站贡献聚合失败，请稍后重试',
    [ContributionBizError.DATE_RANGE_INVALID]: '热力图日期范围计算异常',
    [ContributionBizError.GITHUB_USERNAME_MISSING]: '尚未配置 GitHub 用户名',
    [ContributionBizError.GITHUB_FETCH_FAIL]: 'GitHub 贡献数据暂时无法获取',
    [ContributionBizError.GITHUB_RATE_LIMIT]: 'GitHub API 请求过于频繁，请稍后再试',
    [ContributionBizError.GITHUB_PAYLOAD_INVALID]: 'GitHub 返回数据结构异常',
  };
  return {
    code: Number(err),
    message: MSG[err] ?? 'Contribution 模块未知错误',
  };
}
