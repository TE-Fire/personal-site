import { IErrorInfo } from '../interfaces/error.interface';

/**
 * 通用业务错误枚举 —— 实现 IErrorInfo 契约
 *
 * 覆盖范围：HTTP 通用语义 + 参数/权限类的"无模块归属"错误
 * 模块特有的业务错误（如密码错误、验证码过期）请放在各自模块的 enum 里。
 *
 * 码段规划（全局统一，新增遵守）：
 *   200          成功
 *   400 ~ 499    通用 HTTP 语义错误
 *   500          服务端未知错误
 *   1000 ~ 1099  auth 模块
 *   1100 ~ 1199  captcha 模块
 *   2000 ~ 2099  post / tag / category 模块
 *   3000 ~ 3099  life / media 模块
 *   ... 按需扩展
 */
export enum BizError {
  /* ---- 成功 ---- */
  OK = 200,

  /* ---- 通用 HTTP 语义 ---- */
  /** 参数不合法（校验失败 / 格式错误） */
  BAD_REQUEST = 400,
  /** 未登录或 Token 失效 */
  UNAUTHORIZED = 401,
  /** 登录但无权限操作 */
  FORBIDDEN = 403,
  /** 资源不存在 */
  NOT_FOUND = 404,
  /** 请求方法不允许 */
  METHOD_NOT_ALLOWED = 405,
  /** 请求体过大 / 限流 */
  TOO_MANY_REQUESTS = 429,

  /* ---- 服务端兜底 ---- */
  SERVER_ERROR = 500,
  /** 第三方依赖不可用（数据库、Redis、邮件等） */
  SERVICE_UNAVAILABLE = 503,
}

/**
 * 让 BizError 枚举在类型层面实现 IErrorInfo 契约
 *
 * TS enum 本身没法 `implements`，所以用 Record + 类型守卫双重保障：
 *   1. BIZ_ERROR_MSG 缺失会编译报错（必须给每个枚举值配消息）
 *   2. getErrorInfo 返回类型是 IErrorInfo
 */
const BIZ_ERROR_MSG: Record<BizError, string> = {
  [BizError.OK]: 'success',
  [BizError.BAD_REQUEST]: '请求参数不合法',
  [BizError.UNAUTHORIZED]: '未登录或登录已过期',
  [BizError.FORBIDDEN]: '无权限执行该操作',
  [BizError.NOT_FOUND]: '请求的资源不存在',
  [BizError.METHOD_NOT_ALLOWED]: '请求方法不允许',
  [BizError.TOO_MANY_REQUESTS]: '请求过于频繁，请稍后重试',
  [BizError.SERVER_ERROR]: '服务端异常，请稍后重试',
  [BizError.SERVICE_UNAVAILABLE]: '服务暂不可用，请稍后重试',
};

/** 获取 BizError 对应的 IErrorInfo（code + message） */
export function getBizErrorInfo(err: BizError): IErrorInfo {
  return {
    code: Number(err),
    message: BIZ_ERROR_MSG[err],
  };
}
