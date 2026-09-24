<script setup lang="ts">
/**
 * TimelinePage · 经历时间线（真实条目 + 节点类型染色 + 滚动揭示动画）。
 *
 * 数据流：
 *   1. onMounted → fetchTimeline()（公开接口 GET /api/timeline）
 *   2. 请求失败 → 回退到静态 mock（src/data/timeline.ts），页面不至于空白
 *   3. 接口成功但为空 → 显示空态（不回退 mock，避免「删掉的经历又冒出来」）
 *   4. 数据就绪后调用 scrollReveal.refresh()，让后插入的节点也能播放进入动画
 *
 * 登录后右上角出现「管理经历」入口（游客不可见）。
 */
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  Badge,
  Separator
} from '@/components/ui'
import { timelineNodes, nodeKindMeta } from '@/data'
import { fetchTimeline } from '@/api/timeline'
import { History, Briefcase, GraduationCap, Rocket, GitPullRequestArrow, Pencil } from 'lucide-vue-next'
import type { Component } from 'vue'
import type { TimelineNodeKind } from '@/data'
import { useAuthStore } from '@/stores/auth'
import { useScrollReveal } from '@/composables/useScrollReveal'

defineOptions({ name: 'TimelinePage' })

const router = useRouter()
const authStore = useAuthStore()

/** 渲染用节点（接口数据与 mock 数据统一成这个形状） */
type RenderNode = {
  id: string | number
  kind: TimelineNodeKind
  title: string
  subTitle?: string
  startedAt: string
  endedAt?: string
  ongoing?: boolean
  description: string
  tags?: string[]
}

/** 每个节点 kind 对应的 icon 展示 */
const kindIcon: Record<TimelineNodeKind, Component> = {
  work: Briefcase,
  education: GraduationCap,
  'open-source': GitPullRequestArrow,
  milestone: Rocket
}

const rootRef = ref<HTMLElement | null>(null)
const { refresh } = useScrollReveal(rootRef)

/** 经历节点（接口优先，失败回退 mock） */
const nodes = ref<RenderNode[]>([])
const loading = ref(true)

onMounted(async () => {
  try {
    const rows = await fetchTimeline()
    nodes.value = rows.map((n) => ({
      id: n.id,
      kind: n.kind,
      title: n.title,
      subTitle: n.subTitle,
      startedAt: n.startedAt,
      endedAt: n.endedAt,
      ongoing: n.ongoing,
      description: n.description,
      tags: n.tags,
    }))
  } catch {
    // 接口不可用（后端未启动等）→ 回退静态 mock，页面照常可读
    nodes.value = timelineNodes as RenderNode[]
  } finally {
    loading.value = false
    // DOM 变了，重新扫描 [data-reveal] 并刷新 ScrollTrigger 位置缓存
    refresh()
  }
})
</script>

<template>
  <article ref="rootRef" class="space-y-10 max-w-4xl mx-auto">
    <!-- 头部 -->
    <header class="space-y-3" data-reveal>
      <p class="m-0 text-xs font-mono text-brand uppercase tracking-wider">/ timeline</p>
      <div class="flex flex-wrap items-center justify-between gap-4">
        <h1 class="m-0 text-3xl md:text-4xl font-bold tracking-tight flex items-center gap-2">
          <History class="size-7 text-brand" />
          经历时间线
        </h1>
        <button
          v-if="authStore.isLoggedIn"
          type="button"
          class="btn-spec-b btn-spec-b--outline"
          @click="router.push('/admin/timeline')"
        >
          <Pencil class="btn-spec-b__icon" />
          <span>管理经历</span>
        </button>
      </div>
      <p class="m-0 text-base md:text-lg text-text-muted leading-relaxed max-w-2xl">
        按时间顺序整理的一些关键节点：工作、教育、开源、里程碑。每条都尽量写了「我扮演什么角色」以及「具体产出」。
      </p>
    </header>

    <Separator />

    <!-- 加载中 -->
    <div
      v-if="loading"
      class="rounded-lg border border-dashed border-border/70 bg-surface-muted/20 py-16 flex flex-col items-center justify-center gap-3 text-center"
      data-reveal="0.1"
    >
      <p class="m-0 text-text-muted text-sm">正在加载经历…</p>
    </div>

    <!-- 空态（接口成功但无数据） -->
    <div
      v-else-if="!nodes.length"
      class="rounded-lg border border-dashed border-border/70 bg-surface-muted/20 py-16 flex flex-col items-center justify-center gap-3 text-center"
      data-reveal="0.1"
    >
      <p class="m-0 text-text-muted text-sm">还没有记录任何经历节点。</p>
      <button
        v-if="authStore.isLoggedIn"
        type="button"
        class="btn-spec-b btn-spec-b--outline"
        @click="router.push('/admin/timeline/new')"
      >
        <Pencil class="btn-spec-b__icon" />
        <span>去添加第一条</span>
      </button>
    </div>

    <!-- 时间线主体 -->
    <ol v-else class="relative m-0 p-0 pl-7 md:pl-10 border-l border-border/70 list-none space-y-10">
      <li
        v-for="(node, index) in nodes"
        :key="node.id"
        class="relative"
        :data-reveal="String(0.06 * index)"
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
          <p class="m-0 text-sm md:text-[15px] text-text leading-[1.85] whitespace-pre-line">
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
