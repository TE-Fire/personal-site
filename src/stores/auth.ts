/**
 * 认证 Store
 *
 * 状态：token、user（与后端 UserProfile 字段完全一致）
 * 操作：login、fetchProfile、logout、isLoggedIn
 */
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { request } from '@/lib/axios';
import type { LoginParams, TokenPayload, UserProfile } from '@/lib/api-types';

export const useAuthStore = defineStore('auth', () => {
  /* ---------- 状态 ---------- */
  const token = ref<string | null>(localStorage.getItem('auth_token'));
  const user = ref<UserProfile | null>(null);

  /* ---------- 计算属性 ---------- */
  const isLoggedIn = computed(() => !!token.value);

  /* ---------- 操作 ---------- */

  /**
   * 登录
   */
  async function login(params: LoginParams): Promise<void> {
    const data = await request<TokenPayload>({
      method: 'POST',
      url: '/auth/login',
      data: params,
    });
    token.value = data.accessToken;
    localStorage.setItem('auth_token', data.accessToken);
  }

  /**
   * 获取当前用户信息
   */
  async function fetchProfile(): Promise<void> {
    const data = await request<UserProfile>({
      method: 'GET',
      url: '/auth/profile',
    });
    user.value = data;
  }

  /**
   * 退出登录
   */
  function logout(): void {
    token.value = null;
    user.value = null;
    localStorage.removeItem('auth_token');
  }

  return {
    token,
    user,
    isLoggedIn,
    login,
    fetchProfile,
    logout,
  };
});
