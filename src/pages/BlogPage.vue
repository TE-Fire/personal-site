<script setup lang="ts">
/**
 * BlogPage · 博客列表（真实文章 + 分类筛选器）。
 */
import { computed, ref } from 'vue'
import {
  Badge,
  Button,
  Card,
  CardTitle,
  CardDescription
} from '@/components/ui'
import {
  posts,
  postCategories,
  readingMinutes,
  type PostCategory
} from '@/data'
import { ArrowRight, CalendarDays, Clock, BookOpen, X } from 'lucide-vue-next'

const activeCategory = ref<PostCategory>('全部')

const filtered = computed(() =>
  activeCategory.value === '全部'
    ? posts
    : posts.filter(p => p.category === activeCategory.value)
)

const hasActiveFilter = computed(() => activeCategory.value !== '全部')
function resetFilter() { activeCategory.value = '全部' }
</script>

<template>
  <article class="space-y-8 max-w-4xl mx-auto">
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
            写下来才能明白。这里收集一些工程笔记、踩坑复盘、读书摘要，偶尔也会写生活。合计 {{ posts.length }} 篇。
          </p>
        </div>
      </div>
    </header>

    <!-- 分类筛选 tab -->
    <section class="flex flex-wrap items-center gap-3 justify-between border-y border-border/50 py-4">
      <div class="flex flex-wrap gap-1.5">
        <Button
          v-for="c in postCategories"
          :key="c"
          size="sm"
          :variant="activeCategory === c ? 'default' : 'ghost'"
          @click="activeCategory = c"
        >
          {{ c }}
          <span class="ml-1 text-[10px] opacity-80">
            ({{ c === '全部' ? posts.length : posts.filter(p => p.category === c).length }})
          </span>
        </Button>
      </div>
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
    </section>

    <!-- 空状态 -->
    <div
      v-if="filtered.length === 0"
      class="rounded-lg border border-dashed border-border/70 bg-surface-muted/20 py-16 flex flex-col items-center justify-center gap-3 text-center"
    >
      <p class="m-0 text-text-muted text-sm">这个分类下暂时还没有文章。</p>
      <Button size="sm" variant="outline" @click="resetFilter">看全部文章</Button>
    </div>

    <!-- 博客列表（卡片式） -->
    <div v-else class="space-y-4">
      <Card
        v-for="post in filtered"
        :key="post.slug"
        class="group transition hover:-translate-y-0.5 hover:shadow-md"
      >
        <RouterLink
          :to="`/blog/${post.slug}`"
          class="no-underline flex flex-col md:flex-row md:items-stretch gap-4 p-4 md:p-5"
        >
          <!-- 左侧信息：分类 badge + 标题 + 摘要 + 标签 -->
          <div class="flex-1 min-w-0 space-y-2.5">
            <div class="flex flex-wrap items-center gap-2">
              <Badge variant="outline" class="text-[11px]">{{ post.category }}</Badge>
              <span class="inline-flex items-center gap-1 text-[11px] text-text-muted font-mono">
                <CalendarDays class="size-3.5" />
                {{ post.publishedAt }}
              </span>
              <span class="inline-flex items-center gap-1 text-[11px] text-text-muted font-mono">
                <Clock class="size-3.5" />
                {{ readingMinutes(post.wordCount) }} 分钟阅读
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
                :key="tag"
                variant="secondary"
                class="text-[11px] !py-0"
              >#{{ tag }}</Badge>
              <span
                v-if="post.tags.length > 5"
                class="text-[11px] text-text-muted self-center"
              >+{{ post.tags.length - 5 }}</span>
            </div>
          </div>

          <!-- 右侧：继续阅读 CTA -->
          <div class="hidden md:flex md:flex-col items-center justify-center shrink-0 w-16 opacity-0 group-hover:opacity-100 transition-opacity">
            <ArrowRight class="size-5 text-brand" />
          </div>
        </RouterLink>
      </Card>
    </div>
  </article>
</template>
