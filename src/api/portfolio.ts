/**
 * Portfolio 模块前端 API 封装
 *
 * 与后端 PortfolioController 路由对齐：
 *   GET    /api/portfolio            已发布作品列表（公开）
 *   GET    /api/portfolio/:slug      单个作品详情（公开）
 *   GET    /api/portfolio/admin/list 管理端列表（含草稿，需登录）
 *   POST   /api/portfolio           新建作品（需登录）
 *   PUT    /api/portfolio/:id       更新作品（需登录）
 *   DELETE /api/portfolio/:id       删除作品（需登录）
 *   PUT    /api/portfolio/reorder   批量排序（需登录）
 *
 * axios 响应拦截器已自动解包 ApiResult.data，这里 request<T> 直接返回业务 data；
 * 错误也已由拦截器统一格式化，调用方直接 throw 即可。
 */
import { request } from '@/lib/axios';

/** 作品集响应类型 */
export interface WorkData {
  id: number;
  slug: string;
  title: string;
  summary: string;
  description: string;
  /** 封面渐变（Tailwind from-via-to 表达式，写入 bg-gradient-to-br class） */
  cover: string;
  tags: string[];
  /** 项目类型，用于筛选 */
  category: string;
  /** 可选链接（首页/仓库/Demo 等） */
  links: { homepage?: string; repo?: string; demo?: string };
  /** 完成时间 */
  finishedAt: string;
  highlight: boolean;
  sortOrder: number;
  status: string;
  createdAt: string;
  updatedAt: string;
}

/** 获取已发布作品列表（公开） */
export async function getWorks(): Promise<WorkData[]> {
  return request<WorkData[]>({
    method: 'GET',
    url: '/portfolio',
  });
}

/** 获取单个作品详情（公开） */
export async function getWorkBySlug(slug: string): Promise<WorkData> {
  return request<WorkData>({
    method: 'GET',
    url: `/portfolio/${slug}`,
  });
}

/** 管理端：获取所有作品（含草稿） */
export async function getAdminWorks(): Promise<WorkData[]> {
  return request<WorkData[]>({
    method: 'GET',
    url: '/portfolio/admin/list',
  });
}

/** 管理端：创建作品 */
export async function createWork(data: Partial<WorkData>): Promise<WorkData> {
  return request<WorkData>({
    method: 'POST',
    url: '/portfolio',
    data,
  });
}

/** 管理端：更新作品 */
export async function updateWork(
  id: number,
  data: Partial<WorkData>,
): Promise<WorkData> {
  return request<WorkData>({
    method: 'PUT',
    url: `/portfolio/${id}`,
    data,
  });
}

/** 管理端：删除作品 */
export async function deleteWork(id: number): Promise<void> {
  return request<void>({
    method: 'DELETE',
    url: `/portfolio/${id}`,
  });
}

/** 管理端：批量排序 */
export async function reorderWorks(ids: number[]): Promise<void> {
  return request<void>({
    method: 'PUT',
    url: '/portfolio/reorder',
    data: { ids },
  });
}

/* ==================== 词库（分类/标签候选值） ==================== */

/** 词库类型 */
export type VocabKind = 'CATEGORY' | 'TAG';

/** 词库响应：分类与标签候选值（后端已去重排序） */
export interface WorkMeta {
  categories: string[];
  tags: string[];
}

/** 获取词库（管理端用） */
export async function getWorkMeta(): Promise<WorkMeta> {
  return request<WorkMeta>({
    method: 'GET',
    url: '/portfolio/admin/meta',
  });
}

/** 新增词条 */
export async function addVocab(kind: VocabKind, name: string): Promise<void> {
  return request<void>({
    method: 'POST',
    url: `/portfolio/admin/meta/${kind}`,
    data: { name },
  });
}

/** 重命名/合并词条（to 已存在时即合并） */
export async function renameVocab(
  kind: VocabKind,
  from: string,
  to: string,
): Promise<void> {
  return request<void>({
    method: 'PUT',
    url: `/portfolio/admin/meta/${kind}`,
    data: { from, to },
  });
}

/** 删除词条（标签会从所有作品中剥离；分类被引用时后端拒绝） */
export async function deleteVocab(kind: VocabKind, name: string): Promise<void> {
  return request<void>({
    method: 'DELETE',
    url: `/portfolio/admin/meta/${kind}/${encodeURIComponent(name)}`,
  });
}
