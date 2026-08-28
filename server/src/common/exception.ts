/**
 * 业务异常类
 *
 * 用枚举（后续加）或直接实例化：
 *   throw new BusinessException('参数校验失败', 400);
 */
export class BusinessException extends Error {
  constructor(
    public message: string,
    public code: number = 500,
  ) {
    super(message);
    this.name = 'BusinessException';
  }
}

/**
 * 通用业务错误码（按需扩展）
 */
export enum BizCode {
  OK = 200,
  BAD_REQUEST = 400,
  UNAUTHORIZED = 401,
  FORBIDDEN = 403,
  NOT_FOUND = 404,
  SERVER_ERROR = 500,

  /** 认证相关 1xxx */
  TOKEN_EXPIRED = 1001,
  TOKEN_INVALID = 1002,
  USER_NOT_FOUND = 1003,
  PASSWORD_INVALID = 1004,
  USER_EXISTS = 1005,
  CAPTCHA_INVALID = 1006,
  CAPTCHA_EXPIRED = 1007,

  /** 文章/分类/标签相关 2xxx */
  POST_NOT_FOUND = 2001,
  CATEGORY_NOT_FOUND = 2002,
  TAG_NOT_FOUND = 2003,
}
