<script setup lang="ts">
/**
 * HomePage · 首页占位。
 * 结构：Hero（T06 再替换终端模拟器 + 打字机效果）→ 最近作品 → 最近博文。
 * 注意：当前仅搭骨架（Hero 标题 + CTA），T05/T06 再补详细内容。
 */
import { ArrowRight, Sparkles } from 'lucide-vue-next'
import { Button } from '@/components/ui'
</script>

<template>
  <section class="space-y-16">
    <!-- Hero 占位骨架（T06 替换） -->
    <div class="grid grid-cols-1 lg:grid-cols-[1.05fr_0.95fr] gap-10 items-center py-6 md:py-12">
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
          一个热爱构建的
          <span class="font-mono font-medium text-text-muted text-3xl md:text-4xl lg:text-5xl">// 前端工程师</span>
        </h1>

        <p class="text-base md:text-lg text-text-muted leading-relaxed m-0">
          我在 Vue 3、TypeScript、Tailwind CSS、AI Agent 与「设计师式编码」的交叉地带工作。
          这里是我长期更新的作品集、博客、经历时间线，以及一些「写下来才能明白」的思考。
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
          <span class="inline-block size-2 rounded-full bg-success/90 shadow-[0_0_0_3px_rgba(34,197,94,0.12)] animate-pulse" />
          <span>目前可接单 · 远程协作友好 · UTC+8</span>
        </div>
      </div>

      <!-- Hero 右侧：终端玻璃卡占位（T06 替换为真终端 + 打字机） -->
      <div class="rounded-xl border border-border glass-panel shadow-card overflow-hidden">
        <!-- 终端顶栏 -->
        <div class="h-9 flex items-center gap-2 px-3 border-b border-border/60 bg-surface-muted/40">
          <span class="size-3 rounded-full bg-danger/80" />
          <span class="size-3 rounded-full bg-warning/80" />
          <span class="size-3 rounded-full bg-success/80" />
          <span class="ml-3 font-mono text-xs text-text-muted">~/personal-site — zsh</span>
        </div>
        <!-- 终端体 -->
        <pre class="m-0 p-5 font-mono text-[13px] leading-relaxed text-text-muted overflow-x-auto"><code><span class="text-success">$ </span><span class="text-brand">whoami</span>
<span class="text-text">trae · full-stack vibe coder</span>
<span class="text-success">$ </span><span class="text-brand">ls ./projects</span>
<span class="text-text-muted">personal-site  vue-admin  ai-chatbot  learning-clock</span>
<span class="text-success">$ </span><span class="text-brand animate-pulse">▌</span></code></pre>
      </div>
    </div>

    <!-- 最近作品 · skeleton（T05 填充卡片） -->
    <section aria-labelledby="section-recent-work" class="space-y-5">
      <header class="flex items-end justify-between">
        <div>
          <h2 id="section-recent-work" class="m-0 text-2xl md:text-3xl font-bold tracking-tight">最近作品</h2>
          <p class="m-0 mt-1 text-sm text-text-muted">3 个我比较满意的近期项目（T05 补详细卡片与截图）。</p>
        </div>
        <Button variant="link" as="router-link" :to="'/portfolio'" class="text-sm">
          <span>查看全部</span>
          <ArrowRight class="size-4" />
        </Button>
      </header>
      <div class="grid gap-5 grid-cols-1 md:grid-cols-3">
        <div class="aspect-[4/3] rounded-lg border border-dashed border-border/70 bg-surface-muted/20 flex items-center justify-center text-text-muted text-xs">
          🦴 作品 1 · 占位卡
        </div>
        <div class="aspect-[4/3] rounded-lg border border-dashed border-border/70 bg-surface-muted/20 flex items-center justify-center text-text-muted text-xs">
          🦴 作品 2 · 占位卡
        </div>
        <div class="aspect-[4/3] rounded-lg border border-dashed border-border/70 bg-surface-muted/20 flex items-center justify-center text-text-muted text-xs">
          🦴 作品 3 · 占位卡
        </div>
      </div>
    </section>
  </section>
</template>
