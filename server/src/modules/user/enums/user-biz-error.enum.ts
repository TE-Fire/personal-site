import { IErrorInfo } from '../../../common/interfaces/error.interface';

/**
 * User 用户模块业务错误枚举（个人博客仅管理员，预留给后续博主信息编辑）
 * 码段：4000 ~ 4099
 */
export enum UserBizError {
  /** 用户不存在 */
  NOT_FOUND = 4001,
  /** 头像上传失败 */
  AVATAR_UPLOAD_FAILED = 4002,
  /** 邮箱格式无效 */
  INVALID_EMAIL = 4003,
}

const USER_ERROR_MSG: Record<UserBizError, string> = {
  [UserBizError.NOT_FOUND]: '用户不存在',
  [UserBizError.AVATAR_UPLOAD_FAILED]: '头像上传失败',
  [UserBizError.INVALID_EMAIL]: '邮箱格式无效',
};

export function getUserErrorInfo(err: UserBizError): IErrorInfo {
  return {
    code: Number(err),
    message: USER_ERROR_MSG[err],
  };
}
