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
  CACHE: 'cache',
  SESSION: 'session',
  LOCK: 'lock',
} as const;

/* ============================================================
 *  TTL 常量（秒）—— 跟 Key 放在一起维护
 * ============================================================ */
export const REDIS_TTL = {
  /** 滑块验证码：5 分钟 */
  CAPTCHA: 5 * 60,
  /** Refresh Token 黑名单：7 天 */
  AUTH_REFRESH: 7 * 24 * 60 * 60,
  /** 文章列表缓存：10 分钟 */
  CACHE_POST_LIST: 10 * 60,
  /** 单篇文章缓存：1 小时 */
  CACHE_POST_DETAIL: 60 * 60,
  /** 分布式锁：默认 30 秒（业务可覆盖） */
  LOCK_DEFAULT: 30,
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
  cache: [
    { pattern: CACHE_POST_LIST_KEY.name, example: CACHE_POST_LIST_KEY(1, 10), ttl: REDIS_TTL.CACHE_POST_LIST },
    { pattern: CACHE_POST_DETAIL_KEY.name, example: CACHE_POST_DETAIL_KEY('hello'), ttl: REDIS_TTL.CACHE_POST_DETAIL },
  ],
  lock: [
    { pattern: LOCK_KEY.name, example: LOCK_KEY('post_update_1'), ttl: REDIS_TTL.LOCK_DEFAULT },
  ],
} as const;
