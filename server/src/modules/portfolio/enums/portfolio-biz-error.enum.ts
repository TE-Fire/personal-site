import { IErrorInfo } from '../../../common/interfaces/error.interface';

/**
 * Portfolio 作品集模块业务错误枚举（作品 CRUD）
 * 码段：7000 ~ 7099
 *
 * 字段级校验（class-validator 的 DTO 校验失败）走全局 BizError.VALIDATION_FAILED，
 * 不在本模块枚举里重复定义。
 */
export enum PortfolioBizError {
  /** 作品不存在（按 id / slug 查不到，或已归档对游客隐藏） */
  DATA_MISSING = 7001,
  /** 保存作品失败（Prisma create / update 抛错） */
  SAVE_FAILED = 7002,
  /** 删除作品失败（Prisma delete 抛错） */
  DELETE_FAILED = 7003,
  /** 词条已存在（同类型词库中重名） */
  VOCAB_DUPLICATE = 7004,
  /** 词库操作失败（Prisma 抛错 / 词条不存在） */
  VOCAB_SAVE_FAILED = 7005,
  /** 分类仍被作品引用，不能直接删除（请先合并到其他分类） */
  VOCAB_CATEGORY_IN_USE = 7006,
}

const PORTFOLIO_ERROR_MSG: Record<PortfolioBizError, string> = {
  [PortfolioBizError.DATA_MISSING]: '作品不存在或已下线',
  [PortfolioBizError.SAVE_FAILED]: '作品保存失败',
  [PortfolioBizError.DELETE_FAILED]: '作品删除失败',
  [PortfolioBizError.VOCAB_DUPLICATE]: '该词条已存在',
  [PortfolioBizError.VOCAB_SAVE_FAILED]: '词条操作失败',
  [PortfolioBizError.VOCAB_CATEGORY_IN_USE]: '该分类仍被作品引用，请先合并到其他分类',
};

export function getPortfolioErrorInfo(err: PortfolioBizError): IErrorInfo {
  return {
    code: Number(err),
    message: PORTFOLIO_ERROR_MSG[err],
  };
}
