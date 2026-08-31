<script setup lang="ts">
/**
 * BlogDetailPage.vue · 博客详情页
 * 路由 /blog/:slug
 * 数据源：
 *   1) preview=1 时优先取 sessionStorage['blog-preview-tmp'] 草稿预览（来自编辑页）
 *   2) 否则 onMounted 调 GET /api/posts/slug/:slug 获取详情
 * 找不到 → 404 Card + 返回博客
 */
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  ArrowLeft,
  Calendar,
  Clock3,
  Edit3,
  ExternalLink,
  Hash,
  Home,
  Sparkles,
  BookOpen
} from 'lucide-vue-next'
import { marked } from 'marked'
import { markedHighlight } from 'marked-highlight'
import hljs from 'highlight.js/lib/common'
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

const post = ref<PostVo | null>(null)
const isLoading = ref(true)
const errorMsg = ref('')
const loadedFromTmp = ref(false)

/** 把草稿预览临时对象（旧 ExtendedBlogPost 形状）适配为 PostVo 形状，统一模板消费 */
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

async function loadPost() {
  isLoading.value = true
  errorMsg.value = ''
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
          return
        }
      }
    } catch { /* ignore */ }
  }
  loadedFromTmp.value = false
  if (!props.slug) {
    post.value = null
    isLoading.value = false
    return
  }
  try {
    post.value = await fetchPostBySlug(props.slug)
  } catch (e) {
    post.value = null
    errorMsg.value = (e as Error).message
  } finally {
    isLoading.value = false
  }
}

onMounted(loadPost)

const rendered = computed(() => {
  if (!post.value) return ''
  const content = post.value.content
  if (!content) {
    return `## ${post.value.title}

> ${post.value.excerpt}

*（正文暂未收录。如果这是草稿预览，先回到编辑器写点内容吧。）*
    `.trim()
  }
  return marked.parse(content) as string
})

const isUserArticle = computed(() => !!post.value)

function goEdit() {
  if (!post.value) return
  router.push(`/blog/${post.value.slug}/edit`)
}

// 进入详情后清掉临时预览（避免后续被误用）
onMounted(() => {
  try {
    if (isPreview.value) {
      // 保留 10s，刷新也还能看，但不会永久留着
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

    <!-- 加载中 -->
    <Card v-if="isLoading" class="mx-auto max-w-lg text-center">
      <CardContent class="py-10 text-text-muted">
        <p v-if="errorMsg" class="text-destructive">加载失败：{{ errorMsg }}</p>
        <p v-else>正在加载文章…</p>
      </CardContent>
    </Card>

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

    <!-- 存在：详情正文 -->
    <article v-else class="space-y-10">
      <!-- 头部元信息：卡片化展示 -->
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

      <!-- 正文 -->
      <div
        data-reveal
        class="md-preview markdown-body mx-auto w-full max-w-3xl text-[16px] leading-[1.95]"
        v-html="rendered"
      />

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
</style>
