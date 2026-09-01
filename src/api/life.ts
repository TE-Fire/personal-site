/**
 * Life 模块前端 API 封装
 *
 * 与后端 LifeController 路由对齐：
 *   GET    /api/life              列表分页
 *   GET    /api/life/:id          查详情
 *   POST   /api/life              新建（需登录）
 *   PUT    /api/life/:id          更新（需登录）
 *   DELETE /api/life/:id          删除（需登录，默认软删；?hard=true 物理删除）
 *   POST   /api/life/upload       文件上传（需登录）
 *   GET    /api/life/albums       相册列表
 *   POST   /api/life/albums       新建相册（需登录）
 *   PUT    /api/life/albums/:id   更新相册（需登录）
 *   DELETE /api/life/albums/:id   删除相册（需登录）
 *
 * axios 响应拦截器已自动解包 ApiResult.data，这里 request<T> 直接返回业务 data；
 * 错误也已由拦截器统一格式化，调用方直接 throw 即可。
 */
import { request } from '@/lib/axios';
import type {
  LifeMomentVo,
  LifeMomentPageVo,
  LifeAlbumVo,
  CreateLifeMomentData,
  QueryLifeMomentParams,
  LifeUploadRsp,
  CreateLifeAlbumData,
} from '@/lib/api-types';

/**
 * 查询碎片列表
 * 游客不传 status 时后端会强制只返回 published
 */
export async function fetchLifeMoments(
  params: QueryLifeMomentParams = {},
): Promise<LifeMomentPageVo> {
  return request<LifeMomentPageVo>({
    method: 'GET',
    url: '/life',
    params,
  });
}

/** 查询碎片详情 */
export async function fetchLifeMomentById(id: number): Promise<LifeMomentVo> {
  return request<LifeMomentVo>({
    method: 'GET',
    url: `/life/${id}`,
  });
}

/** 创建碎片（需登录） */
export async function createLifeMoment(
  data: CreateLifeMomentData,
): Promise<LifeMomentVo> {
  return request<LifeMomentVo>({
    method: 'POST',
    url: '/life',
    data,
  });
}

/** 更新碎片（需登录） */
export async function updateLifeMoment(
  id: number,
  data: Partial<CreateLifeMomentData>,
): Promise<LifeMomentVo> {
  return request<LifeMomentVo>({
    method: 'PUT',
    url: `/life/${id}`,
    data,
  });
}

/**
 * 删除碎片（需登录）
 * @param hard true=物理删除；false/undefined=软删除（归档）
 */
export async function deleteLifeMoment(id: number, hard = false): Promise<void> {
  return request<void>({
    method: 'DELETE',
    url: `/life/${id}`,
    // hard=true 时拼到 URL query：/life/${id}?hard=true
    params: hard ? { hard: 'true' } : undefined,
  });
}

/** 上传文件（需登录） */
export async function uploadLifeFile(file: File): Promise<LifeUploadRsp> {
  const formData = new FormData();
  formData.append('file', file);
  return request<LifeUploadRsp>({
    method: 'POST',
    url: '/life/upload',
    data: formData,
    headers: { 'Content-Type': 'multipart/form-data' },
  });
}

/* -------------------- 相册 CRUD -------------------- */

/** 查询相册列表 */
export async function fetchLifeAlbums(): Promise<LifeAlbumVo[]> {
  return request<LifeAlbumVo[]>({
    method: 'GET',
    url: '/life/albums',
  });
}

/** 创建相册（需登录） */
export async function createLifeAlbum(
  data: CreateLifeAlbumData,
): Promise<LifeAlbumVo> {
  return request<LifeAlbumVo>({
    method: 'POST',
    url: '/life/albums',
    data,
  });
}

/** 更新相册（需登录） */
export async function updateLifeAlbum(
  id: number,
  data: CreateLifeAlbumData,
): Promise<LifeAlbumVo> {
  return request<LifeAlbumVo>({
    method: 'PUT',
    url: `/life/albums/${id}`,
    data,
  });
}

/** 删除相册（需登录） */
export async function deleteLifeAlbum(id: number): Promise<void> {
  return request<void>({
    method: 'DELETE',
    url: `/life/albums/${id}`,
  });
}
