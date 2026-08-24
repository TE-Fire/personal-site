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
 *
 * 数据：
 *   · 内置基于确定性种子的 Mock 生成器，模拟真实贡献分布
 *   · 可通过 props.data 传入真实数据（如 GitHub API 拉取）
 */
import { computed, ref } from 'vue'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui'
import { Activity, Flame, Calendar, TrendingUp } from 'lucide-vue-next'

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
  data?: HeatmapData | null
}

const props = withDefaults(defineProps<Props>(), {
  data: null
})

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

const data = computed<HeatmapData>(() => {
  return props.data ?? generateMockData()
})

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
    <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-3">
      <div class="flex items-center gap-2">
        <CardTitle class="flex items-center gap-2 text-lg">
          <Activity class="size-5 text-brand" />
          贡献热力图
        </CardTitle>
      </div>
      <div class="flex items-center gap-1.5 text-xs text-text-muted">
        <span>{{ yearStartLabel }}</span>
        <span aria-hidden>→</span>
        <span>{{ yearEndLabel }}</span>
      </div>
    </CardHeader>

    <CardContent class="space-y-4">
      <!-- 统计摘要 -->
      <div class="grid grid-cols-3 gap-3">
        <div class="rounded-lg border border-border/50 bg-surface-muted/30 p-3 space-y-0.5">
          <div class="flex items-center gap-1.5 text-xs text-text-muted">
            <Calendar class="size-3.5" />
            总贡献
          </div>
          <div class="text-xl font-bold tabular-nums text-brand">{{ data.total.toLocaleString() }}</div>
        </div>
        <div class="rounded-lg border border-border/50 bg-surface-muted/30 p-3 space-y-0.5">
          <div class="flex items-center gap-1.5 text-xs text-text-muted">
            <Flame class="size-3.5" />
            当前连续
          </div>
          <div class="text-xl font-bold tabular-nums text-accent">{{ data.currentStreak }}</div>
        </div>
        <div class="rounded-lg border border-border/50 bg-surface-muted/30 p-3 space-y-0.5">
          <div class="flex items-center gap-1.5 text-xs text-text-muted">
            <TrendingUp class="size-3.5" />
            最长连续
          </div>
          <div class="text-xl font-bold tabular-nums text-text">{{ data.longestStreak }}</div>
        </div>
      </div>

      <!-- 热力图主体 -->
      <div class="heatmap-wrapper">
        <!-- 月份标签 -->
        <div class="heatmap-month-labels">
          <div
            v-for="ml in monthLabels"
            :key="ml.weekIdx"
            class="heatmap-month-label"
            :style="{ left: `${ml.weekIdx * (14 + 3)}px` }"
          >{{ ml.label }}</div>
        </div>

        <div class="heatmap-scroll">
          <div class="heatmap-inner">
            <!-- 星期标签列 -->
            <div class="heatmap-day-col" aria-hidden="true">
              <span v-for="(label, idx) in WEEK_LABELS" :key="idx" class="heatmap-day-label" :style="{ top: `${idx * (14 + 3) + 8}px` }">{{ label }}</span>
            </div>

            <!-- 网格 -->
            <div class="heatmap-grid">
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

        <!-- tooltip（fixed 定位，避免被 overflow 裁剪） -->
        <Teleport to="body">
          <div
            v-if="hoveredCell"
            class="heatmap-tooltip"
            :style="tooltipStyle"
          >
            <span class="heatmap-tooltip-count">{{ hoveredCell.count }} 次</span>
            <span class="heatmap-tooltip-divider" />
            <span class="heatmap-tooltip-date">{{ formatDate(hoveredCell.date) }}</span>
          </div>
        </Teleport>
      </div>

      <!-- 图例 -->
      <div class="flex items-center justify-between text-xs text-text-muted">
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
