<script setup lang="ts">
/**
 * BlogPage · 博客列表（真实文章 + 分类筛选器）。
 * 数据源：onMounted 调 GET /api/posts + GET /api/categories 拉取真实数据。
 *        分类管理弹窗关闭后刷新分类列表，确保数据一致。
 */
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import {
  Badge,
  Button,
  Card,
  CardTitle,
  CardDescription
} from '@/components/ui'
import {
  ArrowRight,
  CalendarDays,
  Clock,
  BookOpen,
  X,
  FilePlus2,
  Edit3,
  Settings2,
  Hash
} from 'lucide-vue-next'
import { fetchPosts } from '@/api/post'
import { fetchCategories } from '@/api/category'
import type { PostVo, CategoryVo } from '@/lib/api-types'
import CategoryManageDialog from '@/components/CategoryManageDialog.vue'
import BlogSkeleton from '@/components/BlogSkeleton.vue'

const router = useRouter()

const posts = ref<PostVo[]>([])
const categories = ref<CategoryVo[]>([])
const isLoading = ref(true)
const errorMsg = ref('')

async function loadPosts() {
  isLoading.value = true
  errorMsg.value = ''
  try {
    const [page, cats] = await Promise.all([
      fetchPosts({ page: 1, pageSize: 50 }),
      fetchCategories(),
    ])
    posts.value = page.list
    categories.value = cats
  } catch (e) {
    errorMsg.value = (e as Error).message
  } finally {
    isLoading.value = false
  }
}

/** 仅刷新分类列表（分类管理弹窗关闭后调用） */
async function reloadCategories() {
  try {
    categories.value = await fetchCategories()
  } catch {
    /* 静默失败，保持原列表 */
  }
}

onMounted(loadPosts)

/** 分类 tab：用后端真实分类，前置「全部」 */
const postCategories = computed<string[]>(() => {
  const names = categories.value.map((c) => c.name)
  return ['全部', ...names]
})

const activeCategory = ref<string>('全部')

const filtered = computed(() =>
  activeCategory.value === '全部'
    ? posts.value
    : posts.value.filter((p) => p.category?.name === activeCategory.value)
)

const hasActiveFilter = computed(() => activeCategory.value !== '全部')
function resetFilter() { activeCategory.value = '全部' }

/* 分类管理弹窗 */
const categoryDialogOpen = ref(false)

/* 当前选中的分类被删除时，回退到「全部」 */
watch(postCategories, (list) => {
  if (activeCategory.value !== '全部' && !list.includes(activeCategory.value)) {
    activeCategory.value = '全部'
  }
})

/* 弹窗关闭时刷新分类列表 */
function onCategoryDialogClose() {
  categoryDialogOpen.value = false
  reloadCategories()
}
</script>

<template>
  <article class="space-y-8 max-w-5xl mx-auto">
    <!-- 头部 -->
    <header class="space-y-3">
      <p class="m-0 text-xs font-mono text-brand uppercase tracking-wider">/ blog</p>
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 class="m-0 text-3xl md:text-4xl font-bold tracking-tight flex items-center gap-2">
            <BookOpen class="size-7 text-brand" />
            博客
          </h1>
          <p class="m-0 mt-2 text-base md:text-lg text-text-muted leading-relaxed max-w-2xl">
            写下来才能明白。这里收集一些工程笔记、踩坑复盘、读书摘要，偶尔也会写生活。合计 <span class="font-bold text-text-secondary">{{ posts.length }}</span> 篇。
          </p>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <button type="button" class="btn-playful" @click="router.push('/blog/new')">
            <span class="tape" aria-hidden>📎</span>
            <FilePlus2 class="icon" />
            <span class="body">
              <span class="main funny-underline">灵感落纸，写吧！</span>
              <span class="sub">反正发呆也是发呆 😆</span>
            </span>
            <span class="playful-tail">✍️<em class="spark" aria-hidden/></span>
          </button>
        </div>
      </div>
    </header>

    <!-- 分类筛选 tab + 管理 -->
    <section class="flex flex-wrap items-center gap-3 justify-between border-y border-border/50 py-4">
      <div class="flex flex-wrap items-center gap-2">
        <Button
          v-for="c in postCategories"
          :key="c"
          size="default"
          :variant="activeCategory === c ? 'default' : 'ghost'"
          @click="activeCategory = c"
        >
          {{ c }}
          <span class="ml-1 text-xs opacity-80">
            ({{ c === '全部' ? posts.length : posts.filter((p) => p.category?.name === c).length }})
          </span>
        </Button>
      </div>
      <div class="flex items-center gap-1.5">
        <Button
          v-if="hasActiveFilter"
          size="sm"
          variant="ghost"
          @click="resetFilter"
          class="text-text-muted hover:text-text"
        >
          <X class="size-4" />
          <span>清除筛选</span>
        </Button>
        <Button
          size="sm"
          variant="outline"
          @click="categoryDialogOpen = true"
          title="管理分类"
        >
          <Settings2 class="size-4" />
          <span class="hidden sm:inline">分类管理</span>
        </Button>
        <Button
          size="sm"
          variant="outline"
          @click="router.push('/blog/tags')"
          title="管理标签"
        >
          <Hash class="size-4" />
          <span class="hidden sm:inline">标签管理</span>
        </Button>
      </div>
    </section>

    <!-- 分类管理弹窗 -->
    <CategoryManageDialog :open="categoryDialogOpen" @close="onCategoryDialogClose" />

    <!-- 骨架屏加载 -->
    <BlogSkeleton v-if="isLoading" :count="3" />

    <!-- 错误提示 -->
    <div
      v-else-if="errorMsg"
      class="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive flex flex-wrap items-center gap-3"
    >
      <span>加载失败：{{ errorMsg }}</span>
      <Button size="sm" variant="outline" @click="loadPosts">重试</Button>
    </div>

    <!-- 空状态 -->
    <div
      v-else-if="filtered.length === 0"
      class="rounded-lg border border-dashed border-border/70 bg-surface-muted/20 py-16 flex flex-col items-center justify-center gap-3 text-center"
    >
      <p class="m-0 text-text-muted text-sm">这个分类下暂时还没有文章。</p>
      <div class="flex items-center gap-2">
        <Button size="sm" variant="outline" @click="resetFilter">看全部文章</Button>
        <button type="button" class="btn-playful sm" @click="router.push('/blog/new')">
          <span class="tape" aria-hidden>📌</span>
          <FilePlus2 class="icon" />
          <span class="body">
            <span class="main funny-underline">来写第一篇</span>
          </span>
          <span class="playful-tail">✨<em class="spark" aria-hidden/></span>
        </button>
      </div>
    </div>

    <!-- 博客列表（卡片式） -->
    <div v-else class="space-y-4">
      <Card
        v-for="post in filtered"
        :key="post.slug"
        class="group transition hover:-translate-y-0.5 hover:shadow-md"
      >
        <div class="flex flex-col md:flex-row md:items-stretch gap-4 p-4 md:p-5">
          <!-- 左侧信息：分类 badge + 标题 + 摘要 + 标签 -->
          <RouterLink
            :to="`/blog/${post.slug}`"
            class="no-underline flex-1 min-w-0 space-y-2.5"
          >
            <div class="flex flex-wrap items-center gap-2">
              <Badge variant="outline" class="text-[11px]">{{ post.category?.name ?? '未分类' }}</Badge>
              <Badge v-if="post.featured" variant="default" class="text-[10px] !py-0">精选</Badge>
              <span class="inline-flex items-center gap-1 text-[11px] text-text-muted font-mono">
                <CalendarDays class="size-3.5" />
                {{ post.createdAt.slice(0, 10) }}
              </span>
              <span class="inline-flex items-center gap-1 text-[11px] text-text-muted font-mono">
                <Clock class="size-3.5" />
                {{ post.readMinutes }} 分钟阅读
              </span>
            </div>

            <CardTitle class="!text-lg md:!text-xl leading-snug group-hover:text-brand transition-colors">
              {{ post.title }}
            </CardTitle>

            <CardDescription class="text-sm md:text-[15px] leading-relaxed line-clamp-3 !min-h-0">
              {{ post.excerpt }}
            </CardDescription>

            <div class="flex flex-wrap gap-1.5 pt-0.5">
              <Badge
                v-for="tag in post.tags.slice(0, 5)"
                :key="tag.id"
                variant="secondary"
                class="text-[11px] !py-0"
              >#{{ tag.name }}</Badge>
              <span
                v-if="post.tags.length > 5"
                class="text-[11px] text-text-muted self-center"
              >+{{ post.tags.length - 5 }}</span>
            </div>
          </RouterLink>

          <!-- 右侧：继续阅读 + 编辑按钮（仅用户文章可编辑） -->
          <div class="flex md:flex-col items-center justify-between md:justify-center shrink-0 md:w-16 gap-2 md:gap-3 pt-1 md:pt-0 border-t md:border-t-0 md:border-l border-border/50 md:pl-4">
            <RouterLink
              :to="`/blog/${post.slug}`"
              class="opacity-0 group-hover:opacity-100 transition-opacity text-brand"
              aria-label="继续阅读"
            >
              <ArrowRight class="size-5" />
            </RouterLink>
            <button
              type="button"
              class="inline-flex items-center justify-center size-8 rounded-lg text-text-muted hover:text-brand hover:bg-brand/10 transition"
              :title="`编辑：${post.title}`"
              @click.stop="router.push(`/blog/${post.slug}/edit`)"
            >
              <Edit3 class="size-4" />
            </button>
          </div>
        </div>
      </Card>
    </div>
  </article>
</template>
