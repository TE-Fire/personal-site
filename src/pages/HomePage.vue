<script setup lang="ts">
/**
 * HomePage · 首页（Hero 终端 + 3D/2D 背景 + 滚动揭示动效 + 数字统计 + 最近作品 + 最近博客）。
 *
 * About 展示数据源：
 *   · 统一从 aboutStore.safeAbout 取（后端 GET /api/about + 本地兜底），不再直接 import @/data/about 的写死值。
 *   · onMounted 触发 aboutStore.fetchAbout()，接口失败会自动回退到 aboutStore 内部的兜底数据。
 *
 * 首页精选 / 最近博客：
 *   · 之前（旧 bug）：直接 import @/data/posts.ts 的静态 Mock 数据，后端软删/硬删完全不生效
 *   · 现在：onMounted 调 GET /api/posts?featured=true&pageSize=3 真实接口，
 *          游客模式后端会强制 status=published，软删除(ARCHIVED) / 草稿(DRAFT) 的文章不会出现
 */
import { computed, onMounted, ref } from 'vue'
import {
  ArrowRight,
  BookOpen,
  Download,
  Mail,
  RefreshCcw,
  Sparkles,
  Star
} from 'lucide-vue-next'
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui'
import {
  projects,
  type Project,
} from '@/data'
import { fetchPosts } from '@/api/post'
import type { PostVo } from '@/lib/api-types'
import { useAboutStore } from '@/stores/about'
import { useTerminal, type TerminalStep } from '@/composables/useTerminal'
import { useVantaBackground } from '@/composables/useVantaBackground'
import { useScrollReveal } from '@/composables/useScrollReveal'

/* ---------------- About 数据 ---------------- */

const aboutStore = useAboutStore()
onMounted(async () => {
  try {
    await aboutStore.fetchAbout()
  } catch {
    // aboutStore 内部已自动兜底，这里不抛
  }
  // 首页精选（真实接口，游客自动过滤 archived/draft）
  await loadFeaturedPosts()
})

/* ---------------- 数据 ---------------- */

const featuredProjects = computed<Project[]>(() =>
  projects.filter((p) => p.highlight).slice(0, 3)
)

/* ---------- 首页精选博客（后端接口，响应式） ---------- */
const featuredPosts = ref<PostVo[]>([])
const loadingFeaturedPosts = ref(true)
const featuredPostsFailed = ref(false)

function readingMinutes(wordCount: number) {
  return Math.max(1, Math.ceil(wordCount / 500))
}

async function loadFeaturedPosts() {
  loadingFeaturedPosts.value = true
  featuredPostsFailed.value = false
  try {
    const page = await fetchPosts({ featured: true, page: 1, pageSize: 3 })
    featuredPosts.value = page.list ?? []
  } catch (e) {
    featuredPostsFailed.value = true
    featuredPosts.value = []
  } finally {
    loadingFeaturedPosts.value = false
  }
}
async function retryFeaturedPosts() {
  await loadFeaturedPosts()
}

const stats = computed(() => aboutStore.safeAbout.highlightStats)
const firstLocation = computed(() =>
  (aboutStore.safeAbout.location || '').split(' · ')[0] ?? aboutStore.safeAbout.location,
)

/* ---------------- 终端脚本 ---------------- */

const script = computed<TerminalStep[]>(() => {
  const a = aboutStore.safeAbout
  const displayName = aboutStore.displayName
  const projLines = featuredProjects.value.map(
    (p, i) => `  - [${i + 1}] ${p.title}  ·  ${p.category}  ·  ${p.finishedAt}`
  )
  const postLines = featuredPosts.value.map((p) => {
    const mins = readingMinutes(p.wordCount)
    const date = (p.createdAt || '').slice(0, 10) || '近期'
    const cat = p.category?.name || '未分类'
    return `  · ${p.title}  (${cat} · ${date} · ${mins} min)`
  })
  return [
    { type: 'command', text: 'whoami' },
    {
      type: 'output',
      lines: [
        `${displayName} · full-stack vibe coder based in ${firstLocation.value}`,
        `  方向：${(a.tags || []).slice(0, 4).map(t => `· ${t}`).join(` `)}`
      ],
      pauseMs: 360
    },
    { type: 'command', text: 'cat ./motto.txt' },
    {
      type: 'output',
      lines: ['把「设计感」和「工程化」拧在一起，做长期有用的事。'],
      pauseMs: 360
    },
    { type: 'command', text: 'ls ./projects --only-highlight' },
    {
      type: 'output',
      lines: projLines.length
        ? projLines
        : ['  (nothing here yet, go build something ✨)'],
      pauseMs: 360
    },
    { type: 'command', text: 'head -n 3 ./blog/latest.md' },
    {
      type: 'output',
      lines: postLines,
      muted: true,
      pauseMs: 360
    },
    { type: 'command', text: './ai --intro --vibe --color=purple' },
    {
      type: 'output',
      lines: [
        '>> 欢迎，我是 Trae 的个人站点助手 🤖',
        '>> 左侧可以直接跳到作品页或发邮件；祝你今天有愉快的 1 分钟浏览 ~'
      ],
      pauseMs: 280
    },
    { type: 'blank', count: 1, pauseMs: 160 }
  ]
})

/* ---------------- Refs ---------------- */

const pageRoot = ref<HTMLElement | null>(null)
const heroBgEl = ref<HTMLElement | null>(null)

const { lines, isTyping, isDone, restart, skipToEnd } = useTerminal(script, {
  autoStart: true
})
useVantaBackground(heroBgEl)
useScrollReveal(pageRoot)
</script>

<template>
  <section ref="pageRoot" class="space-y-20 md:space-y-24">
    <!-- 1. Hero 容器 -->
    <div class="relative overflow-hidden rounded-2xl z-0 bg-gradient-to-b from-brand/5 via-accent/3 to-transparent" data-reveal>
      <!-- Vanta 3D 背景挂载点 -->
      <div ref="heroBgEl" aria-hidden="true" />

      <div class="grid grid-cols-1 lg:grid-cols-[1.05fr_0.95fr] gap-10 items-center px-2 md:px-0 py-6 md:py-10 lg:py-14">
        <div class="flex flex-col gap-5 max-w-xl relative z-[1]">
          <span class="inline-flex items-center gap-2 rounded-full border border-brand/30 bg-brand/5 px-3 py-1 text-xs font-medium text-brand self-start">
            <Sparkles class="size-3.5" />
            <span>欢迎来到我的数字花园 🌱</span>
          </span>

          <h1 class="font-sans text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.1] m-0">
            你好，我是
            <span class="bg-gradient-to-r from-brand via-accent to-brand bg-clip-text text-transparent bg-[length:200%_auto] animate-[shimmer_6s_linear_infinite]">
              {{ aboutStore.displayName }}
            </span>
            <br />
            <span class="text-text-muted text-2xl md:text-3xl lg:text-4xl font-medium">
              <span class="font-mono text-brand">// </span>
              热爱构建的前端工程师
            </span>
          </h1>

          <p class="text-base md:text-lg text-text-muted leading-relaxed m-0">
            {{ aboutStore.safeAbout.shortBio }}
          </p>

          <div class="flex flex-wrap items-center gap-3 pt-2">
            <Button as="router-link" :to="'/portfolio'" size="lg">
              <span>看作品</span>
              <ArrowRight class="size-4" />
            </Button>
            <Button as="router-link" :to="'/contact'" size="lg" variant="outline">
              <Mail class="size-4" />
              <span>联系我</span>
            </Button>
            <Button as="a" href="#" size="lg" variant="ghost" class="gap-1.5">
              <Download class="size-4" />
              <span>简历 PDF</span>
            </Button>
          </div>

          <div class="pt-2 flex items-center gap-2 text-xs text-text-muted">
            <span
              v-if="aboutStore.safeAbout.available"
              class="inline-block size-2 rounded-full bg-success/90 shadow-[0_0_0_3px_rgba(34,197,94,0.12)] animate-pulse"
            />
            <span>{{ aboutStore.safeAbout.available ? '目前可接单 · 远程协作友好 · UTC+8' : '暂不接项目' }} · {{ aboutStore.safeAbout.location }}</span>
          </div>
        </div>

        <!-- 终端块（打字机驱动） -->
        <div class="rounded-xl border border-border glass-panel shadow-card overflow-hidden flex flex-col relative z-[1]">
          <div class="h-9 flex items-center gap-2 px-3 border-b border-border/60 bg-surface-muted/40 select-none">
            <span class="size-3 rounded-full bg-danger/80" />
            <span class="size-3 rounded-full bg-warning/80" />
            <span class="size-3 rounded-full bg-success/80" />
            <span class="ml-3 font-mono text-xs text-text-muted truncate">~/personal-site — zsh — 80×24</span>
            <span class="ml-auto flex items-center gap-1">
              <button
                type="button"
                class="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] text-text-muted hover:text-text hover:bg-surface-muted/60 transition disabled:opacity-50"
                :disabled="isTyping"
                @click="restart"
                title="重新播放"
              >
                <RefreshCcw class="size-3" />
                replay
              </button>
              <button
                v-if="isTyping"
                type="button"
                class="px-2 py-1 rounded text-[11px] text-text-muted hover:text-text hover:bg-surface-muted/60 transition"
                @click="skipToEnd"
                title="跳到结果"
              >
                skip ▸
              </button>
            </span>
          </div>

          <pre class="m-0 p-5 font-mono text-[13px] leading-relaxed overflow-x-auto whitespace-pre-wrap break-words min-h-[320px] md:min-h-[360px]"><code><template v-for="(ln, idx) in lines" :key="ln.id"><span v-if="ln.type === 'cmd'" class="text-success select-none">$ </span><span
              :class="[
                ln.type === 'cmd' ? 'text-brand' : '',
                ln.type === 'output' ? 'text-text' : '',
                ln.type === 'info' ? 'text-text-muted' : ''
              ]"
            >{{ ln.visible }}</span><span
              v-if="idx === lines.length - 1 && (isTyping || isDone) && (ln.type === 'cmd' ? ln.done : true)"
              class="ml-[1px] inline-block w-[0.55em] translate-y-[0.06em] text-brand"
              :class="isTyping ? 'animate-pulse' : 'opacity-80'"
              aria-hidden="true"
            >▌</span>
<br /></template></code></pre>

          <!-- 终端底部 CTA：打字完成后淡入 -->
          <div
            class="border-t border-border/60 bg-surface-muted/20 px-4 py-3 flex items-center justify-between gap-3 transition-all duration-300"
            :class="isDone ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-1 pointer-events-none'"
          >
            <div class="text-[11px] text-text-muted">
              <span class="font-mono text-brand">ready.</span>
              <span class="ml-1.5 hidden sm:inline">下一步去哪里？</span>
            </div>
            <div class="flex flex-wrap items-center gap-2">
              <Button as="router-link" :to="'/portfolio'" size="sm" class="gap-1.5">
                <span>查看作品</span>
                <ArrowRight class="size-3.5" />
              </Button>
              <Button as="router-link" :to="'/blog'" size="sm" variant="outline" class="gap-1.5">
                <BookOpen class="size-3.5" />
                <span>阅读博客</span>
              </Button>
              <Button as="router-link" :to="'/contact'" size="sm" variant="ghost">
                <span>联系我</span>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 2. 数字统计 4 chip -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4" data-reveal="0.04">
      <div
        v-for="s in stats"
        :key="s.label"
        class="rounded-lg border border-border/60 bg-surface-muted/25 px-5 py-4 flex flex-col gap-1"
      >
        <div class="font-mono text-2xl md:text-3xl font-bold tracking-tight text-text">{{ s.value }}</div>
        <div class="text-xs text-text-muted">{{ s.label }}</div>
      </div>
    </div>

    <!-- 3. 最近作品 3 条 -->
    <section aria-labelledby="section-recent-work" class="space-y-5" data-reveal="0.08">
      <header class="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h2 id="section-recent-work" class="m-0 text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
            <Star class="size-5 text-brand" />
            最近作品
          </h2>
          <p class="m-0 mt-1 text-sm text-text-muted">挑了 3 个我比较满意的项目。看全部请进入作品集页。</p>
        </div>
        <Button variant="link" as="router-link" :to="'/portfolio'" class="text-sm">
          <span>查看全部作品</span>
          <ArrowRight class="size-4" />
        </Button>
      </header>

      <div class="grid gap-5 grid-cols-1 md:grid-cols-3">
        <Card
          v-for="(p, i) in featuredProjects"
          :key="p.id"
          :data-reveal="String(0.04 * i)"
          class="group overflow-hidden flex flex-col hover:-translate-y-0.5 hover:shadow-md transition"
        >
          <div :class="['aspect-[16/10] bg-gradient-to-br border-b border-border/60 relative', p.cover]">
            <div class="absolute top-3 left-3">
              <Badge variant="outline" class="backdrop-blur bg-surface-elevated/70">{{ p.category }}</Badge>
            </div>
            <div class="absolute bottom-3 right-3 font-mono text-[11px] text-text-muted/80 backdrop-blur bg-surface-elevated/60 rounded-full px-2.5 py-1">
              {{ p.finishedAt }}
            </div>
          </div>
          <CardHeader class="flex-1">
            <CardTitle class="text-lg leading-snug">{{ p.title }}</CardTitle>
            <CardDescription class="line-clamp-2 min-h-[2.5rem]">{{ p.summary }}</CardDescription>
          </CardHeader>
          <CardContent class="pt-0 flex flex-wrap gap-1.5">
            <Badge v-for="tag in p.tags.slice(0, 3)" :key="tag" variant="secondary" class="text-[11px] !py-0">{{ tag }}</Badge>
            <span v-if="p.tags.length > 3" class="text-[11px] text-text-muted self-center">+{{ p.tags.length - 3 }}</span>
          </CardContent>
        </Card>
      </div>
    </section>

    <!-- 4. 最近博文 3 条 -->
    <section aria-labelledby="section-recent-posts" class="space-y-5" data-reveal="0.08">
      <header class="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h2 id="section-recent-posts" class="m-0 text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
            <BookOpen class="size-5 text-brand" />
            最近博客
          </h2>
          <p class="m-0 mt-1 text-sm text-text-muted">写下来才能明白。最新更新的 3 篇。</p>
        </div>
        <Button variant="link" as="router-link" :to="'/blog'" class="text-sm">
          <span>全部文章</span>
          <ArrowRight class="size-4" />
        </Button>
      </header>

      <!-- 加载中：骨架屏 shimmer 占位 -->
      <div v-if="loadingFeaturedPosts" class="space-y-3">
        <div v-for="n in 3" :key="n" class="rounded-lg border border-border/40 px-4 py-3.5 space-y-3">
          <div class="flex flex-wrap items-center gap-2">
            <div class="skeleton skeleton-chip" style="width:70px;height:18px;"></div>
            <div class="skeleton skeleton-line" style="width:180px;height:12px;margin:0;"></div>
          </div>
          <div class="skeleton skeleton-h2" style="width:72%;"></div>
          <div class="skeleton skeleton-line" style="width:94%;"></div>
          <div class="skeleton skeleton-line" style="width:80%;"></div>
          <div class="flex flex-wrap gap-1.5">
            <div class="skeleton skeleton-chip" style="width:54px;height:18px;"></div>
            <div class="skeleton skeleton-chip" style="width:62px;height:18px;"></div>
            <div class="skeleton skeleton-chip" style="width:46px;height:18px;"></div>
          </div>
        </div>
      </div>

      <!-- 失败：重试 + 跳回博客列表 -->
      <div v-else-if="featuredPostsFailed" role="alert" class="rounded-xl border border-danger/40 bg-danger/10 px-5 py-6 text-center space-y-3">
        <p class="m-0 text-sm text-danger font-medium">精选博客加载失败</p>
        <p class="m-0 text-xs text-text-muted">可能是网络问题，也可能后端服务未启动。</p>
        <div class="flex items-center justify-center gap-2 pt-1">
          <Button size="sm" variant="outline" @click="retryFeaturedPosts">
            <RefreshCcw class="size-4" /> 重试
          </Button>
          <Button size="sm" variant="default" as="router-link" :to="'/blog'">
            <BookOpen class="size-4" /> 前往博客列表
          </Button>
        </div>
      </div>

      <!-- 成功：列表渲染 -->
      <ol v-else-if="featuredPosts.length" class="space-y-3 p-0 m-0 list-none">
        <li
          v-for="(post, i) in featuredPosts"
          :key="post.slug"
          :data-reveal="String(0.05 * i)"
        >
          <RouterLink
            :to="`/blog/${post.slug}`"
            class="group block rounded-lg border border-transparent hover:border-border/60 hover:bg-surface-muted/30 transition px-4 py-3.5 flex flex-col md:flex-row md:items-center md:justify-between gap-3 no-underline"
          >
            <div class="flex flex-col gap-1.5 min-w-0 md:pr-8">
              <div class="flex flex-wrap items-center gap-2">
                <Badge variant="outline" class="text-[11px]">{{ post.category?.name ?? '未分类' }}</Badge>
                <span class="text-[11px] text-text-muted font-mono">{{ (post.createdAt || '').slice(0, 10) || '近期' }} · {{ readingMinutes(post.wordCount) }} min 阅读</span>
              </div>
              <h3 class="m-0 text-base md:text-[15px] font-semibold tracking-tight text-text group-hover:text-brand transition leading-snug">
                {{ post.title }}
              </h3>
              <p class="m-0 text-sm text-text-muted leading-relaxed line-clamp-2">{{ post.excerpt }}</p>
            </div>
            <div class="flex flex-wrap gap-1.5 shrink-0">
              <Badge v-for="tag in (post.tags ?? []).slice(0, 3)" :key="tag.id" variant="secondary" class="text-[11px] !py-0">#{{ tag.name }}</Badge>
            </div>
          </RouterLink>
        </li>
      </ol>

      <!-- 成功但没数据：提示去博客写一篇 -->
      <div v-else class="rounded-xl border border-dashed border-border/60 px-5 py-8 text-center space-y-3">
        <div class="mx-auto inline-flex size-10 items-center justify-center rounded-xl bg-brand/10 text-brand">
          <Sparkles class="size-5" />
        </div>
        <p class="m-0 text-sm text-text-secondary">还没有精选博客，先写一篇并勾选「首页精选」吧 ★</p>
        <Button size="sm" variant="outline" as="router-link" :to="'/blog/new'">
          <Star class="size-4" /> 写一篇新的
        </Button>
      </div>
    </section>
  </section>
</template>
