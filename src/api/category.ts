/**
 * Category 模块前端 API 封装
 *
 * 与后端 server/src/modules/category/category.controller.ts 路由对齐：
 *   GET    /api/categories        查询全部分类（公开，含文章数）
 *   POST   /api/categories        创建分类（需登录）
 *   PUT    /api/categories/:id    更新分类（需登录）
 *   DELETE /api/categories/:id    删除分类（需登录，文章分类自动置空）
 */
import { request } from '@/lib/axios';
import type { CategoryVo } from '@/lib/api-types';

/** 查询全部分类（公开，含 postCount） */
export function fetchCategories(): Promise<CategoryVo[]> {
  return request<CategoryVo[]>({
    method: 'GET',
    url: '/categories',
  });
}

/** 创建分类（需登录） */
export function createCategory(params: {
  name: string;
  sort?: number;
}): Promise<CategoryVo> {
  return request<CategoryVo>({
    method: 'POST',
    url: '/categories',
    data: params,
  });
}

/** 更新分类（需登录，name/sort 可选） */
export function updateCategory(
  id: number,
  params: { name?: string; sort?: number },
): Promise<CategoryVo> {
  return request<CategoryVo>({
    method: 'PUT',
    url: `/categories/${id}`,
    data: params,
  });
}

/** 删除分类（需登录，关联文章分类自动置空） */
export function deleteCategory(id: number): Promise<void> {
  return request<void>({
    method: 'DELETE',
    url: `/categories/${id}`,
  });
}
