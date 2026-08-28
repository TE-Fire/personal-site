/**
 * Axios 实例 + 拦截器
 *
 * 功能：
 *   · baseURL 指向后端 NestJS 服务
 *   · 请求拦截器：自动注入 Authorization: Bearer <token>
 *   · 响应拦截器：自动解包 ApiResult，401 跳转登录页
 */
import axios from 'axios';
import type { AxiosRequestConfig, AxiosResponse } from 'axios';
import type { ApiResult } from './api-types';

const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';

const http = axios.create({
  baseURL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

/* ---------- 请求拦截器：注入 Token ---------- */
http.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

/* ---------- 响应拦截器：解包 + 401 处理 ---------- */
http.interceptors.response.use(
  (response: AxiosResponse<ApiResult>) => {
    const body = response.data;
    // HTTP 200 但业务 code 非 200
    if (body.code !== 200) {
      return Promise.reject(new Error(body.message || '请求失败'));
    }
    // 直接返回 data 部分，方便调用方使用
    return body.data as any;
  },
  (error) => {
    // HTTP 401：Token 过期或无效
    if (error.response?.status === 401) {
      localStorage.removeItem('auth_token');
      // 跳转登录页（避免在登录页本身跳转导致死循环）
      if (!window.location.hash.includes('/login')) {
        window.location.hash = '#/login';
      }
    }
    // 提取后端返回的错误信息
    const msg =
      error.response?.data?.message || error.message || '网络异常';
    return Promise.reject(new Error(msg));
  },
);

/**
 * 泛型请求方法：返回值就是 ApiResult.data 的类型
 * 响应拦截器已自动解包，这里做类型断言
 */
export async function request<T = unknown>(
  config: AxiosRequestConfig,
): Promise<T> {
  const data = await http(config);
  return data as unknown as T;
}

export default http;
