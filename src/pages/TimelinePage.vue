<script setup lang="ts">
/**
 * TimelinePage · 经历时间线（真实条目 + 节点类型染色）。
 */
import {
  Badge,
  Separator
} from '@/components/ui'
import { timelineNodes, nodeKindMeta } from '@/data'
import { History, Briefcase, GraduationCap, Rocket, GitPullRequestArrow } from 'lucide-vue-next'
import type { Component } from 'vue'
import type { TimelineNodeKind } from '@/data'

/** 每个节点 kind 对应的 icon 展示 */
const kindIcon: Record<TimelineNodeKind, Component> = {
  work: Briefcase,
  education: GraduationCap,
  'open-source': GitPullRequestArrow,
  milestone: Rocket
}
</script>

<template>
  <article class="space-y-10 max-w-4xl mx-auto">
    <!-- 头部 -->
    <header class="space-y-3">
      <p class="m-0 text-xs font-mono text-brand uppercase tracking-wider">/ timeline</p>
      <h1 class="m-0 text-3xl md:text-4xl font-bold tracking-tight flex items-center gap-2">
        <History class="size-7 text-brand" />
        经历时间线
      </h1>
      <p class="m-0 text-base md:text-lg text-text-muted leading-relaxed max-w-2xl">
        按时间顺序整理的一些关键节点：工作、教育、开源、里程碑。每条都尽量写了「我扮演什么角色」以及「具体产出」。
      </p>
    </header>

    <Separator />

    <!-- 时间线主体 -->
    <ol class="relative m-0 p-0 pl-7 md:pl-10 border-l border-border/70 list-none space-y-10">
      <li
        v-for="(node, index) in timelineNodes"
        :key="node.id"
        class="relative"
      >
        <!-- 左侧节点圆圈（根据 kind 染色） -->
        <span
          aria-hidden
          class="absolute -left-[29px] md:-left-[41px] top-1 flex size-4 items-center justify-center"
        >
          <span
            class="absolute inset-0 rounded-full animate-[ping_3s_cubic-bezier(0,0,0.2,1)_infinite]"
            :class="[
              nodeKindMeta[node.kind].dotClass,
              'opacity-30',
              index === 0 ? 'opacity-60' : ''
            ]"
          />
          <span
            class="relative size-3.5 rounded-full ring-4"
            :class="[
              nodeKindMeta[node.kind].dotClass,
              nodeKindMeta[node.kind].ringClass
            ]"
          />
        </span>

        <div class="space-y-3">
          <!-- 标题行：类型 badge + 标题 + 进行中 + 日期 -->
          <div class="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <Badge :variant="nodeKindMeta[node.kind].badgeVariant" class="inline-flex items-center gap-1 text-[11px] !px-2.5">
              <component :is="kindIcon[node.kind]" class="size-3.5" />
              {{ nodeKindMeta[node.kind].label }}
            </Badge>

            <Badge v-if="node.ongoing" variant="default" class="text-[11px] !px-2">进行中</Badge>

            <h2 class="m-0 text-base md:text-lg font-semibold tracking-tight leading-snug">
              {{ node.title }}
            </h2>

            <span class="text-xs text-text-muted font-mono shrink-0 ml-auto md:ml-0">
              {{ node.startedAt }}
              <template v-if="node.endedAt">
                <span class="mx-1 opacity-60">–</span>
                {{ node.endedAt }}
              </template>
              <template v-else-if="node.ongoing">
                <span class="mx-1 opacity-60">–</span>
                <span class="text-success font-medium">至今</span>
              </template>
            </span>
          </div>

          <!-- 副标题 -->
          <p v-if="node.subTitle" class="m-0 text-sm text-text-muted">
            {{ node.subTitle }}
          </p>

          <!-- 描述正文 -->
          <p class="m-0 text-sm md:text-[15px] text-text leading-[1.85]">
            {{ node.description }}
          </p>

          <!-- 标签 -->
          <div v-if="node.tags?.length" class="flex flex-wrap gap-1.5 pt-1">
            <Badge
              v-for="tag in node.tags"
              :key="tag"
              variant="outline"
              class="text-[11px] !py-0"
            >{{ tag }}</Badge>
          </div>
        </div>
      </li>
    </ol>
  </article>
</template>
