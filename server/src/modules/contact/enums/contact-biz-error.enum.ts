import { IErrorInfo } from '../../../common/interfaces/error.interface';

/**
 * Contact 模块业务错误枚举（联系方式公开展示 + admin 保存）
 * 码段：6000 ~ 6099
 *
 * 字段级校验（class-validator 的 DTO 校验失败）走全局 BizError.VALIDATION_FAILED，
 * 不在本模块枚举里重复定义。
 */
export enum ContactBizError {
  /** DB 里未找到任何一条 user → Contact 数据为空（admin 种子没跑） */
  DATA_MISSING = 6001,
  /** 保存 Contact 展示字段失败（Prisma update 抛错） */
  SAVE_FAILED = 6002,
}

const CONTACT_ERROR_MSG: Record<ContactBizError, string> = {
  [ContactBizError.DATA_MISSING]: 'Contact 展示数据未初始化，请联系管理员执行种子脚本',
  [ContactBizError.SAVE_FAILED]: 'Contact 展示数据保存失败',
};

export function getContactErrorInfo(err: ContactBizError): IErrorInfo {
  return {
    code: Number(err),
    message: CONTACT_ERROR_MSG[err],
  };
}
