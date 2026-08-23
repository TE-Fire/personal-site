<script setup lang="ts">
/**
 * PortfolioPage · 作品集（完整填充 + 分类/标签 双维度筛选器）。
 */
import { computed, ref } from 'vue'
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription
} from '@/components/ui'
import {
  projects,
  projectCategories,
  type ProjectCategory,
  listProjectTags
} from '@/data'
import { Github, ExternalLink, X } from 'lucide-vue-next'

/** 分类筛选（空串或「全部」= 不过滤） */
const activeCategory = ref<ProjectCategory>('全部')
/** 标签筛选（null = 不筛选；点击某个 tag 启用） */
const activeTag = ref<string | null>(null)

const allTags = listProjectTags()

const filtered = computed(() => {
  return projects.filter(p => {
    const byCategory = activeCategory.value === '全部' || p.category === activeCategory.value
    const byTag = !activeTag.value || p.tags.includes(activeTag.value)
    return byCategory && byTag
  })
})

/** 清空所有筛选 */
function resetAll() {
  activeCategory.value = '全部'
  activeTag.value = null
}

/** 是否激活了任何筛选条件 */
const hasActiveFilter = computed(() => activeCategory.value !== '全部' || activeTag.value !== null)
</script>

<template>
  <article class="space-y-8">
    <!-- 头部 -->
    <header class="space-y-3 max-w-3xl">
      <p class="m-0 text-xs font-mono text-brand uppercase tracking-wider">/ portfolio</p>
      <h1 class="m-0 text-3xl md:text-4xl font-bold tracking-tight">作品集</h1>
      <p class="m-0 text-base md:text-lg text-text-muted leading-relaxed">
        挑了一些最近 2 年里做得比较用心、或者对我影响最大的项目。可以按「项目类型」或「技术标签」来筛选。
      </p>
    </header>

    <!-- 筛选器 -->
    <section class="space-y-4 border-y border-border/50 py-5">
      <div class="flex flex-wrap items-center gap-x-6 gap-y-3 justify-between">
        <!-- 分类 tab -->
        <div class="flex flex-wrap gap-1.5">
          <Button
            v-for="c in projectCategories"
            :key="c"
            size="sm"
            :variant="activeCategory === c ? 'default' : 'ghost'"
            @click="activeCategory = c"
          >
            {{ c }}
            <span
              v-if="c !== '全部'"
              class="ml-1 text-[10px] opacity-80"
            >({{ projects.filter(p => p.category === c).length }})</span>
            <span v-else class="ml-1 text-[10px] opacity-80">({{ projects.length }})</span>
          </Button>
        </div>
        <Button
          v-if="hasActiveFilter"
          size="sm"
          variant="ghost"
          @click="resetAll"
          class="text-text-muted hover:text-text"
        >
          <X class="size-4" />
          <span>清除筛选</span>
        </Button>
      </div>

      <!-- 标签 chips -->
      <div class="flex flex-wrap gap-1.5">
        <button
          v-for="tag in allTags"
          :key="tag"
          type="button"
          class="text-xs inline-flex items-center gap-1 rounded-full border transition px-2.5 py-1"
          :class="activeTag === tag
            ? 'border-brand/40 bg-brand/10 text-brand hover:bg-brand/15'
            : 'border-border/60 bg-surface-muted/20 text-text-muted hover:border-border hover:text-text hover:bg-surface-muted/40'"
          @click="activeTag = activeTag === tag ? null : tag"
        >
          #{{ tag }}
        </button>
      </div>

      <p class="m-0 text-xs text-text-muted">
        当前筛选结果：<strong class="text-text">{{ filtered.length }}</strong> / {{ projects.length }} 个项目
      </p>
    </section>

    <!-- 空状态 -->
    <div
      v-if="filtered.length === 0"
      class="rounded-lg border border-dashed border-border/70 bg-surface-muted/20 py-16 flex flex-col items-center justify-center gap-3 text-center"
    >
      <p class="m-0 text-text-muted text-sm">没有匹配的项目。</p>
      <Button size="sm" variant="outline" @click="resetAll">重置筛选条件</Button>
    </div>

    <!-- 项目卡片网格 -->
    <div v-else class="grid gap-5 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
      <Card
        v-for="p in filtered"
        :key="p.id"
        class="group overflow-hidden flex flex-col hover:-translate-y-0.5 hover:shadow-md transition"
      >
        <div
          :class="[
            'aspect-[16/10] bg-gradient-to-br border-b border-border/60 relative flex items-center justify-center text-text-muted',
            p.cover
          ]"
        >
          <div class="absolute top-3 left-3 flex gap-2">
            <Badge variant="outline" class="backdrop-blur bg-surface-elevated/70">
              {{ p.category }}
            </Badge>
            <Badge v-if="p.highlight" variant="default" class="backdrop-blur bg-brand/90 !px-2">
              ⭐ Featured
            </Badge>
          </div>
          <div class="absolute bottom-3 right-3 flex items-center gap-2">
            <a
              v-if="p.links?.repo"
              :href="p.links.repo"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="项目仓库"
              class="inline-flex size-7 items-center justify-center rounded-full bg-surface-elevated/70 backdrop-blur text-text-muted hover:text-brand hover:bg-surface-elevated/90 transition"
            >
              <Github class="size-3.5" />
            </a>
            <a
              v-if="p.links?.demo || p.links?.homepage"
              :href="p.links?.demo || p.links?.homepage"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="在线 Demo"
              class="inline-flex size-7 items-center justify-center rounded-full bg-surface-elevated/70 backdrop-blur text-text-muted hover:text-brand hover:bg-surface-elevated/90 transition"
            >
              <ExternalLink class="size-3.5" />
            </a>
            <span class="font-mono text-[11px] text-text-muted/80 backdrop-blur bg-surface-elevated/60 rounded-full px-2.5 py-1">
              {{ p.finishedAt }}
            </span>
          </div>

          <!-- 封面中央的简短标题（让渐变封面不那么空） -->
          <div class="relative z-10 max-w-[80%] text-center">
            <h3 class="m-0 text-lg md:text-xl font-semibold text-text drop-shadow-sm leading-snug">
              {{ p.title }}
            </h3>
          </div>
        </div>

        <CardHeader class="flex-1">
          <CardTitle class="text-base md:text-lg leading-snug">{{ p.title }}</CardTitle>
          <CardDescription class="text-[13px] md:text-sm line-clamp-3 min-h-[4.5rem] leading-relaxed">
            {{ p.description }}
          </CardDescription>
        </CardHeader>

        <CardContent class="pt-0 flex flex-col gap-3">
          <div class="flex flex-wrap gap-1.5">
            <Badge
              v-for="tag in p.tags.slice(0, 5)"
              :key="tag"
              variant="secondary"
              class="text-[11px] !py-0"
            >{{ tag }}</Badge>
            <span
              v-if="p.tags.length > 5"
              class="text-[11px] text-text-muted self-center"
            >+{{ p.tags.length - 5 }}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  </article>
</template>
