<script setup lang="ts">
/**
 * BlogDetailPage.vue · 博客详情页
 * 路由 /blog/:slug
 * 数据源：
 *   1) preview=1 时优先取 sessionStorage['blog-preview-tmp'] 草稿预览（来自编辑页）
 *   2) 否则 onMounted 调 GET /api/posts/slug/:slug 获取详情
 *
 * 渲染管线（三态分离，避免主线程阻塞）：
 *   isLoading   → API 拉取阶段
 *   isParsing   → Markdown 解析阶段（marked.parse + highlight.js）
 *   rendered    → 最终 HTML ref（不再用 computed 同步阻塞）
 *
 * 超时兜底：15s 覆盖 API + 解析总耗时，超时后给用户「重试 / 返回列表」选择。
 */
import { computed, onMounted, onBeforeUnmount, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  AlertTriangle,
  ArrowLeft,
  Calendar,
  Clock3,
  Edit3,
  ExternalLink,
  Hash,
  Home,
  Sparkles,
  BookOpen,
  Loader2,
  RefreshCw
} from 'lucide-vue-next'
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  Separator
} from '@/components/ui'
import { marked } from 'marked'
import { markedHighlight } from 'marked-highlight'
import hljs from 'highlight.js/lib/common'
import { fetchPostBySlug } from '@/api/post'
import type { PostVo } from '@/lib/api-types'
import type { ExtendedBlogPost } from '@/composables/useBlogApi'
import { useScrollReveal } from '@/composables/useScrollReveal'

marked.use(
  markedHighlight({
    langPrefix: 'hljs language-',
    highlight(code: string, lang: string) {
      try {
        if (lang && hljs.getLanguage(lang)) {
          return hljs.highlight(code, { language: lang, ignoreIllegals: true }).value
        }
        return hljs.highlightAuto(code).value
      } catch {
        return code
      }
    }
  })
)
marked.setOptions({
  gfm: true,
  breaks: true
})

const props = defineProps<{ slug?: string }>()
const route = useRoute()
const router = useRouter()
const pageRoot = ref<HTMLElement | null>(null)
useScrollReveal(pageRoot)

const isPreview = computed(() => route.query.preview === '1')

/* ---------- 状态机 ---------- */
const post = ref<PostVo | null>(null)
const isLoading = ref(true)     // API 拉取中
const isParsing = ref(false)    // Markdown 解析中（渲染阶段）
const errorMsg = ref('')
const loadedFromTmp = ref(false)
const rendered = ref('')        // 最终 HTML（ref 而非 computed，避免同步阻塞）

const hasError = computed(() => !!errorMsg.value)

/* ---------- 超时控制 ---------- */
const TOTAL_TIMEOUT_MS = 15_000 // 15s 覆盖 API + 解析
let timeoutTimer: ReturnType<typeof setTimeout> | null = null

function armTimeout() {
  clearTimeout(timeoutTimer!)
  timeoutTimer = setTimeout(() => {
    if (isLoading.value || isParsing.value) {
      errorMsg.value = '请求超时（15s），可能是网络慢或文章内容过大'
      isLoading.value = false
      isParsing.value = false
      post.value = null
    }
  }, TOTAL_TIMEOUT_MS)
}
function disarmTimeout() {
  if (timeoutTimer) { clearTimeout(timeoutTimer); timeoutTimer = null }
}
onBeforeUnmount(disarmTimeout)

/* ---------- 草稿预览适配 ---------- */
function previewToVo(p: ExtendedBlogPost): PostVo {
  return {
    id: 0,
    slug: p.slug,
    title: p.title,
    excerpt: p.excerpt,
    content: p.content,
    cover: p.cover ?? null,
    featured: p.featured,
    status: 'draft',
    wordCount: p.wordCount,
    readMinutes: Math.max(1, Math.ceil(p.wordCount / 500)),
    category: p.category ? { id: 0, name: p.category, sort: 0 } : null,
    tags: (p.tags || []).map((t) => ({ id: 0, name: t })),
    author: { id: 0, nickname: '我', avatar: null },
    createdAt: p.publishedAt,
    updatedAt: p.lastModified,
  }
}

/* ---------- 解析管线（异步，不阻塞主线程） ---------- */
async function parseMarkdown(content: string) {
  isParsing.value = true
  // 让出事件循环 1 帧 → 确保 loading UI 先绘制出来
  await new Promise((r) => requestAnimationFrame(() => r(null)))
  try {
    rendered.value = marked.parse(content) as string
  } finally {
    isParsing.value = false
  }
}

/* ---------- 加载入口 ---------- */
async function loadPost() {
  disarmTimeout()
  isLoading.value = true
  isParsing.value = false
  errorMsg.value = ''
  rendered.value = ''
  post.value = null
  armTimeout()

  // 草稿预览优先
  if (isPreview.value) {
    try {
      const raw = sessionStorage.getItem('blog-preview-tmp')
      if (raw) {
        const p = JSON.parse(raw) as ExtendedBlogPost
        if (p && p.slug === props.slug) {
          loadedFromTmp.value = true
          post.value = previewToVo(p)
          isLoading.value = false
          await parseMarkdown(p.content || '')
          disarmTimeout()
          return
        }
      }
    } catch { /* ignore */ }
  }
  loadedFromTmp.value = false

  if (!props.slug) {
    post.value = null
    isLoading.value = false
    disarmTimeout()
    return
  }

  try {
    const data = await fetchPostBySlug(props.slug)
    post.value = data
    isLoading.value = false
    // 解析 Markdown（异步管线）
    await parseMarkdown(data.content || '')
  } catch (e) {
    post.value = null
    errorMsg.value = (e as Error).message || '未知错误'
    isLoading.value = false
  } finally {
    disarmTimeout()
  }
}

onMounted(loadPost)

/* ---------- 重试 / 返回 ---------- */
function retry() {
  loadPost()
}
function goBackBlog() {
  // 始终返回博客列表（优先 router.back，若栈无历史则 push 到 /blog，避免卡死）
  if (window.history.length > 1) {
    try { router.back(); return } catch { /* noop */ }
  }
  router.push('/blog')
}

/* ---------- 工具 ---------- */
const isUserArticle = computed(() => !!post.value)
function goEdit() {
  if (!post.value) return
  router.push(`/blog/${post.value.slug}/edit`)
}

// 进入详情后清掉临时预览（避免后续被误用）
onMounted(() => {
  try {
    if (isPreview.value) {
      setTimeout(() => sessionStorage.removeItem('blog-preview-tmp'), 1000 * 10)
    } else {
      sessionStorage.removeItem('blog-preview-tmp')
    }
  } catch { /* ignore */ }
})
</script>

<template>
  <div ref="pageRoot" class="space-y-8">
    <!-- 顶部导航条 -->
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div class="flex items-center gap-2">
        <Button variant="ghost" size="icon" @click="router.push('/blog')" aria-label="返回博客列表">
          <ArrowLeft class="size-5" />
        </Button>
        <div class="text-xs text-text-muted uppercase tracking-wider font-semibold flex items-center gap-1.5">
          <BookOpen class="size-3.5" />
          <router-link to="/blog" class="hover:text-brand transition">博客</router-link>
          <span class="opacity-50">/</span>
          <span class="text-text-secondary truncate max-w-[40ch]">{{ post?.title || '文章不存在' }}</span>
        </div>
      </div>
      <div v-if="post" class="flex items-center gap-2">
        <Badge v-if="isPreview" variant="secondary" class="gap-1.5">
          <Sparkles class="size-3" /> 草稿预览
        </Badge>
        <Badge v-else-if="isUserArticle" variant="outline">
          <Hash class="size-3 inline mr-1" /> 我的文章
        </Badge>
        <Badge variant="default" class="gap-1">{{ post.category?.name ?? '未分类' }}</Badge>
        <Button
          v-if="isUserArticle && !isPreview"
          size="sm"
          variant="outline"
          @click="goEdit"
        >
          <Edit3 class="size-4" />
          <span class="hidden sm:inline">编辑</span>
        </Button>
      </div>
    </div>

    <!-- ============================================================
         C3 · 加载中 → 骨架屏 + Shimmer（替代僵硬的单一 spinner）
         布局模拟最终详情页结构：面包屑 / 标题头卡片 / 标签 / 封面 / 多行正文
         ============================================================ -->
    <section v-if="isLoading" aria-busy="true" aria-label="正在加载文章" class="space-y-8">
      <!-- 顶部导航条骨架 -->
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="flex items-center gap-3">
          <div class="skeleton" style="width:40px;height:40px;border-radius:10px;"></div>
          <div class="skeleton skeleton-line" style="width:220px;margin:0;"></div>
        </div>
        <div class="flex items-center gap-2">
          <div class="skeleton skeleton-chip" style="width:82px;"></div>
          <div class="skeleton skeleton-chip" style="width:92px;"></div>
          <div class="skeleton" style="width:96px;height:36px;border-radius:9px;"></div>
        </div>
      </div>

      <!-- 头部卡片骨架：标题 / 摘要 / 日期时长 / 标签 / 封面 -->
      <section class="rounded-2xl border border-border/50 bg-surface-muted/25 px-6 py-8 md:px-10 md:py-10 space-y-7">
        <div class="space-y-5">
          <div class="skeleton skeleton-h1"></div>
          <div class="skeleton skeleton-h2" style="width:80%;"></div>
          <div class="skeleton skeleton-line" style="width:92%;"></div>
          <div class="skeleton skeleton-line" style="width:74%;"></div>
        </div>
        <div class="flex flex-wrap items-center gap-x-5 gap-y-2">
          <div class="skeleton skeleton-chip" style="width:112px;height:22px;"></div>
          <div class="skeleton skeleton-chip" style="width:150px;height:22px;"></div>
          <div class="skeleton skeleton-chip" style="width:140px;height:22px;"></div>
        </div>
        <div class="flex flex-wrap gap-2">
          <div class="skeleton skeleton-chip" style="width:72px;"></div>
          <div class="skeleton skeleton-chip" style="width:88px;"></div>
          <div class="skeleton skeleton-chip" style="width:64px;"></div>
          <div class="skeleton skeleton-chip" style="width:108px;"></div>
        </div>
        <div class="skeleton skeleton-cover" style="height:260px;"></div>
      </section>

      <!-- 正文段落骨架：3 段 + 一个"代码块" + 2 段 -->
      <div class="mx-auto w-full max-w-3xl space-y-5 py-6">
        <div class="skeleton skeleton-line-lg" style="width:100%;"></div>
        <div class="skeleton skeleton-line-lg" style="width:96%;"></div>
        <div class="skeleton skeleton-line-lg" style="width:88%;"></div>
        <div class="skeleton skeleton-line-lg" style="width:72%;"></div>
        <div class="skeleton skeleton-code" style="height:170px;margin:16px 0;"></div>
        <div class="skeleton skeleton-line-lg" style="width:94%;"></div>
        <div class="skeleton skeleton-line-lg" style="width:86%;"></div>
        <div class="skeleton skeleton-line-lg" style="width:64%;"></div>
      </div>
    </section>

    <!-- ============================================================
         错误 / 超时：正上方突出的「返回」按钮（主）+ 重试（次）
         用户：加载失败直接引导用户返回而不是一直卡死
         ============================================================ -->
    <section v-else-if="hasError" aria-live="assertive" class="mx-auto w-full max-w-2xl">
      <div class="rounded-2xl border border-danger/40 bg-gradient-to-br from-danger/10 via-transparent to-transparent px-6 py-8 md:px-10 md:py-10 shadow-xl shadow-black/10 text-center space-y-6">
        <div class="mx-auto flex items-center justify-center size-14 rounded-2xl bg-danger/15 text-danger">
          <AlertTriangle class="size-7" />
        </div>
        <div class="space-y-2">
          <h2 class="text-xl md:text-2xl font-semibold tracking-tight text-text">无法加载这篇文章</h2>
          <p class="text-text-secondary leading-relaxed">{{ errorMsg }}</p>
          <p class="text-sm text-text-muted">建议先返回博客列表，换篇文章看看，或稍后再试。</p>
        </div>
        <div class="flex flex-wrap items-center justify-center gap-3 pt-2">
          <!-- 主按钮：立即返回博客（符合用户"直接引导返回"需求） -->
          <Button variant="default" size="lg" @click="goBackBlog">
            <ArrowLeft class="size-4" />
            返回博客列表
          </Button>
          <Button variant="outline" size="lg" @click="retry">
            <RefreshCw class="size-4" />
            再试一次
          </Button>
          <Button variant="ghost" size="lg" @click="router.push('/')">
            <Home class="size-4" />
            回到首页
          </Button>
        </div>
      </div>
    </section>

    <!-- 不存在 -->
    <Card v-else-if="!post" class="mx-auto max-w-lg text-center">
      <CardHeader>
        <CardTitle class="text-2xl">这篇文章走丢了</CardTitle>
      </CardHeader>
      <CardContent class="text-text-muted">
        <p>没有找到 slug 为 <code class="px-1.5 py-0.5 rounded bg-brand/10 text-brand text-sm">{{ slug }}</code> 的文章。</p>
        <p class="mt-2">也许它只是一个还没写的想法，回到列表重新出发吧。</p>
      </CardContent>
      <CardFooter class="justify-center gap-2">
        <Button variant="outline" @click="router.push('/blog')">
          <BookOpen class="size-4" /> 博客列表
        </Button>
        <Button @click="router.push('/blog/new')">
          <Sparkles class="size-4" /> 写一篇新的
        </Button>
      </CardFooter>
    </Card>

    <!-- 存在：详情正文（标题/元信息先出，正文等解析完再出） -->
    <article v-else class="space-y-10">
      <!-- 头部元信息：卡片化展示（API 返回即渲染，不等解析） -->
      <section
        class="rounded-2xl border border-border/60 bg-surface-muted/30 px-6 py-8 md:px-10 md:py-10 space-y-6"
        data-reveal
      >
        <div class="space-y-4">
          <h1 class="text-3xl md:text-5xl font-bold tracking-tight leading-tight text-text">
            {{ post.title }}
          </h1>
          <p class="text-lg md:text-xl text-text-secondary leading-relaxed">
            {{ post.excerpt }}
          </p>
        </div>

        <div class="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-text-muted">
          <span class="inline-flex items-center gap-1.5">
            <Calendar class="size-4 text-brand" />
            {{ post.createdAt.slice(0, 10) }}
          </span>
          <span class="inline-flex items-center gap-1.5">
            <Clock3 class="size-4 text-success" />
            约 {{ post.readMinutes }} 分钟阅读 / {{ post.wordCount.toLocaleString() }} 字
          </span>
          <span
            v-if="post.updatedAt && post.updatedAt.slice(0, 10) !== post.createdAt.slice(0, 10)"
            class="inline-flex items-center gap-1.5 opacity-80"
          >
            <Edit3 class="size-4" />
            最近修改 {{ post.updatedAt.slice(0, 10) }}
          </span>
        </div>

        <div v-if="post.tags.length" class="flex flex-wrap gap-2">
          <Badge
            v-for="t in post.tags"
            :key="t.id"
            variant="secondary"
            class="text-[12px] px-2.5 py-1 rounded-full"
          >#{{ t.name }}</Badge>
        </div>

        <!-- 封面图 -->
        <div
          v-if="post.cover"
          class="rounded-2xl overflow-hidden border border-border/60 shadow-lg"
        >
          <img
            :src="post.cover"
            :alt="post.title"
            class="w-full h-auto max-h-[420px] object-cover"
            referrerpolicy="no-referrer"
            loading="lazy"
          />
        </div>
      </section>

      <!-- 正文区域：解析中显示 shimmer 骨架，完成后替换（out-in 过渡） -->
      <Transition name="fade-up" mode="out-in">
        <!-- 解析中（小尺寸正文骨架，比 API 加载更短，避免用户误以为还没拉取） -->
        <div v-if="isParsing" key="parsing" class="mx-auto w-full max-w-3xl py-10 space-y-4" aria-busy="true" aria-label="正在渲染正文">
          <div class="inline-flex items-center gap-2 text-sm text-text-muted px-3 py-1 rounded-full bg-brand/10 border border-brand/20">
            <Loader2 class="size-3.5 animate-spin text-brand" />
            <span>正在排版正文…（大文章需要多几秒）</span>
          </div>
          <div class="skeleton skeleton-line-lg" style="width:100%;"></div>
          <div class="skeleton skeleton-line-lg" style="width:96%;"></div>
          <div class="skeleton skeleton-line-lg" style="width:88%;"></div>
          <div class="skeleton skeleton-code" style="height:150px;margin:6px 0;"></div>
          <div class="skeleton skeleton-line-lg" style="width:90%;"></div>
          <div class="skeleton skeleton-line-lg" style="width:78%;"></div>
          <div class="skeleton skeleton-line-lg" style="width:62%;"></div>
        </div>

        <!-- 渲染完成 -->
        <div
          v-else
          key="done"
          data-reveal
          class="md-preview markdown-body mx-auto w-full max-w-3xl text-[16px] leading-[1.95]"
          v-html="rendered"
        />
      </Transition>

      <!-- 底部：操作区 -->
      <Separator />
      <div class="flex flex-wrap items-center justify-between gap-4 pb-4">
        <div class="flex flex-wrap items-center gap-2">
          <Badge v-for="t in post.tags" :key="t.id" variant="outline">#{{ t.name }}</Badge>
        </div>
        <div class="flex items-center gap-2">
          <Button variant="outline" size="sm" @click="router.push('/blog')">
            <ArrowLeft class="size-4" />
            博客列表
          </Button>
          <Button variant="outline" size="sm" @click="router.push('/')">
            <Home class="size-4" />
            <span class="hidden sm:inline">回首页</span>
          </Button>
          <Button
            v-if="isUserArticle && !isPreview"
            size="sm"
            @click="goEdit"
          >
            <Edit3 class="size-4" />
            <span class="hidden sm:inline">继续编辑</span>
            <ExternalLink class="size-3.5 opacity-60" />
          </Button>
        </div>
      </div>
    </article>
  </div>
</template>

<style>
/* Markdown 正文样式（与编辑器预览保持一致） */
.md-preview.markdown-body { color: hsl(var(--text)); }
.md-preview.markdown-body > * + * { margin-top: 1.35em; }
.md-preview.markdown-body h1,
.md-preview.markdown-body h2,
.md-preview.markdown-body h3,
.md-preview.markdown-body h4,
.md-preview.markdown-body h5,
.md-preview.markdown-body h6 {
  font-weight: 700;
  letter-spacing: -0.01em;
  line-height: 1.3;
  margin-top: 2em;
  margin-bottom: 0.6em;
}
.md-preview.markdown-body h1 { font-size: 2em; }
.md-preview.markdown-body h2 {
  font-size: 1.6em;
  padding-bottom: 0.3em;
  border-bottom: 1px solid hsl(var(--border) / 0.6);
}
.md-preview.markdown-body h3 { font-size: 1.3em; }
.md-preview.markdown-body p { margin: 0.9em 0; }
.md-preview.markdown-body a {
  color: hsl(var(--brand));
  text-decoration: underline;
  text-decoration-thickness: 1px;
  text-underline-offset: 3px;
}
.md-preview.markdown-body a:hover { color: hsl(var(--accent)); }
.md-preview.markdown-body blockquote {
  margin: 1.2em 0;
  padding: 0.4em 1.1em;
  border-left: 4px solid hsl(var(--brand));
  background: hsl(var(--brand) / 0.06);
  color: hsl(var(--text-secondary, var(--text-muted)));
  border-radius: 0 0.5rem 0.5rem 0;
}
.md-preview.markdown-body ul,
.md-preview.markdown-body ol { padding-left: 1.6em; margin: 0.6em 0; }
.md-preview.markdown-body ul { list-style: disc; }
.md-preview.markdown-body ol { list-style: decimal; }
.md-preview.markdown-body li + li { margin-top: 0.3em; }
.md-preview.markdown-body table {
  width: 100%;
  border-collapse: collapse;
  margin: 1em 0;
}
.md-preview.markdown-body th,
.md-preview.markdown-body td {
  border: 1px solid hsl(var(--border) / 0.8);
  padding: 0.6em 0.9em;
  text-align: left;
}
.md-preview.markdown-body th {
  background: hsl(var(--brand) / 0.08);
  font-weight: 600;
}
.md-preview.markdown-body tr:nth-child(2n) td { background: hsl(var(--surface) / 0.4); }
.md-preview.markdown-body hr {
  border: none;
  border-top: 2px dashed hsl(var(--border));
  margin: 2em 0;
}
.md-preview.markdown-body img {
  max-width: 100%;
  border-radius: 0.75rem;
  border: 1px solid hsl(var(--border) / 0.6);
}
.md-preview.markdown-body code {
  font-family: var(--font-mono), 'JetBrains Mono', Consolas, monospace;
  font-size: 0.92em;
  padding: 0.15em 0.4em;
  background: hsl(var(--brand) / 0.10);
  color: hsl(var(--accent));
  border-radius: 0.35rem;
}
.md-preview.markdown-body pre {
  margin: 1.2em 0;
  padding: 1em 1.1em;
  background: hsl(var(--color-bg, 0 0% 6%));
  border: 1px solid hsl(var(--border) / 0.8);
  border-radius: 0.85rem;
  overflow: auto;
  font-size: 0.88em;
  line-height: 1.65;
}
.md-preview.markdown-body pre code {
  background: transparent;
  padding: 0;
  color: inherit;
  font-size: inherit;
  border-radius: 0;
}
/* hljs 紫色主题 */
.md-preview.markdown-body .hljs { background: transparent; color: hsl(0 0% 88%); }
.md-preview.markdown-body .hljs-comment,
.md-preview.markdown-body .hljs-quote { color: hsl(263 15% 60%); font-style: italic; }
.md-preview.markdown-body .hljs-keyword,
.md-preview.markdown-body .hljs-selector-tag,
.md-preview.markdown-body .hljs-literal,
.md-preview.markdown-body .hljs-name,
.md-preview.markdown-body .hljs-tag { color: hsl(263 85% 75%); }
.md-preview.markdown-body .hljs-built_in,
.md-preview.markdown-body .hljs-type,
.md-preview.markdown-body .hljs-class,
.md-preview.markdown-body .hljs-number { color: hsl(190 80% 65%); }
.md-preview.markdown-body .hljs-string,
.md-preview.markdown-body .hljs-attr,
.md-preview.markdown-body .hljs-regexp { color: hsl(330 85% 72%); }
.md-preview.markdown-body .hljs-variable,
.md-preview.markdown-body .hljs-template-variable { color: hsl(50 100% 65%); }
.md-preview.markdown-body .hljs-function,
.md-preview.markdown-body .hljs-title.function_ { color: hsl(145 65% 60%); }
.md-preview.markdown-body .hljs-title,
.md-preview.markdown-body .hljs-section { color: hsl(263 90% 85%); font-weight: 600; }
.md-preview.markdown-body .hljs-operator,
.md-preview.markdown-body .hljs-punctuation { color: hsl(220 30% 75%); }
.md-preview.markdown-body .hljs-meta { color: hsl(263 70% 60%); }
.md-preview.markdown-body .hljs-params { color: hsl(25 90% 65%); }
/* 浅色模式 */
html:not(.dark) .md-preview.markdown-body pre { background: hsl(263 40% 96%); }
html:not(.dark) .md-preview.markdown-body .hljs { color: hsl(263 40% 18%); }
html:not(.dark) .md-preview.markdown-body .hljs-comment { color: hsl(263 15% 45%); }
html:not(.dark) .md-preview.markdown-body .hljs-keyword { color: hsl(263 70% 45%); }
html:not(.dark) .md-preview.markdown-body .hljs-built_in,
html:not(.dark) .md-preview.markdown-body .hljs-number { color: hsl(190 95% 32%); }
html:not(.dark) .md-preview.markdown-body .hljs-string,
html:not(.dark) .md-preview.markdown-body .hljs-attr { color: hsl(330 78% 42%); }
html:not(.dark) .md-preview.markdown-body .hljs-function { color: hsl(145 70% 30%); }
html:not(.dark) .md-preview.markdown-body .hljs-title { color: hsl(263 75% 30%); }
html:not(.dark) .md-preview.markdown-body .hljs-meta { color: hsl(263 70% 50%); }

.md-preview.markdown-body ::-webkit-scrollbar {
  width: 10px;
  height: 10px;
}
.md-preview.markdown-body ::-webkit-scrollbar-thumb {
  background: hsl(var(--brand) / 0.35);
  border-radius: 999px;
  border: 2px solid transparent;
  background-clip: padding-box;
}
.md-preview.markdown-body ::-webkit-scrollbar-thumb:hover {
  background: hsl(var(--brand) / 0.6);
  background-clip: padding-box;
  border: 2px solid transparent;
}

/* ---------- 过渡动画 ---------- */
.fade-up-enter-active,
.fade-up-leave-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
}
.fade-up-enter-from {
  opacity: 0;
  transform: translateY(8px);
}
.fade-up-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
