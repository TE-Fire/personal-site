/**
 * Post 模块前端 API 封装
 *
 * 与后端 server/src/modules/post/post.controller.ts 路由对齐：
 *   GET    /api/posts            列表分页
 *   GET    /api/posts/slug/:slug  按 slug 查详情
 *   GET    /api/posts/:id         按 id 查详情
 *   POST   /api/posts            新建（需登录）
 *   PUT    /api/posts/:id         更新（需登录）
 *   DELETE /api/posts/:id         删除（需登录，默认软删）
 *
 * axios 响应拦截器已自动解包 ApiResult.data，这里 request<T> 直接返回业务 data。
 */
import { request } from '@/lib/axios';
import type {
  PostVo,
  PostPageVo,
  QueryPostParams,
  PostStatus,
} from '@/lib/api-types';

/** 创建文章入参（与后端 CreatePostDto 一致；wordCount/readMinutes 服务端自算） */
export interface CreatePostParams {
  slug: string;
  title: string;
  content: string;
  excerpt?: string;
  cover?: string;
  featured?: boolean;
  status?: PostStatus;
  categoryId?: number;
  tagIds?: number[];
}

/** 更新文章入参（与后端 UpdatePostDto 一致，全部可选） */
export interface UpdatePostParams {
  slug?: string;
  title?: string;
  excerpt?: string;
  content?: string;
  cover?: string;
  featured?: boolean;
  status?: PostStatus;
  /** 传 null 表示清空分类 */
  categoryId?: number | null;
  /** 全量替换；空数组表示清空所有 tag */
  tagIds?: number[];
}

/**
 * 查询文章列表
 * 游客不传 status 时后端会强制只返回 published
 */
export function fetchPosts(params: QueryPostParams = {}): Promise<PostPageVo> {
  // tagIds 是数组，axios 默认会序列化为 tagIds[]=1&tagIds[]=2，后端 class-transformer 可识别
  return request<PostPageVo>({
    method: 'GET',
    url: '/posts',
    params,
  });
}

/** 按 slug 查询文章详情（公开，游客只能看已发布） */
export function fetchPostBySlug(slug: string): Promise<PostVo> {
  return request<PostVo>({
    method: 'GET',
    url: `/posts/slug/${encodeURIComponent(slug)}`,
  });
}

/** 按 id 查询文章详情 */
export function fetchPostById(id: number): Promise<PostVo> {
  return request<PostVo>({
    method: 'GET',
    url: `/posts/${id}`,
  });
}

/** 新建文章（需登录） */
export function createPost(params: CreatePostParams): Promise<PostVo> {
  return request<PostVo>({
    method: 'POST',
    url: '/posts',
    data: params,
  });
}

/** 更新文章（需登录） */
export function updatePost(id: number, params: UpdatePostParams): Promise<PostVo> {
  return request<PostVo>({
    method: 'PUT',
    url: `/posts/${id}`,
    data: params,
  });
}

/**
 * 删除文章（需登录）
 * @param hard true=物理删除；false/undefined=软删除（归档）
 */
export function deletePost(id: number, hard = false): Promise<void> {
  return request<void>({
    method: 'DELETE',
    url: `/posts/${id}`,
    params: hard ? { hard: 'true' } : undefined,
  });
}
