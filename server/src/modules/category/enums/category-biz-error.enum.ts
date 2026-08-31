import { IErrorInfo } from '../../../common/interfaces/error.interface';

/**
 * Category 分类模块业务错误枚举
 * 码段：3000 ~ 3099
 */
export enum CategoryBizError {
  /** 分类不存在 */
  NOT_FOUND = 3001,
  /** 分类名称已存在 */
  NAME_CONFLICT = 3002,
}

const CATEGORY_ERROR_MSG: Record<CategoryBizError, string> = {
  [CategoryBizError.NOT_FOUND]: '分类不存在',
  [CategoryBizError.NAME_CONFLICT]: '分类名称已存在',
};

export function getCategoryErrorInfo(err: CategoryBizError): IErrorInfo {
  return {
    code: Number(err),
    message: CATEGORY_ERROR_MSG[err],
  };
}
