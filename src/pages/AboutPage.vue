<script setup lang="ts">
/**
 * AboutPage · 关于我（完整填充 + 滚动进入揭示动画）。
 *
 * 数据来源：aboutStore.fetchAbout()（GET /api/about，公开缓存 1 min + 本地兜底）
 * Contribution 热力图：aboutStore.fetchHeatmap(source)（GET /api/contribution/site，6h Redis 缓存 + 内存缓存）
 */
import { computed, onMounted, ref } from 'vue'
import { Badge, Card, CardContent, CardHeader, CardTitle, CardDescription, Separator } from '@/components/ui'
import { MapPin, Briefcase, Coffee, Heart } from 'lucide-vue-next'
import { useScrollReveal } from '@/composables/useScrollReveal'
import { useAboutStore } from '@/stores/about'
import { useAuthStore } from '@/stores/auth'
import ContributionHeatmap from '@/components/ContributionHeatmap.vue'
import type { SkillGroup, HeatmapSource } from '@/lib/api-types'

const aboutStore = useAboutStore()
const authStore = useAuthStore()

const rootRef = ref<HTMLElement | null>(null)
useScrollReveal(rootRef)

/**
 * Phase 1 选择要渲染的贡献来源（SITE，避免 GITHUB / MERGED 尚未实现的 Tab 引入复杂度）。
 * 后续 Phase 3 方案 D 可以把这里改成 "从 aboutStore.safeAbout.heatmapSource 取用户配置 + 在 Heatmap 顶部加 Tabs"。
 */
const HEATMAP_SOURCE: HeatmapSource = 'SITE'

onMounted(async () => {
  // 1) About 公开展示数据（含热力图配置 4 字段：heatmapSource / heatmapEnableGithub / ...）
  await aboutStore.fetchAbout()
  // 2) 拉取真实贡献热力图（内存缓存命中则直接返回，不会重复请求）
  await aboutStore.fetchHeatmap(HEATMAP_SOURCE)
})

/* ------ 简化取值 ------ */
const a = computed(() => aboutStore.safeAbout)
/** 圆形头像 URL（优先后端 About.avatar，兜底 authStore 账号头像，再兜底 null=显示首字母渐变图） */
const avatarUrl = computed(() => {
  const raw = a.value.avatar || authStore.user?.avatar || null
  return authStore.resolveAvatarUrl(raw)
})
const nameInitial = computed(() => (aboutStore.displayName || 'T').charAt(0).toUpperCase())

/* ------ Heatmap 组件 props 计算（从 store 拿状态 → 映射成 4 个 prop）------ */
/** 传 null=让组件兜底 Mock；传 undefined 会被 ContributionHeatmap 视为 Mock（兼容）；有真实数据传对象 */
const heatmapProp = computed(() => aboutStore.heatmapData(HEATMAP_SOURCE) ?? null)
const heatmapLoading = computed(() => Boolean(aboutStore.heatmapLoading[HEATMAP_SOURCE]))
const heatmapError = computed(() => aboutStore.heatmapError[HEATMAP_SOURCE] ?? null)

/**
 * 空态提示：真实数据 total=0 且后端 meta.fallback=true 才显示，
 * 文案里要区分"业务模块还没上线"和"确实没产出任何博客"—— 由 tablesFound 是否为空决定。
 */
const heatmapEmptyHint = computed(() => {
  const d = aboutStore.heatmapData(HEATMAP_SOURCE)
  if (!d) return null
  if (d.total !== 0) return null
  const tablesFound = d.meta?.tablesFound ?? []
  if (tablesFound.length === 0) {
    return '博主还没发布第一篇内容（博客/生活/笔记模块数据尚未接入）。先看空网格占个位置，后续发文章这里会自动长出小方块。'
  }
  return '过去一年里博主还没发布内容，下一篇文章就是起点 ✨'
})

/*
 * 把一行里的 "**粗体**" 语法用 <strong> 包起来，返回用于 v-html 的 HTML 串。
 * 这里只做 **bold** 这一种非常有限的 markdown（后端接口允许的粒度），避免 XSS 漏洞，
 * 具体做法是先用 String.prototype.replaceAll 把 & < > " 转成实体，再仅对合法 **token** 做强安全替换：
 *   "&"  ->  "&amp;"   "<"  ->  "&lt;"   ">"  ->  "&gt;"   '"'  ->  "&quot;"
 *   "**bold**" -> "<strong>bold</strong>"（匹配成对，防止未闭合注入乱结构）
 */
function renderBoldInline(src: string): string {
  const escaped = String(src ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
  // 非贪婪匹配 **x** → <strong>x</strong>；不允许 x 里含换行或 "*" 本身，避免嵌套 XSS
  return escaped.replace(/\*\*([^*\n\r]+?)\*\*/g, (_m, text) => `<strong>${text}</strong>`)
}

/** skillGroups 数组做一次 variant 规范化，保证渲染不会因为非法值崩掉样式 */
const safeSkillGroups = computed<SkillGroup[]>(() =>
  (a.value.skillGroups ?? []).map((g) => {
    const variant = (['default', 'secondary', 'outline'].includes(g.variant as any)
      ? g.variant
      : 'default') as SkillGroup['variant']
    return { ...g, variant, items: Array.isArray(g.items) ? g.items : [] }
  }),
)
</script>

<template>
  <article ref="rootRef" class="max-w-4xl mx-auto space-y-14">
    <!-- 1. 页头 -->
    <header class="space-y-5" data-reveal>
      <p class="m-0 text-xs font-mono text-brand uppercase tracking-wider">/ about</p>
      <div class="flex flex-col md:flex-row md:items-start md:gap-8 gap-6">
        <!-- 头像：有真实图 → 显示图片；null → 首字母渐变圆形 -->
        <div
          class="shrink-0 size-24 md:size-28 rounded-full ring-4 ring-brand/15 overflow-hidden bg-gradient-to-br from-brand via-accent to-chart-c2 text-white shadow-card flex items-center justify-center"
        >
          <img
            v-if="avatarUrl"
            :src="avatarUrl"
            :alt="aboutStore.displayName"
            class="size-full object-cover"
            @error="($event.target as HTMLImageElement).style.display = 'none'"
          />
          <span v-else class="font-sans font-bold text-3xl md:text-4xl tracking-tight">
            {{ nameInitial }}
          </span>
        </div>
        <div class="space-y-4 min-w-0">
          <h1 class="m-0 text-3xl md:text-4xl font-bold tracking-tight leading-tight">
            Hi, I&apos;m <span class="text-brand">{{ aboutStore.displayName }}</span>
          </h1>
          <p class="m-0 text-base md:text-lg text-text-muted leading-relaxed">
            {{ a.shortBio }}
          </p>
          <div class="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-text-muted">
            <span class="inline-flex items-center gap-1.5"><MapPin class="size-4" />{{ a.location }}</span>
            <span class="inline-flex items-center gap-1.5">
              <Briefcase class="size-4" />
              <span v-if="a.available" class="text-success font-medium">可接项目</span>
              <span v-else class="text-text-muted">项目排期满</span>
            </span>
            <span class="inline-flex items-center gap-1.5"><Coffee class="size-4" />喜欢在 UTC+8 的下午干活</span>
            <span class="inline-flex items-center gap-1.5"><Heart class="size-4" />长期主义</span>
          </div>
        </div>
      </div>
    </header>

    <!-- 2. 数字统计 chip -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4" data-reveal="0.06">
      <div
        v-for="s in a.highlightStats"
        :key="s.label"
        class="rounded-lg border border-border/60 bg-surface-muted/25 px-5 py-4 flex flex-col gap-1"
      >
        <div class="font-mono text-2xl md:text-3xl font-bold tracking-tight text-text">{{ s.value }}</div>
        <div class="text-xs text-text-muted">{{ s.label }}</div>
      </div>
    </div>

    <!-- 3. 贡献热力图（绑定真实数据 + loading + emptyHint + error） -->
    <section data-reveal="0.08">
      <ContributionHeatmap
        :data="heatmapProp"
        :loading="heatmapLoading"
        :empty-hint="heatmapEmptyHint"
        :error-msg="heatmapError"
      />
    </section>

    <Separator />

    <!-- 4. 长文介绍（两段） -->
    <section class="space-y-4" data-reveal="0.1">
      <h2 class="m-0 text-xl font-semibold tracking-tight">关于我</h2>
      <div class="space-y-3 text-[15px] md:text-base text-text leading-[1.85]">
        <p v-for="(para, idx) in a.longBio" :key="idx" class="m-0">{{ para }}</p>
      </div>
    </section>

    <!-- 5. 现在在做什么（数据来自 AboutRsp.nowDoing[]，支持 **粗体** inline markdown） -->
    <Card data-reveal="0.1">
      <CardHeader>
        <CardTitle class="flex items-center gap-2">现在 <span class="inline-block size-2 rounded-full bg-success animate-pulse" /></CardTitle>
        <CardDescription>2026 年下半年的核心方向（每半年更新一次）。</CardDescription>
      </CardHeader>
      <CardContent class="space-y-2 text-sm md:text-[15px] text-text-muted leading-relaxed list-none p-0">
        <p
          v-for="(line, idx) in a.nowDoing"
          :key="idx"
          class="m-0"
          v-html="renderBoldInline(line)"
        />
      </CardContent>
    </Card>

    <!-- 6. 技能栈（3 组） -->
    <section class="space-y-6" data-reveal="0.14">
      <h2 class="m-0 text-xl font-semibold tracking-tight">技能 &amp; 工具</h2>
      <div class="space-y-6">
        <div v-for="group in safeSkillGroups" :key="group.id" class="space-y-3">
          <h3 class="m-0 text-[15px] font-medium text-text">{{ group.title }}</h3>
          <div class="flex flex-wrap gap-2">
            <Badge v-for="skill in group.items" :key="skill" :variant="group.variant as any" class="text-sm !px-3 !py-1">
              {{ skill }}
            </Badge>
          </div>
        </div>
      </div>
    </section>

    <!-- 7. 兴趣标签 -->
    <section class="space-y-3" data-reveal="0.18">
      <h2 class="m-0 text-xl font-semibold tracking-tight">最近感兴趣</h2>
      <div class="flex flex-wrap gap-2">
        <span
          v-for="topic in a.interests"
          :key="topic"
          class="inline-flex items-center rounded-full border border-brand/30 bg-brand/5 px-3 py-1 text-xs font-medium text-brand"
        >
          <Heart class="size-3 mr-1.5" />
          {{ topic }}
        </span>
      </div>
    </section>
  </article>
</template>
