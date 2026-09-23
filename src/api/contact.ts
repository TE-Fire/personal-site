/**
 * Contact 模块前端 API 封装
 *
 * 与后端 ContactController 路由对齐：
 *   GET    /api/contact   查询联系方式（公开）
 *   PUT    /api/contact   更新联系方式（需登录）
 *
 * axios 响应拦截器已自动解包 ApiResult.data，这里 request<T> 直接返回业务 data；
 * 错误也已由拦截器统一格式化，调用方直接 throw 即可。
 */
import { request } from '@/lib/axios';

/** GET /api/contact 返回的联系方式结构（按渠道拆分） */
export interface ContactData {
  /** 邮箱渠道 */
  email: {
    value: string;
    hint: string;
    copyValue: string;
    linkUrl: string;
    linkText: string;
    description: string;
  };
  /** GitHub 渠道 */
  github: {
    value: string;
    hint: string;
    linkUrl: string;
    linkText: string;
    description: string;
  };
  /** 微信渠道 */
  wechat: {
    value: string;
    hint: string;
    copyValue: string;
    qrCode: string | null;
    description: string;
  };
}

/** PUT /api/contact 入参（与后端 UpdateContactDto 字段对齐） */
export interface UpdateContactParams {
  contactEmail: string;
  contactEmailHint: string;
  contactGithubUrl: string;
  contactGithubLabel: string;
  contactGithubHint: string;
  contactWechatId: string;
  contactWechatQr: string | null;
  contactWechatHint: string;
}

/** 查询联系方式（公开） */
export function getContact() {
  return request<ContactData>({ method: 'GET', url: '/contact' });
}

/** 更新联系方式（需登录） */
export function updateContact(params: UpdateContactParams) {
  return request<ContactData>({ method: 'PUT', url: '/contact', data: params });
}

/**
 * 上传微信二维码图片（需登录）
 * 对应后端 POST /api/contact/upload-qr，返回 { url }。
 */
export async function uploadContactQr(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await request<{ url: string }>({
    method: 'POST',
    url: '/contact/upload-qr',
    data: formData,
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.url;
}
