import { IErrorInfo } from '../../../common/interfaces/error.interface';

/**
 * About 模块业务错误枚举（关于我公开展示 + admin 保存）
 * 码段：5000 ~ 5099
 *
 * 字段级校验（class-validator 的 DTO 校验失败）走全局 BizError.VALIDATION_FAILED，
 * 不在本模块枚举里重复定义。
 */
export enum AboutBizError {
  /** DB 里未找到任何一条 user → About 数据为空（admin 种子没跑） */
  DATA_MISSING = 5001,
  /** 保存 About 展示字段失败（Prisma update 抛错） */
  SAVE_FAILED = 5002,
}

const ABOUT_ERROR_MSG: Record<AboutBizError, string> = {
  [AboutBizError.DATA_MISSING]: 'About 展示数据未初始化，请联系管理员执行种子脚本',
  [AboutBizError.SAVE_FAILED]: 'About 展示数据保存失败',
};

export function getAboutErrorInfo(err: AboutBizError): IErrorInfo {
  return {
    code: Number(err),
    message: ABOUT_ERROR_MSG[err],
  };
}
