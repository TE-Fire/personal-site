<script setup lang="ts">
/**
 * DraggableStatsWidget · 可拖动的博客数据悬浮面板（数据卡）
 *
 * 数据来源（About 展示相关）：
 *   · 作者名 / 位置 / 可接单状态 → aboutStore.safeAbout
 *   · 博客数据（文章数/字数/分类/标签）→ useBlogApi（本地 localStorage + 内置）
 *
 * 状态机（三档）：
 *   ① BALL      — 44×44 圆形悬浮球：默认首次进入 / 闲置 6s 自动收球 / 手动折叠 / 点球展开
 *   ② EXPANDED  — 256×380 完整卡片：点击球 / hover 球 500ms / 关闭后点击"恢复"按钮进入
 *   ③ CLOSED    — 只有 `top-[92px] left-5` 的"数据面板"小按钮（用户主动点 × 后）
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  BookOpen,
  FileEdit,
  Hash,
  BarChart3,
  Clock3,
  ListTree,
  LayoutPanelLeft
} from 'lucide-vue-next'
import { useRouter } from 'vue-router'
import { readingMinutes } from '@/data'
import { useAboutStore } from '@/stores/about'
import { useDraggable } from '@/composables/useDraggable'
import type { AttachedEdge } from '@/composables/useDraggable'
import { useIdleTimer } from '@/composables/useIdleTimer'
import { useBlogApi } from '@/composables/useBlogApi'
import { Badge } from '@/components/ui'

const router = useRouter()
const { allPosts } = useBlogApi()
const posts = computed(() => allPosts.value)

/* -------- About 展示信息：onMounted 拉一次，失败用 aboutStore 兜底 -------- */
const aboutStore = useAboutStore()
onMounted(async () => {
  try {
    await aboutStore.fetchAbout()
  } catch {
    // aboutStore 内部已兜底
  }
})

/** 作者首字母（球态 + 展开卡头像用） */
const authorInitial = computed(() =>
  (aboutStore.displayName || 'T').charAt(0).toUpperCase(),
)
/** 作者显示名 */
const authorName = computed(() => aboutStore.displayName || 'Trae')
/** 位置（展开卡副标题显示） */
const authorLocation = computed(() => aboutStore.safeAbout.location || '')
/** 可接单状态（控制右上角小圆点） */
const authorAvailable = computed(() => Boolean(aboutStore.safeAbout.available))

// ---------- 尺寸与折叠态 ----------
const COLS = {
  BALL: 44,
  CARD: 256
}
const ROWS = {
  BALL: 44,
  CARD: 372
}

// 默认"球"态：用户不主动点击也绝不会遮盖主体
const collapsed = ref(true)

const currentWidth = computed(() => (collapsed.value ? COLS.BALL : COLS.CARD))
const currentHeight = computed(() => (collapsed.value ? ROWS.BALL : ROWS.CARD))

// ---------- 交互守卫：hover 到卡片 / 聚焦卡片任意元素时，不自动收球 ----------
const isHovering = ref(false)
const isFocusWithin = ref(false)

// ---------- Draggable（磁吸水平 + 顶部偏移避开导航栏） ----------
const {
  visible,
  isDragging,
  isSnapping,
  attachedEdge,
  currentX,
  currentY,
  onPointerDown,
  close,
  reopen,
  reattach
} = useDraggable({
  storageKey: 'stats-widget:state',
  width: () => currentWidth.value,
  height: () => currentHeight.value,
  defaultAnchor: 'top-left',
  defaultInitialOffsetY: 96,
  edgePadding: 14,
  dragThreshold: 5,
  magneticEdges: 'horizontal',
  snapDuration: 340
})

// ---------- 闲置自动收球（BALL ← EXPANDED） ----------
const { isIdle, setPaused: setIdlePaused, touchActivity } = useIdleTimer({
  timeout: 6000,
  interactionGuards: [isHovering, isFocusWithin],
  onIdle: () => {
    // 只有展开态才收为球；已关闭/球态不动
    if (!collapsed.value && !isDragging.value && !isSnapping.value) {
      collapseToBall()
    }
  }
})
// 引用防止被 tree-shake（实际是为了让外层主动 touchActivity 备用）
void isIdle

// ---------- 切换折叠 / 展开 ----------
// 展开过程尺寸发生变化，结束后需要重吸附一次（否则贴边位置不对）
function expandFromBall(_reason: 'tap' | 'hover' | 'reopen') {
  if (!collapsed.value) return
  setIdlePaused(true) // 切换动效期间不触发 idle
  collapsed.value = false
  touchActivity()
  nextTick(() => {
    reattach(() => {
      setIdlePaused(false)
    })
  })
}
function collapseToBall() {
  if (collapsed.value) return
  setIdlePaused(true)
  collapsed.value = true
  // 从 256 → 44：宽高变小后，需要再磁吸到最近边缘（纵向 clamp 不变）
  nextTick(() => {
    reattach(() => {
      setIdlePaused(false)
    })
  })
}
// 折叠态点击球（没拖动）→ 展开
function onBallTap() {
  expandFromBall('tap')
}

// ---------- 悬浮球 hover 500ms → 展开 ----------
let hoverExpandTimer: ReturnType<typeof setTimeout> | null = null
function onBallEnter() {
  if (!collapsed.value) return
  if (hoverExpandTimer) return
  hoverExpandTimer = setTimeout(() => {
    hoverExpandTimer = null
    expandFromBall('hover')
  }, 500)
}
function onBallLeave() {
  if (hoverExpandTimer) {
    clearTimeout(hoverExpandTimer)
    hoverExpandTimer = null
  }
}
onBeforeUnmount(() => {
  if (hoverExpandTimer) clearTimeout(hoverExpandTimer)
})

// ---------- 统计数据 ----------
const allTags = computed(() => {
  const set = new Set<string>()
  posts.value.forEach((p) => p.tags.forEach((t) => set.add(t)))
  return Array.from(set)
})
const categories = computed(() => Array.from(new Set(posts.value.map((p) => p.category))))
const totalWords = computed(() => posts.value.reduce((acc, p) => acc + p.wordCount, 0))
const totalReadingMinutes = computed(() => posts.value.reduce((acc, p) => acc + readingMinutes(p.wordCount), 0))

// ---------- 快捷操作 ----------
function goNewBlog() { touchActivity(); router.push('/blog/new') }
function goBlogList() { touchActivity(); router.push('/blog') }
function goRandomPost() {
  if (!posts.value.length) return
  const p = posts.value[Math.floor(Math.random() * posts.value.length)]
  touchActivity()
  router.push(`/blog/${p.slug}`)
}
function goTagManager() { touchActivity(); router.push('/blog/tags') }

// ---------- 贴边高光条控制 ----------
const glowSide = computed<AttachedEdge>(() => attachedEdge.value || null)

// ---------- 当用户手动点击关闭后，"恢复按钮"点了应直接打开并保持展开 ----------
function reopenAndExpand() {
  reopen()
  // reopen 之后 visible=true（默认 mounted 后是 collapsed=true=球态）这里直接展开
  nextTick(() => expandFromBall('reopen'))
}

// 把"恢复"和"展开"动作 expose 出去（以备将来 AppLayout 控制）
defineExpose({ reopen, reopenAndExpand, collapseToBall })

// 兼容旧状态：如果以前存在 visible = true & collapsed = false 的用户数据，
// 但现在我们希望默认是球态。只在首次挂载时，如果尺寸和位置不协调就重新吸一次。
watch(visible, (v) => {
  if (v) {
    nextTick(() => reattach())
  }
})
</script>

<template>
  <Teleport to="body">
    <!-- 关闭态：顶栏下方的小按钮（不盖住主体） -->
    <Transition name="char-fade">
      <button
        v-if="!visible"
        type="button"
        class="fixed z-[9998] top-[92px] left-5 inline-flex items-center gap-1.5 rounded-full bg-brand text-brand-on shadow-[0_8px_24px_rgba(139,92,246,0.35)] px-3.5 py-2 text-sm font-medium hover:bg-brand/90 active:scale-95 transition-all"
        @click="reopenAndExpand"
      >
        <LayoutPanelLeft class="size-4" />
        <span>数据面板</span>
      </button>
    </Transition>

    <!-- 主容器（球 或 展开卡） -->
    <Transition name="stats-expand" appear>
      <div
        v-if="visible"
        class="fixed z-[9998] select-none"
        :class="[
          {
            'cursor-grab': !isDragging,
            'cursor-grabbing': isDragging,
            'widget-dragging': isDragging,
            'widget-snapping': isSnapping
          }
        ]"
        :style="{
          left: `${currentX}px`,
          top: `${currentY}px`,
          touchAction: 'none'
        }"
        @pointerdown="onPointerDown"
      >
        <Transition name="stats-fade" mode="out-in">
          <!-- ⚪ 折叠球 -->
          <div
            v-if="collapsed"
            key="ball"
            class="group relative"
            @click.stop="onBallTap"
            @pointerenter="onBallEnter"
            @pointerleave="onBallLeave"
          >
            <div
              class="relative w-11 h-11 rounded-full bg-gradient-to-br from-brand via-accent to-brand text-white shadow-[0_10px_32px_-6px_rgba(139,92,246,0.55)] flex items-center justify-center font-bold ring-2 ring-brand/30 overflow-hidden"
            >
              <span class="text-[15px] tracking-tight">{{ authorInitial }}</span>
              <span
                v-if="authorAvailable"
                class="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-success border-2 border-surface-elevated"
              />
              <!-- 贴边高光球：被磁吸时增加一条贴边高光圈 -->
              <span
                v-if="glowSide === 'left'"
                class="absolute inset-y-0 left-0 w-[3px] rounded-l-full bg-gradient-to-b from-white/80 via-white/40 to-white/80 blur-[1px] mix-blend-screen"
              />
              <span
                v-if="glowSide === 'right'"
                class="absolute inset-y-0 right-0 w-[3px] rounded-r-full bg-gradient-to-b from-white/80 via-white/40 to-white/80 blur-[1px] mix-blend-screen"
              />
            </div>
            <!-- 球态 mini tooltip 帮助用户知道这是啥 -->
            <div
              class="pointer-events-none absolute top-1/2 -translate-y-1/2 left-full ml-3 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-medium bg-surface-elevated/95 backdrop-blur text-text-muted border border-border/60 opacity-0 group-hover:opacity-100 transition shadow"
            >
              点击 / 悬停打开数据卡
            </div>
          </div>

          <!-- 🎴 展开卡片（w=256，不挡主体） -->
          <div
            v-else
            key="expanded"
            class="relative rounded-2xl w-[256px] bg-surface-elevated/95 backdrop-blur-md border border-border/70 shadow-[0_22px_60px_-18px_rgba(0,0,0,0.45)] overflow-hidden"
            @pointerenter="isHovering = true; touchActivity()"
            @pointerleave="isHovering = false"
            @focusin.capture="isFocusWithin = true"
            @focusout.capture="isFocusWithin = false"
            @pointermove.stop="touchActivity()"
          >
            <!-- 🧲 磁吸贴边高光条（4px 亮紫色渐变条，left/right 贴边才显示） -->
            <span
              v-if="glowSide === 'left'"
              class="pointer-events-none absolute inset-y-0 left-0 w-[4px] bg-gradient-to-b from-brand via-accent to-brand opacity-90"
            />
            <span
              v-if="glowSide === 'right'"
              class="pointer-events-none absolute inset-y-0 right-0 w-[4px] bg-gradient-to-b from-brand via-accent to-brand opacity-90"
            />

            <!-- 顶部：可拖拽把手 + 作者信息 + 折叠按钮 -->
            <div
              class="px-3.5 py-2.5 flex items-center gap-2.5 cursor-grab active:cursor-grabbing bg-gradient-to-r from-brand/10 via-accent/5 to-brand/10 border-b border-border/60"
              @pointerdown.stop="onPointerDown"
            >
              <div class="relative shrink-0">
                <div
                  class="w-10 h-10 rounded-full bg-gradient-to-br from-brand via-accent to-brand text-white flex items-center justify-center text-[14px] font-bold shadow-inner ring-2 ring-brand/40"
                >
                  {{ authorInitial }}
                </div>
                <span
                  v-if="authorAvailable"
                  class="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-success border-2 border-surface-elevated"
                />
              </div>
              <div class="flex-1 min-w-0">
                <div class="font-semibold text-text leading-tight truncate text-[14px]">{{ authorName }}</div>
                <div class="text-[11px] text-text-muted leading-tight truncate">可接单 · {{ authorLocation }}</div>
              </div>
              <!-- 折叠按钮 -->
              <button
                type="button"
                class="shrink-0 size-7 rounded-lg flex items-center justify-center text-text-muted hover:text-text hover:bg-surface transition"
                @click.stop="collapseToBall"
                aria-label="折叠为悬浮球"
                title="折叠为悬浮球"
              >
                <!-- 左右"收拢" icon -->
                <svg viewBox="0 0 24 24" class="size-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 3l-7 9 7 9" /><path d="M5 3l7 9-7 9" /></svg>
              </button>
            </div>

            <!-- 统计区块 -->
            <div class="px-3.5 pt-3 pb-2.5 space-y-2.5">
              <div class="flex items-center gap-2">
                <BarChart3 class="size-3.5 text-brand" />
                <span class="text-[10px] font-medium text-text-muted uppercase tracking-wider">博客数据</span>
              </div>
              <div class="grid grid-cols-2 gap-1.5">
                <div class="rounded-xl bg-surface px-2.5 py-2 border border-border/50">
                  <div class="flex items-center gap-1 text-[9.5px] text-text-muted uppercase tracking-wider font-medium">
                    <BookOpen class="size-3 text-brand" />
                    <span>总文章</span>
                  </div>
                  <div class="mt-0.5 text-[17px] font-bold text-text leading-none">{{ posts.length }}<span class="ml-0.5 text-[10px] text-text-muted font-normal">篇</span></div>
                </div>
                <div class="rounded-xl bg-surface px-2.5 py-2 border border-border/50">
                  <div class="flex items-center gap-1 text-[9.5px] text-text-muted uppercase tracking-wider font-medium">
                    <Hash class="size-3 text-accent" />
                    <span>总字数</span>
                  </div>
                  <div class="mt-0.5 text-[17px] font-bold text-text leading-none tabular-nums">
                    {{ totalWords.toLocaleString() }}
                  </div>
                </div>
                <div class="rounded-xl bg-surface px-2.5 py-2 border border-border/50">
                  <div class="flex items-center gap-1 text-[9.5px] text-text-muted uppercase tracking-wider font-medium">
                    <Clock3 class="size-3 text-success" />
                    <span>累计阅读</span>
                  </div>
                  <div class="mt-0.5 text-[17px] font-bold text-text leading-none tabular-nums">{{ totalReadingMinutes }}<span class="ml-0.5 text-[10px] text-text-muted font-normal">分钟</span></div>
                </div>
                <div class="rounded-xl bg-surface px-2.5 py-2 border border-border/50">
                  <div class="flex items-center gap-1 text-[9.5px] text-text-muted uppercase tracking-wider font-medium">
                    <ListTree class="size-3 text-warning" />
                    <span>分类/标签</span>
                  </div>
                  <div class="mt-0.5 text-[17px] font-bold text-text leading-none tabular-nums">
                    {{ categories.length }}<span class="text-[10px] text-text-muted mx-0.5 font-normal">/</span>{{ allTags.length }}
                  </div>
                </div>
              </div>
            </div>

            <!-- 分隔 -->
            <div class="mx-3.5 border-t border-border/50" />

            <!-- 快捷入口 -->
            <div class="px-3.5 py-2.5 space-y-2.5">
              <div class="flex items-center gap-2">
                <FileEdit class="size-3.5 text-accent" />
                <span class="text-[10px] font-medium text-text-muted uppercase tracking-wider">快捷操作</span>
              </div>
              <div class="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  class="btn-chip primary"
                  @click.stop="goNewBlog"
                >
                  <span class="chip-emoji" aria-hidden>✍️</span>
                  <span class="chip-text truncate">写点啥</span>
                </button>
                <button
                  type="button"
                  class="btn-chip"
                  @click.stop="goBlogList"
                >
                  <span class="chip-emoji" aria-hidden>📚</span>
                  <span class="chip-text truncate">翻一翻</span>
                </button>
                <button
                  type="button"
                  class="btn-chip"
                  @click.stop="goRandomPost"
                >
                  <span class="chip-emoji" aria-hidden>🎲</span>
                  <span class="chip-text truncate">抽盲盒</span>
                </button>
                <button
                  type="button"
                  class="btn-chip"
                  @click.stop="goTagManager"
                >
                  <span class="chip-emoji" aria-hidden>🏷️</span>
                  <span class="chip-text truncate">逛标签</span>
                </button>
              </div>
            </div>

            <!-- 底部：标签云 -->
            <div class="px-3.5 py-2.5 border-t border-border/50 bg-surface/40">
              <div class="flex items-center justify-between mb-1.5">
                <div class="flex items-center gap-1.5">
                  <Hash class="size-3 text-brand" />
                  <span class="text-[10px] font-medium text-text-muted uppercase tracking-wider">热门标签</span>
                </div>
                <Badge variant="outline" class="h-[18px] text-[9.5px] !px-1.5">Top 6</Badge>
              </div>
              <div class="flex flex-wrap gap-1">
                <Badge
                  v-for="tag in allTags.slice(0, 6)"
                  :key="tag"
                  variant="secondary"
                  class="text-[10.5px] !py-0"
                >
                  #{{ tag }}
                </Badge>
                <span
                  v-if="allTags.length === 0"
                  class="text-[10.5px] text-text-muted/80"
                >还没有标签，去新建文章加几个吧 ✨</span>
              </div>
            </div>

            <!-- 关闭按钮 -->
            <button
              type="button"
              class="absolute -top-2 -right-2 size-6 rounded-full bg-surface-elevated border border-border/60 shadow-md text-text-muted hover:text-danger hover:border-danger/50 flex items-center justify-center transition z-10"
              aria-label="隐藏数据面板"
              @click.stop="close"
            >
              <svg viewBox="0 0 24 24" class="size-3.5" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
            </button>
          </div>
        </Transition>

        <!-- 拖拽 / 磁吸 提示气泡 -->
        <Transition name="bubble">
          <div
            v-if="isDragging"
            class="absolute -bottom-7 left-1/2 -translate-x-1/2 whitespace-nowrap text-[11px] text-text-muted bg-surface-elevated/95 rounded-full px-2.5 py-1 shadow border border-border/40"
          >
            松手自动吸附到侧边 →
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
/* 展开/折叠 / 关闭恢复 过渡 */
.stats-expand-enter-active,
.stats-expand-leave-active {
  transition: opacity 0.28s ease, transform 0.3s cubic-bezier(0.22, 1, 0.36, 1);
}
.stats-expand-enter-from,
.stats-expand-leave-to {
  opacity: 0;
  transform: scale(0.86) translateY(-4px);
}
/* 内部分子切换 */
.stats-fade-enter-active,
.stats-fade-leave-active {
  transition: opacity 0.18s ease, transform 0.2s cubic-bezier(0.22, 1, 0.36, 1);
}
.stats-fade-enter-from,
.stats-fade-leave-to {
  opacity: 0;
  transform: scale(0.82);
}
/* 拖拽微缩放 */
.widget-dragging {
  transform: scale(1.05);
  transition: transform 0.15s ease;
}
.widget-snapping {
  /* 磁吸动画过程中禁用内部 hover，避免抖动 */
  pointer-events: none;
}
/* 气泡提示 */
.bubble-enter-active,
.bubble-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}
.bubble-enter-from,
.bubble-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(4px) scale(0.92);
}
@media (prefers-reduced-motion: reduce) {
  .stats-expand-enter-active,
  .stats-expand-leave-active,
  .stats-fade-enter-active,
  .stats-fade-leave-active,
  .widget-dragging,
  .bubble-enter-active,
  .bubble-leave-active {
    transition: none;
    animation: none;
  }
}
</style>
