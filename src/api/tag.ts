/**
 * Tag 模块前端 API 封装
 *
 * 与后端 server/src/modules/tag/tag.controller.ts 路由对齐：
 *   GET    /api/tags            查询全部标签（公开，含文章数，按文章数降序）
 *   POST   /api/tags            创建标签（需登录）
 *   PUT    /api/tags/:id        重命名标签（需登录）
 *   DELETE /api/tags/:id        删除标签（需登录，清除文章关联）
 *   POST   /api/tags/:id/merge  合并标签（需登录，source→target）
 */
import { request } from '@/lib/axios';
import type { TagVo } from '@/lib/api-types';

/** 查询全部标签（公开，含 postCount，按文章数降序） */
export function fetchTags(): Promise<TagVo[]> {
  return request<TagVo[]>({
    method: 'GET',
    url: '/tags',
  });
}

/** 创建标签（需登录） */
export function createTag(params: { name: string }): Promise<TagVo> {
  return request<TagVo>({
    method: 'POST',
    url: '/tags',
    data: params,
  });
}

/** 重命名标签（需登录） */
export function renameTag(id: number, name: string): Promise<TagVo> {
  return request<TagVo>({
    method: 'PUT',
    url: `/tags/${id}`,
    data: { name },
  });
}

/** 删除标签（需登录，文章关联自动清除） */
export function deleteTag(id: number): Promise<void> {
  return request<void>({
    method: 'DELETE',
    url: `/tags/${id}`,
  });
}

/** 合并标签（需登录，把 source 的文章关联转移到 target） */
export function mergeTag(
  sourceId: number,
  targetId: number,
): Promise<{ affectedPosts: number }> {
  return request<{ affectedPosts: number }>({
    method: 'POST',
    url: `/tags/${sourceId}/merge`,
    data: { targetId },
  });
}
