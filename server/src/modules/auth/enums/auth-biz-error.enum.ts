import { IErrorInfo } from '../../../common/interfaces/error.interface';

/**
 * Auth 模块业务错误枚举 —— 实现 IErrorInfo 契约
 * 码段：1000 ~ 1099
 */
export enum AuthBizError {
  /** Token 已过期 */
  TOKEN_EXPIRED = 1001,
  /** Token 无效（篡改/伪造/签名错误） */
  TOKEN_INVALID = 1002,
  /** 用户不存在 */
  USER_NOT_FOUND = 1003,
  /** 用户名或密码错误 */
  PASSWORD_INVALID = 1004,
  /** 用户名已存在（预留，个人博客暂不开放注册） */
  USER_EXISTS = 1005,
  /** 用户已被禁用 */
  USER_DISABLED = 1006,
  /** 旧密码不匹配（修改密码） */
  OLD_PASSWORD_INVALID = 1007,
  /** 新旧密码不能相同（修改密码） */
  PASSWORD_NOT_CHANGED = 1008,
}

const AUTH_ERROR_MSG: Record<AuthBizError, string> = {
  [AuthBizError.TOKEN_EXPIRED]: '登录已过期，请重新登录',
  [AuthBizError.TOKEN_INVALID]: '登录凭证无效，请重新登录',
  [AuthBizError.USER_NOT_FOUND]: '用户不存在',
  [AuthBizError.PASSWORD_INVALID]: '用户名或密码错误',
  [AuthBizError.USER_EXISTS]: '用户名已存在',
  [AuthBizError.USER_DISABLED]: '账号已被禁用',
  [AuthBizError.OLD_PASSWORD_INVALID]: '原密码错误',
  [AuthBizError.PASSWORD_NOT_CHANGED]: '新密码不能与旧密码相同',
};

/** AuthBizError → IErrorInfo（类型安全转换） */
export function getAuthErrorInfo(err: AuthBizError): IErrorInfo {
  return {
    code: Number(err),
    message: AUTH_ERROR_MSG[err],
  };
}
