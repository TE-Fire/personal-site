/**
 * Redis Key 与 TTL 集中管理（全局唯一入口，禁止在各模块手写字符串）
 *
 * 命名约定（对应 Java: private static final String 常量类）：
 *   {项目名}:{模块名}:{具体用途}[:{动态参数}]
 *   - 个人博客统一前缀：personal_site
 *   - 模块名按目录划分：captcha / auth / cache / session 等
 *
 * 实现要点：
 *   1. 所有静态对象用 `as const` —— TS 编译期拒绝修改，等价于 Java final
 *   2. 动态 Key 用函数构造，避免拼接错误（如漏写冒号）
 *   3. TTL 常量跟 Key 构造函数放一起，便于一并维护
 *
 * 后续新增模块 Key，请在本文件按相同模式追加，不要散落在 Service 里。
 */

/* ============================================================
 *  顶层前缀 & 模块前缀
 * ============================================================ */

/** 项目统一前缀（区分多项目共用 Redis 的场景） */
export const REDIS_PREFIX = 'personal_site' as const;

/** 模块名划分（命名空间二级） */
export const REDIS_MODULE = {
  CAPTCHA: 'captcha',
  AUTH: 'auth',
  ABOUT: 'about',
  CACHE: 'cache',
  SESSION: 'session',
  LOCK: 'lock',
  CONTRIBUTION: 'contribution',
} as const;

/* ============================================================
 *  TTL 常量（秒）—— 跟 Key 放在一起维护
 * ============================================================ */
export const REDIS_TTL = {
  /** 滑块验证码：5 分钟 */
  CAPTCHA: 5 * 60,
  /** About 公开展示数据：1 分钟（公开读缓存，admin PUT 后删） */
  ABOUT_PUBLIC: 60,
  /** Refresh Token 黑名单：7 天 */
  AUTH_REFRESH: 7 * 24 * 60 * 60,
  /** 文章列表缓存：10 分钟 */
  CACHE_POST_LIST: 10 * 60,
  /** 单篇文章缓存：1 小时 */
  CACHE_POST_DETAIL: 60 * 60,
  /** 分布式锁：默认 30 秒（业务可覆盖） */
  LOCK_DEFAULT: 30,
  /** 贡献热力图 · 本站聚合：6 小时（发博客时才需要删缓存） */
  CONTRIB_SITE: 6 * 3600,
  /** 贡献热力图 · GitHub 抓取：24 小时（GitHub 以 UTC+0 为日维度，1 天最多变化一次） */
  CONTRIB_GITHUB: 24 * 3600,
  /** 贡献热力图 · 合并视图：6 小时（跟随 SITE/GitHub 更新，失效时双源合并重算） */
  CONTRIB_MERGED: 6 * 3600,
} as const;

/* ============================================================
 *  Key 构造函数（每个函数对应一个具体场景）
 * ============================================================ */

/**
 * 滑块验证码
 *   personal_site:captcha:{uuid}
 * value: targetX 字符串（滑块目标 X 坐标像素）
 * TTL: 5 分钟（REDIS_TTL.CAPTCHA）
 */
export function CAPTCHA_KEY(uuid: string): string {
  return `${REDIS_PREFIX}:${REDIS_MODULE.CAPTCHA}:${uuid}`;
}

/**
 * Refresh Token 黑名单（退出登录 / 登出 / 踢下线用）
 *   personal_site:auth:refresh:{jti}
 * value: 随便写什么都行，存在 = 已吊销
 * TTL: 7 天（REDIS_TTL.AUTH_REFRESH）
 */
export function AUTH_REFRESH_KEY(jti: string): string {
  return `${REDIS_PREFIX}:${REDIS_MODULE.AUTH}:refresh:${jti}`;
}

/**
 * About 公开展示缓存（个人博客只有 1 个博主，无动态参数）
 *   personal_site:about:public
 * value: AboutRsp JSON
 * TTL: 1 分钟（REDIS_TTL.ABOUT_PUBLIC）
 * 失效时机：admin 调 PUT /api/about 成功后主动删除
 * 降级：Redis 读/写失败时直接查 DB，不影响业务
 */
export const ABOUT_PUBLIC_KEY =
  `${REDIS_PREFIX}:${REDIS_MODULE.ABOUT}:public` as const;

/**
 * 文章列表分页缓存
 *   personal_site:cache:post:list:{page}-{size}-{sort}
 * TTL: 10 分钟（REDIS_TTL.CACHE_POST_LIST）
 */
export function CACHE_POST_LIST_KEY(
  page: number,
  size: number,
  sort: 'newest' | 'oldest' | 'hot' = 'newest',
): string {
  return `${REDIS_PREFIX}:${REDIS_MODULE.CACHE}:post:list:${page}-${size}-${sort}`;
}

/**
 * 单篇文章详情缓存
 *   personal_site:cache:post:detail:{slugOrId}
 * TTL: 1 小时（REDIS_TTL.CACHE_POST_DETAIL）
 */
export function CACHE_POST_DETAIL_KEY(slugOrId: string | number): string {
  return `${REDIS_PREFIX}:${REDIS_MODULE.CACHE}:post:detail:${slugOrId}`;
}

/**
 * 分布式锁（通用）
 *   personal_site:lock:{lockKey}
 * TTL: 默认 30 秒（REDIS_TTL.LOCK_DEFAULT）
 */
export function LOCK_KEY(lockKey: string): string {
  return `${REDIS_PREFIX}:${REDIS_MODULE.LOCK}:${lockKey}`;
}

/* ---------- Contribution 贡献热力图缓存 ---------- */

/**
 * 贡献热力图 · 本站聚合结果（SITE）
 *   personal_site:contribution:site:u{userId}
 * value: ContributionRsp JSON（cells + total + bestDay + ... + source='SITE'）
 * TTL: 6 小时（CONTRIB_SITE）
 * 失效：① 发布/删除博客时 ② admin PUT /api/about 改热力图配置时 ③ TTL 自然过期
 */
export function CONTRIB_SITE_KEY(userId: number | string): string {
  return `${REDIS_PREFIX}:${REDIS_MODULE.CONTRIBUTION}:site:u${userId}`;
}

/**
 * 贡献热力图 · GitHub 抓取结果（Phase 2 启用）
 *   personal_site:contribution:github:{username}
 * value: ContributionRsp JSON（source='GITHUB'）
 * TTL: 24 小时（CONTRIB_GITHUB）
 * 限流兜底：key 已过期但 fetch 失败时直接返回旧值（软过期）
 */
export function CONTRIB_GITHUB_KEY(username: string): string {
  return `${REDIS_PREFIX}:${REDIS_MODULE.CONTRIBUTION}:github:${username}`;
}

/**
 * 贡献热力图 · 合并视图（SITE + GitHub）
 *   personal_site:contribution:merged:u{userId}
 * value: ContributionRsp JSON（source='MERGED'，count=summation, level 按合并后阈值重算）
 * TTL: 6 小时（CONTRIB_MERGED）
 */
export function CONTRIB_MERGED_KEY(userId: number | string): string {
  return `${REDIS_PREFIX}:${REDIS_MODULE.CONTRIBUTION}:merged:u${userId}`;
}

/* ============================================================
 *  码段 & 码表一览（防止命名冲突时查阅）
 * ============================================================ */
export const REDIS_KEY_SUMMARY = {
  captcha: [
    { pattern: CAPTCHA_KEY.name, example: CAPTCHA_KEY('a-b-c-d'), ttl: REDIS_TTL.CAPTCHA },
  ],
  auth: [
    { pattern: AUTH_REFRESH_KEY.name, example: AUTH_REFRESH_KEY('jti123'), ttl: REDIS_TTL.AUTH_REFRESH },
  ],
  about: [
    { pattern: 'ABOUT_PUBLIC_KEY', example: ABOUT_PUBLIC_KEY, ttl: REDIS_TTL.ABOUT_PUBLIC },
  ],
  cache: [
    { pattern: CACHE_POST_LIST_KEY.name, example: CACHE_POST_LIST_KEY(1, 10), ttl: REDIS_TTL.CACHE_POST_LIST },
    { pattern: CACHE_POST_DETAIL_KEY.name, example: CACHE_POST_DETAIL_KEY('hello'), ttl: REDIS_TTL.CACHE_POST_DETAIL },
  ],
  lock: [
    { pattern: LOCK_KEY.name, example: LOCK_KEY('post_update_1'), ttl: REDIS_TTL.LOCK_DEFAULT },
  ],
  contribution: [
    { pattern: CONTRIB_SITE_KEY.name,   example: CONTRIB_SITE_KEY(1),   ttl: REDIS_TTL.CONTRIB_SITE },
    { pattern: CONTRIB_GITHUB_KEY.name, example: CONTRIB_GITHUB_KEY('TE-Fire'), ttl: REDIS_TTL.CONTRIB_GITHUB },
    { pattern: CONTRIB_MERGED_KEY.name, example: CONTRIB_MERGED_KEY(1), ttl: REDIS_TTL.CONTRIB_MERGED },
  ],
} as const;
