import { IErrorInfo } from '../../../common/interfaces/error.interface';

/**
 * Post 文章模块业务错误枚举
 * 码段：2000 ~ 2099
 */
export enum PostBizError {
  /** 文章不存在 */
  NOT_FOUND = 2001,
  /** 分类不存在 */
  CATEGORY_NOT_FOUND = 2002,
  /** 标签不存在 */
  TAG_NOT_FOUND = 2003,
  /** 文章 slug 已存在（URL 别名冲突） */
  SLUG_CONFLICT = 2004,
  /** 仅博主能操作（草稿保护） */
  NOT_AUTHOR = 2005,
  /** 分类下还有文章，不允许删除 */
  CATEGORY_HAS_POSTS = 2006,
  /** 标签下还有文章，不允许删除 */
  TAG_HAS_POSTS = 2007,
}

const POST_ERROR_MSG: Record<PostBizError, string> = {
  [PostBizError.NOT_FOUND]: '文章不存在',
  [PostBizError.CATEGORY_NOT_FOUND]: '分类不存在',
  [PostBizError.TAG_NOT_FOUND]: '标签不存在',
  [PostBizError.SLUG_CONFLICT]: '文章 URL 别名已存在',
  [PostBizError.NOT_AUTHOR]: '无权限操作该文章',
  [PostBizError.CATEGORY_HAS_POSTS]: '该分类下还有文章，无法删除',
  [PostBizError.TAG_HAS_POSTS]: '该标签下还有文章，无法删除',
};

export function getPostErrorInfo(err: PostBizError): IErrorInfo {
  return {
    code: Number(err),
    message: POST_ERROR_MSG[err],
  };
}
