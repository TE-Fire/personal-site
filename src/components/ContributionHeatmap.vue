<script setup lang="ts">
/**
 * ContributionHeatmap · GitHub 风格贡献热力图
 *
 * 功能：
 *   · 7 行（周一~周日）× 53 列（周）的年度贡献视图
 *   · 5 档紫色色阶（--heatmap-0~4，深浅色自适应）
 *   · 悬浮 tooltip 显示日期 + 贡献数
 *   · 统计摘要：总贡献 / 最佳日 / 连续活跃天数（当前 + 最长）
 *   · 月份标签 + 星期标签 + 图例
 *   · 响应式：移动端横向滚动
 *   · prefers-reduced-motion 友好
 *   · Loading 骨架屏（cells.len + stats 区）
 *   · total=0 空态提示 + error 提示 banner（由父组件根据后端 meta.fallback 传入）
 *   · 方案 D：支持 3 个 Tab 切换（SITE / GITHUB / MERGED）；当 enableGithub=false 时 GitHub 相关 Tab 禁用
 *   · 右上角 GitHub 主页外链图标（当传入 githubLink 时显示）
 *
 * 数据：
 *   · 内置基于确定性种子的 Mock 生成器，data=null 时启用（用于后端接口失败 / 开发期未接入兜底）
 *   · 可通过 props.data 传入真实数据（后端 ContributionRsp：cells / total / bestDay 等）
 */
import { computed, ref } from 'vue'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui'
import { Activity, Flame, Calendar, TrendingUp, AlertTriangle, Sparkles } from 'lucide-vue-next'
import type { HeatmapSource } from '@/lib/api-types'

/* ---------- 类型 ---------- */

interface DayCell {
  date: string        // YYYY-MM-DD
  count: number       // 贡献数
  level: 0 | 1 | 2 | 3 | 4
}

interface HeatmapData {
  cells: DayCell[]
  total: number
  bestDay: { date: string; count: number }
  currentStreak: number
  longestStreak: number
}

interface Props {
  /** 真实数据（后端 ContributionRsp，null=用内置 Mock；undefined=尚未加载 → 走 loading prop 决定） */
  data?: HeatmapData | null
  /** 是否显示骨架屏（真实数据请求期间） */
  loading?: boolean
  /** total=0 且后端返回 meta.fallback=true 时建议显示的「空态文案」 */
  emptyHint?: string | null
  /** 真实数据请求失败文案（非空时顶部显示 error banner）—— 仍然显示 Mock 数据不让用户白屏 */
  errorMsg?: string | null
  /** 当前 Tab（方案 D：SITE / GITHUB / MERGED） */
  source?: HeatmapSource
  /** 是否允许 GitHub / MERGED Tab（由 aboutStore.safeAbout.heatmapEnableGithub 决定） */
  enableGithub?: boolean
  /** GitHub 主页外链（右上角图标按钮）；空字符串=不显示 */
  githubLink?: string
}

const props = withDefaults(defineProps<Props>(), {
  data: undefined,
  loading: false,
  emptyHint: null,
  errorMsg: null,
  source: 'SITE',
  enableGithub: false,
  githubLink: '',
})

const emit = defineEmits<{
  /** Tab 切换事件，父组件收到后 aboutStore.fetchHeatmap(newSource) */
  (e: 'update:source', next: HeatmapSource): void
}>()

type TabItem = { value: HeatmapSource; label: string; desc: string }
const TABS: TabItem[] = [
  { value: 'SITE',   label: '本站',   desc: '博客 / 生活 / 笔记' },
  { value: 'GITHUB', label: 'GitHub', desc: 'GitHub 公开贡献日历' },
  { value: 'MERGED', label: '合并',   desc: '本站 + GitHub 合并视图' },
]

const isTabDisabled = (tab: HeatmapSource): boolean => {
  // SITE 始终启用；GITHUB / MERGED 需要 enableGithub=true
  if (tab === 'SITE') return false
  return !props.enableGithub
}

function onTabClick(next: HeatmapSource) {
  if (isTabDisabled(next)) return
  if (next === props.source) return
  emit('update:source', next)
}

/* ---------- 确定性 Mock 数据生成 ---------- */

/** 简易伪随机（mulberry32），同一 seed 产生相同序列 */
function makeRng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6D2B79F5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** 生成最近 53 周的贡献数据 */
function generateMockData(seed = 20260824): HeatmapData {
  const rng = makeRng(seed)
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // 找到最近的周一作为起点（对齐 GitHub 的周视图）
  const endDate = new Date(today)
  // 从今天回溯，找到 53 周前的那个周一
  const startDate = new Date(endDate)
  startDate.setDate(startDate.getDate() - (53 * 7 - 1))
  // 对齐到周一
  const dayOfWeek = startDate.getDay() // 0=Sun
  const offsetToMon = dayOfWeek === 0 ? 6 : dayOfWeek - 1
  startDate.setDate(startDate.getDate() - offsetToMon)

  const cells: DayCell[] = []
  let total = 0
  let bestDay = { date: '', count: 0 }

  // 按天生成，共 53*7 = 371 天
  for (let i = 0; i < 53 * 7; i++) {
    const d = new Date(startDate)
    d.setDate(d.getDate() + i)

    // 只统计到今天
    if (d > endDate) break

    const dow = d.getDay() // 0=Sun, 1=Mon, ..., 6=Sat

    // 基础概率模型：
    //   工作日贡献概率更高，周末稍低
    //   近期贡献概率更高（时间衰减）
    //   随机爆发（streak）
    const weeksFromEnd = (endDate.getTime() - d.getTime()) / (7 * 24 * 3600 * 1000)
    const recencyBoost = Math.max(0.4, 1 - weeksFromEnd / 80)

    // 基础概率
    let prob = 0.35
    if (dow >= 1 && dow <= 5) prob = 0.55 // 工作日
    if (dow === 0 || dow === 6) prob = 0.25 // 周末
    prob *= recencyBoost

    // 30% 概率产生爆发（连续多天高贡献）
    const burst = rng() < 0.12
    let count = 0

    if (rng() < prob) {
      if (burst) {
        count = Math.floor(rng() * 12) + 5 // 5-16 次
      } else {
        count = Math.floor(rng() * 6) + 1 // 1-6 次
      }
    }

    // 偶尔跳过
    if (rng() < 0.08) count = 0

    if (count > 18) count = 18

    const level: 0 | 1 | 2 | 3 | 4 =
      count === 0 ? 0 :
      count <= 3 ? 1 :
      count <= 7 ? 2 :
      count <= 12 ? 3 : 4

    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    cells.push({ date: dateStr, count, level })
    total += count
    if (count > bestDay.count) bestDay = { date: dateStr, count }
  }

  // 计算连续活跃天数（从今天往回数）
  let currentStreak = 0
  for (let i = cells.length - 1; i >= 0; i--) {
    if (cells[i].count > 0) currentStreak++
    else break
  }

  // 计算最长连续活跃天数
  let longestStreak = 0
  let tmp = 0
  for (const c of cells) {
    if (c.count > 0) {
      tmp++
      if (tmp > longestStreak) longestStreak = tmp
    } else {
      tmp = 0
    }
  }

  return { cells, total, bestDay, currentStreak, longestStreak }
}

/* ---------- 数据来源 ---------- */

/**
 * 实际渲染的数据（HeatmapData | null）：
 *   · loading=true 时，无论真实 data 是什么都用 「SKELETON_PLACEHOLDER」—— 由模板层渲染骨架屏
 *   · 真实 data 是合法对象（cells 数组）→ 渲染真实数据（哪怕 total=0 也要渲染，空态 banner 另外显示）
 *   · 真实 data=null（父组件明确告知「失败兜底」）→ 用内置 Mock，同时若 errorMsg 有值 → error banner
 *   · 真实 data=undefined（父组件没传 / 初次加载）→ 退化为 Mock（兼容性兜底，避免父组件忘了传报错）
 */
const SKELETON_PLACEHOLDER: HeatmapData = {
  cells: [],
  total: 0,
  bestDay: { date: '', count: 0 },
  currentStreak: 0,
  longestStreak: 0,
}

const showSkeleton = computed(() => Boolean(props.loading))

const data = computed<HeatmapData>(() => {
  if (showSkeleton.value) return SKELETON_PLACEHOLDER
  if (props.data && Array.isArray(props.data.cells)) return props.data
  // data=null 或 undefined → 兜底 Mock（error banner 另外渲染）
  return generateMockData()
})

/** 是否展示空态提示（真实数据 total=0 + 非 loading + 有 hint） */
const showEmptyHint = computed(() => {
  if (showSkeleton.value) return false
  if (!props.data || !Array.isArray(props.data.cells)) return false
  return props.data.total === 0 && Boolean(props.emptyHint)
})

/** 是否展示 error banner（errorMsg 非空） */
const showErrorBanner = computed(() => Boolean(props.errorMsg))

/* ---------- 布局计算 ---------- */

const DAYS_PER_WEEK = 7
const WEEK_LABELS = ['一', '三', '五', '日']
const MONTH_NAMES = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月']

/** 按周分组的 cells，用于渲染网格 */
const weeks = computed<DayCell[][]>(() => {
  const result: DayCell[][] = []
  for (let i = 0; i < data.value.cells.length; i += DAYS_PER_WEEK) {
    result.push(data.value.cells.slice(i, i + DAYS_PER_WEEK))
  }
  return result
})

/** 月份标签：每列（周）对应的月份索引 */
const monthLabels = computed<{ weekIdx: number; label: string }[]>(() => {
  const labels: { weekIdx: number; label: string }[] = []
  let lastMonth = -1
  weeks.value.forEach((week, idx) => {
    if (week.length === 0) return
    const firstDay = week[0]
    const month = parseInt(firstDay.date.slice(5, 7), 10) - 1
    if (month !== lastMonth) {
      labels.push({ weekIdx: idx, label: MONTH_NAMES[month] })
      lastMonth = month
    }
  })
  return labels
})

/* ---------- Tooltip ---------- */

const hoveredCell = ref<DayCell | null>(null)
const tooltipStyle = ref<Record<string, string>>({})

function onCellMouseEnter(cell: DayCell, ev: MouseEvent) {
  hoveredCell.value = cell
  const el = ev.target as HTMLElement
  const rect = el.getBoundingClientRect()
  // 接近屏幕顶部时自动翻转 tooltip 方向
  const flipY = rect.top < 80
  const top = flipY ? rect.bottom + 12 : rect.top - 12
  tooltipStyle.value = {
    position: 'fixed',
    left: `${rect.left + rect.width / 2}px`,
    top: `${top}px`,
    transform: flipY ? 'translate(-50%, 0)' : 'translate(-50%, -100%)',
    zIndex: '9999'
  }
}

function onCellMouseLeave() {
  hoveredCell.value = null
}

/* ---------- 年起始月 ---------- */

const yearStartLabel = computed(() => {
  const cells = data.value.cells
  if (cells.length === 0) return ''
  return `${cells[0].date.slice(0, 4)}年${MONTH_NAMES[parseInt(cells[0].date.slice(5, 7), 10) - 1]}`
})

const yearEndLabel = computed(() => {
  const cells = data.value.cells
  if (cells.length === 0) return ''
  return `${cells[cells.length - 1].date.slice(0, 4)}年${MONTH_NAMES[parseInt(cells[cells.length - 1].date.slice(5, 7), 10) - 1]}`
})

/* ---------- 格式化 ---------- */

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  const month = d.getMonth() + 1
  const day = d.getDate()
  const weekDayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  return `${d.getFullYear()}年${month}月${day}日 ${weekDayNames[d.getDay()]}`
}

function levelClass(level: number): string {
  return `hm-l${level}`
}
</script>

<template>
  <Card class="heatmap-card" data-reveal>
    <CardHeader class="flex flex-col items-start gap-3 space-y-0 pb-3">
      <!-- 顶部行：标题 + 年份区间 + GitHub 外链 -->
      <div class="w-full flex flex-row items-center justify-between gap-3 flex-wrap">
        <div class="flex items-center gap-2 min-w-0">
          <CardTitle class="flex items-center gap-2 text-lg">
            <Activity class="size-5 text-brand shrink-0" />
            <span class="truncate">贡献热力图</span>
          </CardTitle>
        </div>
        <div class="flex items-center gap-2 shrink-0">
          <div class="flex items-center gap-1.5 text-xs text-text-muted">
            <span>{{ yearStartLabel }}</span>
            <span aria-hidden>→</span>
            <span>{{ yearEndLabel }}</span>
          </div>
          <a
            v-if="githubLink"
            :href="githubLink"
            target="_blank"
            rel="noopener noreferrer"
            class="size-9 inline-flex items-center justify-center rounded-lg text-text-muted hover:text-brand hover:bg-brand/10 transition"
            title="在 GitHub 查看主页"
            aria-label="GitHub 主页"
          >
            <Github class="size-6" />
          </a>
        </div>
      </div>

      <!-- Tab 切换（SITE / GITHUB / MERGED） -->
      <div class="w-full heatmap-tabs" role="tablist" aria-label="贡献数据来源">
        <button
          v-for="tab in TABS"
          :key="tab.value"
          type="button"
          role="tab"
          :aria-selected="source === tab.value"
          :disabled="isTabDisabled(tab.value)"
          :title="isTabDisabled(tab.value) ? '博主未启用 GitHub 贡献，请在个人设置中开启' : tab.desc"
          class="heatmap-tab"
          :class="{
            'heatmap-tab-active': source === tab.value,
            'heatmap-tab-disabled': isTabDisabled(tab.value),
          }"
          @click="onTabClick(tab.value)"
        >
          <span class="heatmap-tab-label">{{ tab.label }}</span>
          <span class="heatmap-tab-desc">{{ tab.desc }}</span>
        </button>
      </div>
    </CardHeader>

    <CardContent class="space-y-4">
      <!-- [error banner] 真实数据请求失败，但下方仍显示 Mock，用户仍有视觉内容 -->
      <div
        v-if="showErrorBanner"
        class="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning flex items-start gap-2"
      >
        <AlertTriangle class="size-4 shrink-0 mt-0.5" />
        <span class="leading-relaxed">{{ errorMsg }}（下图为示例数据，用于演示界面效果）</span>
      </div>

      <!-- [空态提示 banner] 真实数据 total=0 且有 emptyHint -->
      <div
        v-if="showEmptyHint"
        class="rounded-lg border border-brand/30 bg-brand/[0.07] px-3 py-2 text-xs text-brand-foreground/90 flex items-start gap-2"
      >
        <Sparkles class="size-4 shrink-0 mt-0.5" />
        <span class="leading-relaxed">{{ emptyHint }}</span>
      </div>

      <!-- 统计摘要（loading → 骨架；否则正常渲染） -->
      <div class="grid grid-cols-3 gap-3">
        <!-- 总贡献 -->
        <div class="rounded-lg border border-border/50 bg-surface-muted/30 p-3 space-y-0.5">
          <div class="flex items-center gap-1.5 text-xs text-text-muted">
            <Calendar class="size-3.5" />
            总贡献
          </div>
          <div v-if="showSkeleton" class="h-7 w-24 rounded bg-surface-muted/70 animate-pulse" />
          <div v-else class="text-xl font-bold tabular-nums text-brand">{{ data.total.toLocaleString() }}</div>
        </div>
        <!-- 当前连续 -->
        <div class="rounded-lg border border-border/50 bg-surface-muted/30 p-3 space-y-0.5">
          <div class="flex items-center gap-1.5 text-xs text-text-muted">
            <Flame class="size-3.5" />
            当前连续
          </div>
          <div v-if="showSkeleton" class="h-7 w-16 rounded bg-surface-muted/70 animate-pulse" />
          <div v-else class="text-xl font-bold tabular-nums text-accent">{{ data.currentStreak }}</div>
        </div>
        <!-- 最长连续 -->
        <div class="rounded-lg border border-border/50 bg-surface-muted/30 p-3 space-y-0.5">
          <div class="flex items-center gap-1.5 text-xs text-text-muted">
            <TrendingUp class="size-3.5" />
            最长连续
          </div>
          <div v-if="showSkeleton" class="h-7 w-16 rounded bg-surface-muted/70 animate-pulse" />
          <div v-else class="text-xl font-bold tabular-nums text-text">{{ data.longestStreak }}</div>
        </div>
      </div>

      <!-- 热力图主体 -->
      <div class="heatmap-wrapper">
        <!-- 月份标签（非 skeleton 显示） -->
        <div v-if="!showSkeleton" class="heatmap-month-labels">
          <div
            v-for="ml in monthLabels"
            :key="ml.weekIdx"
            class="heatmap-month-label"
            :style="{ left: `${ml.weekIdx * (14 + 3)}px` }"
          >{{ ml.label }}</div>
        </div>
        <div v-else class="heatmap-month-labels h-4">&nbsp;</div>

        <div class="heatmap-scroll">
          <div class="heatmap-inner">
            <!-- 星期标签列 -->
            <div class="heatmap-day-col" aria-hidden="true">
              <span v-for="(label, idx) in WEEK_LABELS" :key="idx" class="heatmap-day-label" :style="{ top: `${idx * (14 + 3) + 8}px` }">{{ label }}</span>
            </div>

            <!-- 网格 · skeleton：画一串浅灰占位（53 周 × 7 天，空单元格 hm-l0 背景） -->
            <div v-if="showSkeleton" class="heatmap-grid">
              <template v-for="colIdx in 53" :key="`sk-col-${colIdx}`">
                <div class="heatmap-col">
                  <div v-for="r in 7" :key="`sk-cell-${colIdx}-${r}`" class="heatmap-cell hm-l0 opacity-70 animate-pulse" />
                </div>
              </template>
            </div>

            <!-- 网格 · 真实 / Mock 数据 -->
            <div v-else class="heatmap-grid">
              <!-- 按列渲染（每列 = 一周） -->
              <div v-for="(week, colIdx) in weeks" :key="colIdx" class="heatmap-col">
                <div
                  v-for="cell in week"
                  :key="cell.date"
                  :data-date="cell.date"
                  :data-count="cell.count"
                  :class="['heatmap-cell', levelClass(cell.level)]"
                  @mouseenter="(ev: MouseEvent) => onCellMouseEnter(cell, ev)"
                  @mouseleave="onCellMouseLeave"
                  :title="`${formatDate(cell.date)} · ${cell.count} 次贡献`"
                />
                <!-- 补空格子（短周） -->
                <div
                  v-for="n in DAYS_PER_WEEK - week.length"
                  :key="`empty-${n}`"
                  class="heatmap-cell heatmap-cell-empty"
                />
              </div>
            </div>
          </div>
        </div>

        <!-- tooltip（fixed 定位，避免被 overflow 裁剪；skeleton 不需要） -->
        <Teleport to="body">
          <div
            v-if="!showSkeleton && hoveredCell"
            class="heatmap-tooltip"
            :style="tooltipStyle"
          >
            <span class="heatmap-tooltip-count">{{ hoveredCell.count }} 次</span>
            <span class="heatmap-tooltip-divider" />
            <span class="heatmap-tooltip-date">{{ formatDate(hoveredCell.date) }}</span>
          </div>
        </Teleport>
      </div>

      <!-- 图例（非 skeleton 才显示；skeleton 显示一条短 Skeleton 条） -->
      <div v-if="!showSkeleton" class="flex items-center justify-between text-xs text-text-muted">
        <span>少</span>
        <div class="flex items-center gap-1">
          <span
            v-for="lv in 4"
            :key="lv"
            :class="['heatmap-legend-cell', `hm-l${lv}`]"
            :style="{ width: '10px', height: '10px', borderRadius: '2px' }"
          />
          <span
            :class="['heatmap-legend-cell', 'hm-l4']"
            :style="{ width: '10px', height: '10px', borderRadius: '2px' }"
          />
        </div>
        <span>多</span>
      </div>
      <div v-else class="flex items-center justify-between text-xs text-text-muted">
        <div class="h-3 w-4 rounded bg-surface-muted/70 animate-pulse" />
        <div class="h-3 w-24 rounded bg-surface-muted/70 animate-pulse" />
        <div class="h-3 w-4 rounded bg-surface-muted/70 animate-pulse" />
      </div>
    </CardContent>
  </Card>
</template>

<style scoped>
/* ---------- 热力图核心样式 ---------- */

.heatmap-card {
  overflow: visible;
}

/* 统计区 */
.heatmap-card .text-brand {
  color: var(--brand);
}

/* 外层滚动容器（移动端横向滚动） */
.heatmap-wrapper {
  position: relative;
  margin: 0 -4px;
  padding: 0 4px;
}

.heatmap-scroll {
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: thin;
}

.heatmap-scroll::-webkit-scrollbar {
  height: 6px;
}

.heatmap-scroll::-webkit-scrollbar-thumb {
  background: var(--border-strong);
  border-radius: 3px;
}

.heatmap-scroll::-webkit-scrollbar-track {
  background: transparent;
}

/* 内部容器（留出星期标签空间） */
.heatmap-inner {
  display: flex;
  gap: 0;
  padding-left: 28px;
  position: relative;
  min-width: max-content;
}

/* 星期标签列 */
.heatmap-day-col {
  position: absolute;
  left: 0;
  top: 0;
  width: 20px;
  height: calc(7 * (14px + 3px));
}

.heatmap-day-label {
  position: absolute;
  font-size: 10px;
  color: var(--text-muted);
  line-height: 1;
  white-space: nowrap;
}

/* 月份标签 */
.heatmap-month-labels {
  position: relative;
  height: 14px;
  margin-left: 28px;
  margin-bottom: 4px;
  min-width: max-content;
}

.heatmap-month-label {
  position: absolute;
  font-size: 10px;
  color: var(--text-muted);
  line-height: 1;
  white-space: nowrap;
  transform: translateX(-50%);
}

/* 网格 */
.heatmap-grid {
  position: relative;
  display: flex;
  gap: 3px;
  min-width: max-content;
}

.heatmap-col {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

/* 单元格 */
.heatmap-cell {
  width: 14px;
  height: 14px;
  border-radius: 3px;
  transition: transform 120ms ease, box-shadow 120ms ease;
  cursor: pointer;
}

.heatmap-cell:hover {
  transform: scale(1.4);
  z-index: 10;
  box-shadow: 0 0 0 2px var(--surface-elevated), 0 0 0 3px var(--brand);
}

.heatmap-cell-empty {
  background: transparent !important;
  cursor: default;
  pointer-events: none;
}

/* 5 档色阶 */
.hm-l0 { background-color: var(--heatmap-0); }
.hm-l1 { background-color: var(--heatmap-1); }
.hm-l2 { background-color: var(--heatmap-2); }
.hm-l3 { background-color: var(--heatmap-3); }
.hm-l4 { background-color: var(--heatmap-4); }

/* tooltip */
.heatmap-tooltip {
  z-index: 9999;
  pointer-events: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 6px 10px;
  background: var(--surface-elevated);
  border: 1px solid var(--border-strong);
  border-radius: 6px;
  box-shadow: 0 8px 24px -8px rgba(0, 0, 0, 0.25);
  white-space: nowrap;
  animation: tooltip-fade 120ms ease-out;
}

.heatmap-tooltip-count {
  font-size: 12px;
  font-weight: 600;
  color: var(--brand);
}

.heatmap-tooltip-divider {
  display: block;
  width: 1px;
  height: 2px;
  background: var(--border);
}

.heatmap-tooltip-date {
  font-size: 11px;
  color: var(--text-muted);
}

@keyframes tooltip-fade {
  from { opacity: 0; }
  to { opacity: 1; }
}

/* 图例 */
.heatmap-legend-cell {
  display: inline-block;
  border-radius: 2px;
}

/* ---------- Tab 切换（segmented tabs）样式 ---------- */

.heatmap-tabs {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 4px;
  padding: 4px;
  border: 1px solid var(--border);
  background: var(--surface-muted);
  border-radius: 10px;
}

.heatmap-tab {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  padding: 8px 6px;
  border: none;
  border-radius: 8px;
  background: transparent;
  cursor: pointer;
  line-height: 1.2;
  text-align: center;
  transition: background 160ms ease, color 160ms ease, transform 120ms ease;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
  outline: none;
}

.heatmap-tab:focus-visible {
  box-shadow: 0 0 0 2px var(--surface-elevated), 0 0 0 4px var(--brand);
  z-index: 1;
}

.heatmap-tab:not(.heatmap-tab-disabled):hover {
  background: var(--surface-elevated);
}

.heatmap-tab:not(.heatmap-tab-disabled):active {
  transform: translateY(1px);
}

.heatmap-tab-active {
  background: var(--surface-elevated);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06), 0 0 0 1px var(--border-strong);
}

.heatmap-tab-active .heatmap-tab-label {
  color: var(--brand);
  font-weight: 600;
}

.heatmap-tab-label {
  font-size: 12.5px;
  font-weight: 500;
  color: var(--text);
  white-space: nowrap;
}

.heatmap-tab-desc {
  font-size: 10px;
  color: var(--text-muted);
  white-space: nowrap;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
}

.heatmap-tab-active .heatmap-tab-desc {
  color: var(--text-muted);
  opacity: 1;
}

.heatmap-tab-disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.heatmap-tab-disabled:hover {
  background: transparent !important;
}

/* 小屏幕（<480px）：Tab 说明文字隐藏，只保留主标签，省空间 */
@media (max-width: 479px) {
  .heatmap-tab-desc {
    display: none;
  }
  .heatmap-tab {
    padding: 10px 6px;
  }
}

/* 减少动效 */
@media (prefers-reduced-motion: reduce) {
  .heatmap-cell {
    transition: none;
  }
  .heatmap-cell:hover {
    transform: none;
  }
  .heatmap-tooltip {
    animation: none;
  }
}
</style>
