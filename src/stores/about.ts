/**
 * useAboutStore · 关于我公开展示数据的状态管理
 *
 * 读取：所有消费端（AboutPage / HomePage / DraggableWidget）统一从这里拿。
 *   · 内存级 about 缓存（已 fetch 过就复用）
 *   · 兜底：若后端 About 接口尚未就绪 / 网络异常 → 自动使用 @/data/about.ts 写死数据，
 *     保证生产/开发都不会白屏。后续可以去掉这个兜底。
 *
 * 写入：只有 /profile「关于我展示」Tab 的管理员编辑器调用 saveAbout，
 *   · PUT /api/about → 返回新 AboutRsp → 覆盖本地 state → 这样三个消费端立即反映新值
 */
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { request } from '@/lib/axios';
import type { AboutRsp, UpdateAboutParams } from '@/lib/api-types';
import {
  aboutMe as fallbackAbout,
  skillGroups as fallbackSkills,
} from '@/data/about';
import { useAuthStore } from './auth';

/** 把 @/data/about.ts 里的写死数据塑造成跟 AboutRsp 一致的形状（兜底用） */
function buildFallback(): AboutRsp {
  return {
    name: fallbackAbout.name,
    avatar: null,
    shortBio: fallbackAbout.shortBio,
    longBio: [...fallbackAbout.longBio],
    highlightStats: [...fallbackAbout.highlightStats] as AboutRsp['highlightStats'],
    location: fallbackAbout.location,
    available: fallbackAbout.available,
    tags: [...fallbackAbout.tags],
    interests: [...fallbackAbout.interests],
    skillGroups: fallbackSkills.map((g) => ({
      id: g.id,
      title: g.title,
      variant: g.variant as 'default' | 'secondary' | 'outline',
      items: [...g.items],
    })),
    // nowDoing 写死内容跟 AboutPage Section 5 当前硬编码 4 条保持一致
    nowDoing: [
      '🪴 **产品**：把「AI 辅助开发工作流」做成一个可复现的模板项目，并在 Gitee / GitHub 同步更新。',
      '📝 **写作**：保持 2~3 篇 / 月的节奏，主题集中在工程笔记、踩坑复盘、读书摘要三条线。',
      '🔍 **寻找**：有趣的独立项目 / 长期开源协作 / 设计系统类咨询。',
      '🛠️ **技能打磨**：正在啃 Three.js + WebGPU 的入门教程，目标 Q4 能出一个完整的 3D 小玩具。',
    ],
  };
}

export const useAboutStore = defineStore('about', () => {
  /* ---------- 状态 ---------- */
  const about = ref<AboutRsp | null>(null);
  const loading = ref(false);
  /** 兜底数据（请求失败时使用，内存中构造一次即可） */
  const fallback = buildFallback();

  /* ---------- Getters ---------- */

  /**
   * 对外暴露安全的 About 数据：
   *   · 如果 fetch 过 → 返回 state.about
   *   · 否则 → 先立刻返回兜底数据（让页面不用等接口就能渲染），并在 onMounted 阶段触发 fetchAbout 异步替换
   */
  const safeAbout = computed<AboutRsp>(() => (about.value ?? fallback));

  const displayName = computed(() => {
    const a = safeAbout.value;
    // name 兜底：若后端 DB nickname 还空 → 再兜底 authStore 里的账号昵称 → 再兜底 'Trae'
    if (a.name?.trim()) return a.name.trim();
    const auth = useAuthStore();
    return auth.user?.nickname?.trim() || fallback.name;
  });

  /**
   * About 展示头像（优先后端 avatar；若空 → 先看 authStore 账号 avatar；再兜底 null → 页面显示首字母渐变图）
   */
  function displayAvatar(): string | null {
    const auth = useAuthStore();
    const a = safeAbout.value;
    const raw = a.avatar || auth.user?.avatar || null;
    return auth.resolveAvatarUrl(raw);
  }

  /* ---------- Actions ---------- */

  /**
   * 拉后端公开 About 数据。
   * @param force 是否忽略内存缓存（默认 false；编辑器刚保存完可以强制重新拉？通常不需要，saveAbout 会直接 setState）
   */
  async function fetchAbout(force = false): Promise<AboutRsp> {
    if (!force && about.value) return about.value;
    loading.value = true;
    try {
      const data = await request<AboutRsp>({
        method: 'GET',
        url: '/about',
      });
      about.value = data;
      return data;
    } catch (err) {
      // 兜底：使用本地写死
      console.warn('[aboutStore] fetchAbout 失败，使用兜底数据：', err);
      about.value = about.value ?? fallback;
      return fallback;
    } finally {
      loading.value = false;
    }
  }

  /**
   * 管理员保存 About 展示字段。
   * 成功后：state.about = 返回值 → 所有消费端（AboutPage/HomePage/Widget）立即响应。
   *        → 内存缓存就是最新的；HTTP 端的 Redis/浏览器缓存 60s 不影响 admin 自己。
   */
  async function saveAbout(params: UpdateAboutParams): Promise<AboutRsp> {
    const data = await request<AboutRsp>({
      method: 'PUT',
      url: '/about',
      data: params,
    });
    about.value = data;
    return data;
  }

  /**
   * 手动清理缓存（比如退出登录 / 重置时用，一般场景不需要调）
   */
  function invalidate() {
    about.value = null;
  }

  return {
    // state
    about,
    loading,
    // getters
    safeAbout,
    displayName,
    // actions
    displayAvatar,
    fetchAbout,
    saveAbout,
    invalidate,
  };
});
