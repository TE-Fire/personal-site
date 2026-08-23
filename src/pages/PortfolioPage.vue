<script setup lang="ts">
/**
 * PortfolioPage · 作品集（骨架）。T05 补详细作品卡片 + 筛选。
 */
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui'
</script>

<template>
  <article class="space-y-10">
    <header class="space-y-3 max-w-3xl">
      <p class="m-0 text-xs font-mono text-brand uppercase tracking-wider">/ portfolio</p>
      <h1 class="m-0 text-3xl md:text-4xl font-bold tracking-tight">作品集</h1>
      <p class="m-0 text-base md:text-lg text-text-muted leading-relaxed">
        精选一些最近的项目：Web 应用、工具脚本、设计系统、以及偶尔的独立小玩具。（T05 补真实项目）
      </p>
    </header>

    <div class="grid gap-5 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
      <Card v-for="n in 6" :key="n" class="transition hover:-translate-y-0.5 hover:shadow-md">
        <div class="aspect-[16/10] bg-gradient-to-br from-brand/10 via-surface-muted to-accent/10 rounded-t-lg border-b border-border/60 flex items-center justify-center text-text-muted text-sm">
          🦴 作品封面 #{{ n }}
        </div>
        <CardHeader>
          <CardTitle>项目 {{ n }} · 标题占位</CardTitle>
          <CardDescription>一句简介占位：解决了什么问题，用了哪些技术栈，上线效果。</CardDescription>
        </CardHeader>
        <CardContent class="pt-0 text-xs text-text-muted">
          标签：Vue 3 / TypeScript / Tailwind CSS
        </CardContent>
      </Card>
    </div>
  </article>
</template>
