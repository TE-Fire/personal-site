import { IErrorInfo } from '../../../common/interfaces/error.interface';

/**
 * Tag 标签模块业务错误枚举
 * 码段：4000 ~ 4099
 */
export enum TagBizError {
  /** 标签不存在 */
  NOT_FOUND = 4001,
  /** 标签名称已存在 */
  NAME_CONFLICT = 4002,
  /** 合并标签时源和目标相同 */
  MERGE_SAME = 4003,
  /** 合并目标标签不存在 */
  MERGE_TARGET_NOT_FOUND = 4004,
}

const TAG_ERROR_MSG: Record<TagBizError, string> = {
  [TagBizError.NOT_FOUND]: '标签不存在',
  [TagBizError.NAME_CONFLICT]: '标签名称已存在',
  [TagBizError.MERGE_SAME]: '不能合并到自己',
  [TagBizError.MERGE_TARGET_NOT_FOUND]: '目标标签不存在',
};

export function getTagErrorInfo(err: TagBizError): IErrorInfo {
  return {
    code: Number(err),
    message: TAG_ERROR_MSG[err],
  };
}
