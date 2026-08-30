<script setup lang="ts">
/**
 * AboutPage · 关于我（完整填充 + 滚动进入揭示动画）。
 *
 * 数据来源：aboutStore.fetchAbout()（GET /api/about，公开缓存 1 min + 本地兜底）
 * 原先写死数据 from '@/data' 仅作为接口失败时的兜底（由 aboutStore 内部统一处理，
 * 这里消费端不再直接 import 写死数据，统一 aboutStore.safeAbout 出口）。
 */
import { computed, onMounted, ref } from 'vue'
import { Badge, Card, CardContent, CardHeader, CardTitle, CardDescription, Separator } from '@/components/ui'
import { MapPin, Briefcase, Coffee, Heart } from 'lucide-vue-next'
import { useScrollReveal } from '@/composables/useScrollReveal'
import { useAboutStore } from '@/stores/about'
import { useAuthStore } from '@/stores/auth'
import ContributionHeatmap from '@/components/ContributionHeatmap.vue'
import type { SkillGroup } from '@/lib/api-types'

const aboutStore = useAboutStore()
const authStore = useAuthStore()

const rootRef = ref<HTMLElement | null>(null)
useScrollReveal(rootRef)

onMounted(async () => {
  await aboutStore.fetchAbout()
})

/* ------ 简化取值 ------ */
const a = computed(() => aboutStore.safeAbout)
/** 圆形头像 URL（优先后端 About.avatar，兜底 authStore 账号头像，再兜底 null=显示首字母渐变图） */
const avatarUrl = computed(() => {
  const raw = a.value.avatar || authStore.user?.avatar || null
  return authStore.resolveAvatarUrl(raw)
})
const nameInitial = computed(() => (aboutStore.displayName || 'T').charAt(0).toUpperCase())
/** location 短版：取 "中国 · 远程..." 第一段，用于首页之外的场景（这里目前没用到，保留给后续 widget） */
const locationShort = computed(() => a.value.location.split(' · ')[0] ?? a.value.location)

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

    <!-- 3. 贡献热力图 -->
    <section data-reveal="0.08">
      <ContributionHeatmap />
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
