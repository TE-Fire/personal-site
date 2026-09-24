import { IErrorInfo } from '../../../common/interfaces/error.interface';

/**
 * Timeline 模块业务错误枚举（经历时间线 CRUD）
 * 码段：8000 ~ 8099
 *
 * 字段级校验（class-validator 的 DTO 校验失败）走全局 BizError.VALIDATION_FAILED，
 * 不在本模块枚举里重复定义。
 */
export enum TimelineBizError {
  /** 经历不存在（按 id 查不到） */
  DATA_MISSING = 8001,
  /** 保存经历失败（Prisma create / update 抛错） */
  SAVE_FAILED = 8002,
  /** 删除经历失败（Prisma delete 抛错） */
  DELETE_FAILED = 8003,
  /** 时间区间非法（结束时间早于开始时间） */
  DATE_RANGE_INVALID = 8004,
}

const TIMELINE_ERROR_MSG: Record<TimelineBizError, string> = {
  [TimelineBizError.DATA_MISSING]: '经历条目不存在或已被删除',
  [TimelineBizError.SAVE_FAILED]: '经历保存失败',
  [TimelineBizError.DELETE_FAILED]: '经历删除失败',
  [TimelineBizError.DATE_RANGE_INVALID]: '结束时间不能早于开始时间',
};

export function getTimelineErrorInfo(err: TimelineBizError): IErrorInfo {
  return {
    code: Number(err),
    message: TIMELINE_ERROR_MSG[err],
  };
}
