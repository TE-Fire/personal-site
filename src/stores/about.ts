/**
 * useAboutStore · 关于我公开展示数据的状态管理 + 贡献热力图数据
 *
 * About 读取：所有消费端（AboutPage / HomePage / DraggableWidget）统一从这里拿。
 *   · 内存级 about 缓存（已 fetch 过就复用）
 *   · 兜底：若后端 About 接口尚未就绪 / 网络异常 → 自动使用 @/data/about.ts 写死数据，
 *     保证生产/开发都不会白屏。后续可以去掉这个兜底。
 *
 * Contribution 热力图读取：AboutPage 从这里拿真实后端数据。
 *   · fetchHeatmap('SITE' | 'GITHUB' | 'MERGED') → GET /contribution/{site|github|merged}
 *   · 内存级缓存（每个 source 单独 key）—— 同一页面跳走再返回不用重请求
 *   · loading / error 状态（AboutPage 里显示骨架屏 + 友好提示）
 *   · 数据失败：让 ContributionHeatmap 继续用内置 Mock（给用户 视觉上有内容看，不白屏）
 *
 * About 写入：只有 /profile「关于我展示」Tab 的管理员编辑器调用 saveAbout，
 *   · PUT /api/about → 返回新 AboutRsp → 覆盖本地 state → 这样三个消费端立即反映新值
 *   · 若修改了热力图配置 → 顺便清掉 contribution 缓存 → About 下次进入重新拉
 */
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { request } from '@/lib/axios';
import type {
  AboutRsp,
  UpdateAboutParams,
  ContributionRsp,
  HeatmapSource,
} from '@/lib/api-types';
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
    // ===== 热力图配置兜底：Phase 1 只开放 SITE，其余 disabled
    heatmapSource: 'SITE',
    heatmapEnableGithub: false,
    githubUsername: '',
    githubLink: '',
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

  /* ==========================================================================
   * Contribution 贡献热力图
   * ========================================================================== */

  /** 内存缓存：每个 source 一份 ContributionRsp（非空=已请求成功） */
  const heatmapCache = ref<Partial<Record<HeatmapSource, ContributionRsp>>>({});
  /** 每个 source 的 loading 状态（骨架屏用） */
  const heatmapLoading = ref<Partial<Record<HeatmapSource, boolean>>>({});
  /** 每个 source 的错误信息（字符串，无错=undefined） */
  const heatmapError = ref<Partial<Record<HeatmapSource, string>>>({});

  /** 对外出口：取某来源的 Contribution 数据（可能 undefined=还没加载过） */
  const heatmapData = computed(() => (src: HeatmapSource): ContributionRsp | undefined => heatmapCache.value[src]);

  /**
   * 拉取贡献热力图（带内存缓存 & loading & 错误标记）。
   * @param source 'SITE' | 'GITHUB' | 'MERGED'（目前 Phase 1 只有 SITE 有真实聚合）
   * @param force  true=忽略内存缓存，强制重新请求（一般 admin 刚保存完配置才会用）
   */
  async function fetchHeatmap(
    source: HeatmapSource = 'SITE',
    force = false,
  ): Promise<ContributionRsp | undefined> {
    if (!force && heatmapCache.value[source]) return heatmapCache.value[source];
    heatmapLoading.value[source] = true;
    heatmapError.value[source] = undefined;
    try {
      // 路由 = /contribution/site | /contribution/github | /contribution/merged
      const path = `/contribution/${source.toLowerCase()}`;
      const data = await request<ContributionRsp>({ method: 'GET', url: path });
      heatmapCache.value[source] = data;
      return data;
    } catch (err) {
      const msg = (err as Error)?.message ?? '请求失败';
      console.warn(`[aboutStore] fetchHeatmap(${source}) 失败，AboutPage 会降级显示 Mock 数据：${msg}`);
      heatmapError.value[source] = msg;
      // 失败不 throw：UI 层可以根据 heatmapData[source]==undefined 判断 → 传 null 给 Heatmap 组件
      // （Heatmap 组件对 null prop 用内置 generateMockData）
      return undefined;
    } finally {
      heatmapLoading.value[source] = false;
    }
  }

  /**
   * 清掉 contribution 缓存：
   *   · admin PUT /api/about 保存完热力图配置后自动调用
   *   · 也可手动在 Profile 编辑器里单独点「刷新热力图」时调用（目前没做这个按钮）
   */
  function invalidateHeatmap(source?: HeatmapSource) {
    if (!source) {
      heatmapCache.value = {};
      heatmapLoading.value = {};
      heatmapError.value = {};
      return;
    }
    delete heatmapCache.value[source];
    delete heatmapLoading.value[source];
    delete heatmapError.value[source];
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
    // ----- contribution heatmap -----
    heatmapCache,
    heatmapLoading,
    heatmapError,
    heatmapData,
    fetchHeatmap,
    invalidateHeatmap,
  };
});
