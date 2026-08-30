/**
 * 认证 Store
 *
 * 状态：token、user（与后端 UserProfile 字段完全一致）
 * 操作：login、fetchProfile、logout、isLoggedIn
 */
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { request } from '@/lib/axios';
import type {
  AvatarUploadRsp,
  ChangePasswordParams,
  LoginParams,
  TokenPayload,
  UpdateProfileParams,
  UserProfile,
} from '@/lib/api-types';

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

  /**
   * 修改密码（需登录）
   * 成功后调用方应强制登出跳登录页
   */
  async function changePassword(params: ChangePasswordParams): Promise<void> {
    await request<null>({
      method: 'POST',
      url: '/auth/change-password',
      data: params,
    });
  }

  /**
   * 更新当前登录用户资料（nickname / email / avatar）
   * 修改成功后自动刷新 authStore.user
   */
  async function updateProfile(params: UpdateProfileParams): Promise<UserProfile> {
    const updated = await request<UserProfile>({
      method: 'POST',
      url: '/users/me',
      data: params,
    });
    // 同步更新 store 里的 user 快照（避免 Header 里显示旧值）
    user.value = updated;
    return updated;
  }

  /**
   * 上传头像（返回相对 URL，后端自动绑定到当前账号）
   * 调用成功后 authStore.user.avatar 已自动更新
   */
  async function uploadAvatar(file: File): Promise<AvatarUploadRsp> {
    const formData = new FormData();
    formData.append('file', file);
    const rsp = await request<AvatarUploadRsp>({
      method: 'POST',
      url: '/users/avatar',
      data: formData,
      // 注意：不要手动设置 Content-Type，浏览器 FormData 会自己带 boundary
      headers: { 'Content-Type': undefined as any },
    });
    // 刷新 user 快照（后端已自动绑定 avatar）
    await fetchProfile();
    return rsp;
  }

  /**
   * 清除头像（置空 + 删磁盘文件）
   */
  async function removeAvatar(): Promise<void> {
    await request<null>({
      method: 'DELETE',
      url: '/users/avatar',
    });
    if (user.value) {
      user.value = { ...user.value, avatar: null };
    }
  }

  /**
   * 把后端返回的相对 avatar 路径拼完整 URL。
   * 后端返回：/uploads/avatar/xxx.png → 前端要显示成 http://localhost:3000/uploads/avatar/xxx.png
   * 如果 avatar 已经是 http(s) 外链（CDN / 图床），直接返回原串。
   */
  function resolveAvatarUrl(avatar?: string | null): string | null {
    if (!avatar) return null;
    if (avatar.startsWith('http')) return avatar;
    const base = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api').replace(/\/api$/, '');
    return `${base}${avatar}`;
  }

  return {
    token,
    user,
    isLoggedIn,
    login,
    fetchProfile,
    logout,
    changePassword,
    updateProfile,
    uploadAvatar,
    removeAvatar,
    resolveAvatarUrl,
  };
});
