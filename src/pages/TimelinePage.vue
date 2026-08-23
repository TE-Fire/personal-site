<script setup lang="ts">
/**
 * TimelinePage · 经历时间线（骨架）。T05 补真实时间线条目（教育 / 工作 / 里程碑）。
 */
</script>

<template>
  <article class="space-y-10 max-w-3xl mx-auto">
    <header class="space-y-3">
      <p class="m-0 text-xs font-mono text-brand uppercase tracking-wider">/ timeline</p>
      <h1 class="m-0 text-3xl md:text-4xl font-bold tracking-tight">经历时间线</h1>
      <p class="m-0 text-base md:text-lg text-text-muted leading-relaxed">
        一份按时间顺序的履历：职业转变、重要项目、关键学习节点。（T05 补真实条目）
      </p>
    </header>

    <ol class="relative m-0 p-0 pl-7 md:pl-9 border-l border-border/70 list-none space-y-10">
      <li v-for="n in 5" :key="n" class="relative">
        <!-- 节点圆圈 -->
        <span
          class="absolute -left-[30px] md:-left-[40px] top-1.5 size-3.5 rounded-full bg-brand ring-4 ring-brand/10"
          aria-hidden
        />
        <div class="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2 class="m-0 text-base md:text-lg font-semibold tracking-tight">
            事件节点 #{{ n }} · 标题占位（比如：加入某团队 / 发布某开源项目）
          </h2>
          <time class="text-xs md:text-sm text-text-muted font-mono">2026-0{{ 6 - n }}-15</time>
        </div>
        <p class="m-0 mt-1.5 text-sm text-text-muted leading-relaxed">
          一段话描述这段经历的核心内容、我扮演的角色、关键产出与收获。
          （T05 替换真实内容）
        </p>
      </li>
    </ol>
  </article>
</template>
