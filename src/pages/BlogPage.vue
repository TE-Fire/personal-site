<script setup lang="ts">
/**
 * BlogPage · 博客列表（骨架）。T05 补真实文章 + 分类标签 + 分页。
 */
</script>

<template>
  <article class="space-y-10 max-w-4xl mx-auto">
    <header class="space-y-3">
      <p class="m-0 text-xs font-mono text-brand uppercase tracking-wider">/ blog</p>
      <h1 class="m-0 text-3xl md:text-4xl font-bold tracking-tight">博客</h1>
      <p class="m-0 text-base md:text-lg text-text-muted leading-relaxed">
        写下来才能明白：工程笔记、读书摘要、踩坑复盘、偶尔的生活随笔。（T05 补真实内容）
      </p>
    </header>

    <ol class="space-y-3 p-0 m-0 list-none">
      <li
        v-for="n in 8"
        :key="n"
        class="group rounded-lg border border-transparent hover:border-border/60 hover:bg-surface-muted/30 transition px-4 py-3.5 flex items-center justify-between gap-6"
      >
        <div class="flex flex-col gap-1 min-w-0">
          <h2 class="m-0 text-base md:text-[15px] font-semibold tracking-tight text-text group-hover:text-brand transition truncate">
            🦴 博客文章标题占位 #{{ n }} — 为什么我要从「写代码」转成「做设计的编码者」？
          </h2>
          <p class="m-0 text-xs md:text-sm text-text-muted leading-relaxed line-clamp-2">
            一份关于工作流转型的复盘：vibecoding 如何在 2026 年改变了一个普通开发者的日常节奏、产出质量，甚至职业方向...
          </p>
        </div>
        <time class="text-[11px] md:text-xs text-text-muted font-mono shrink-0">2026-08-{{ String(24 - n).padStart(2, '0') }}</time>
      </li>
    </ol>
  </article>
</template>
