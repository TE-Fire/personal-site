<script setup lang="ts">
/**
 * HomePage · 首页 v1.0（T06 替换 Hero 右侧终端为真·打字机）。
 * 结构：
 *   1) Hero 双栏（左：介绍 + CTA / 右：终端 placeholder）
 *   2) 4 个数字统计 chip（主技栈经验、项目数、开源 Star、月博客字数）
 *   3) 最近作品 3 条（projects 中 highlight=true 或前 3）
 *   4) 最近博文 3 条（posts 中 featured=true）
 */
import { ArrowRight, BookOpen, Sparkles, Star } from 'lucide-vue-next'
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Badge
} from '@/components/ui'
import { aboutMe, projects, posts, readingMinutes } from '@/data'
import { computed } from 'vue'

const featuredProjects = computed(() => projects.filter(p => p.highlight).slice(0, 3))
const featuredPosts = computed(() => posts.filter(p => p.featured).slice(0, 3))
const stats = aboutMe.highlightStats
</script>

<template>
  <section class="space-y-24">
    <!-- 1. Hero 双栏 -->
    <div class="grid grid-cols-1 lg:grid-cols-[1.05fr_0.95fr] gap-10 items-center py-4 md:py-10">
      <div class="flex flex-col gap-5 max-w-xl">
        <span class="inline-flex items-center gap-2 rounded-full border border-brand/30 bg-brand/5 px-3 py-1 text-xs font-medium text-brand self-start">
          <Sparkles class="size-3.5" />
          <span>欢迎来到我的数字花园 🌱</span>
        </span>

        <h1 class="font-sans text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.1] m-0">
          你好，我是
          <span class="bg-gradient-to-r from-brand via-accent to-brand bg-clip-text text-transparent bg-[length:200%_auto] animate-[shimmer_6s_linear_infinite]">
            Trae
          </span>
          <br />
          <span class="text-text-muted text-2xl md:text-3xl lg:text-4xl font-medium">
            <span class="font-mono text-brand">// </span>
            热爱构建的前端工程师
          </span>
        </h1>

        <p class="text-base md:text-lg text-text-muted leading-relaxed m-0">
          {{ aboutMe.shortBio }}
        </p>

        <div class="flex flex-wrap items-center gap-3 pt-2">
          <Button as="router-link" :to="'/portfolio'" size="lg">
            <span>看作品</span>
            <ArrowRight class="size-4" />
          </Button>
          <Button as="router-link" :to="'/contact'" size="lg" variant="outline">
            <span>联系我</span>
          </Button>
        </div>

        <div class="pt-2 flex items-center gap-2 text-xs text-text-muted">
          <span
            v-if="aboutMe.available"
            class="inline-block size-2 rounded-full bg-success/90 shadow-[0_0_0_3px_rgba(34,197,94,0.12)] animate-pulse"
          />
          <span>{{ aboutMe.available ? '目前可接单 · 远程协作友好 · UTC+8' : '暂不接项目' }} · {{ aboutMe.location }}</span>
        </div>
      </div>

      <!-- 终端占位（T06 替换为真终端 + 打字机） -->
      <div class="rounded-xl border border-border glass-panel shadow-card overflow-hidden">
        <div class="h-9 flex items-center gap-2 px-3 border-b border-border/60 bg-surface-muted/40">
          <span class="size-3 rounded-full bg-danger/80" />
          <span class="size-3 rounded-full bg-warning/80" />
          <span class="size-3 rounded-full bg-success/80" />
          <span class="ml-3 font-mono text-xs text-text-muted">~/personal-site — zsh — 80×24</span>
        </div>
        <pre class="m-0 p-5 font-mono text-[13px] leading-relaxed text-text-muted overflow-x-auto whitespace-pre-wrap break-words"><code><span class="text-success">$ </span><span class="text-brand">whoami</span>
<span class="text-text">{{ aboutMe.name }} · full-stack vibe coder based in {{ aboutMe.location.split(' · ')[0] }}</span>
<span class="text-success">$ </span><span class="text-brand">cat ./motto.txt</span>
<span class="text-text">把「设计感」和「工程化」拧在一起，做长期有用的事。</span>
<span class="text-success">$ </span><span class="text-brand">ls ./projects --only-highlight</span>
<span class="text-text-muted" v-for="(p, i) in featuredProjects" :key="p.id">{{ '  - [' + (i+1) + '] ' + p.title }}</span>
<span class="text-success">$ </span><span class="text-brand animate-pulse">▌</span></code></pre>
      </div>
    </div>

    <!-- 2. 数字统计 4 chip -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
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
    <section aria-labelledby="section-recent-work" class="space-y-5">
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
        <Card v-for="p in featuredProjects" :key="p.id" class="group overflow-hidden flex flex-col hover:-translate-y-0.5 hover:shadow-md transition">
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
    <section aria-labelledby="section-recent-posts" class="space-y-5">
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

      <ol class="space-y-3 p-0 m-0 list-none">
        <li
          v-for="post in featuredPosts"
          :key="post.slug"
        >
          <RouterLink
            :to="`/blog/${post.slug}`"
            class="group block rounded-lg border border-transparent hover:border-border/60 hover:bg-surface-muted/30 transition px-4 py-3.5 flex flex-col md:flex-row md:items-center md:justify-between gap-3 no-underline"
          >
            <div class="flex flex-col gap-1.5 min-w-0 md:pr-8">
              <div class="flex flex-wrap items-center gap-2">
                <Badge variant="outline" class="text-[11px]">{{ post.category }}</Badge>
                <span class="text-[11px] text-text-muted font-mono">{{ post.publishedAt }} · {{ readingMinutes(post.wordCount) }} min 阅读</span>
              </div>
              <h3 class="m-0 text-base md:text-[15px] font-semibold tracking-tight text-text group-hover:text-brand transition leading-snug">
                {{ post.title }}
              </h3>
              <p class="m-0 text-sm text-text-muted leading-relaxed line-clamp-2">{{ post.excerpt }}</p>
            </div>
            <div class="flex flex-wrap gap-1.5 shrink-0">
              <Badge v-for="tag in post.tags.slice(0, 3)" :key="tag" variant="secondary" class="text-[11px] !py-0">{{ tag }}</Badge>
            </div>
          </RouterLink>
        </li>
      </ol>
    </section>
  </section>
</template>
