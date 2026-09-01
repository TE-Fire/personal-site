<script setup lang="ts">
/**
 * LifePage · 生活碎片页面。
 * 分区瀑布流布局：照片墙创意排布 + 音乐卡片 + 随笔网格 + 足迹/书影 + 底部时间轴。
 * Tab 支持按类型筛选（全部/照片/音乐/随笔/足迹/书影）。
 * 数据源：onMounted 调 GET /api/life 拉取真实碎片，本地按 Tab 过滤。
 */
import { ref, computed, onMounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { fetchLifeMoments } from '@/api/life'
import type { LifeMomentVo, LifeMomentTypeDto } from '@/lib/api-types'
import { moodEmoji, type Mood } from '@/data/life'
import { useScrollReveal } from '@/composables/useScrollReveal'
import { RefreshCcw, Home } from 'lucide-vue-next'

const rootRef = ref<HTMLElement | null>(null)
const { refresh: refreshReveal } = useScrollReveal(rootRef)

const router = useRouter()

type TabKey = 'all' | 'photo' | 'music' | 'essay' | 'footprint' | 'booknote'

/** 加载 / 错误态 */
const loading = ref(true)
const errorMsg = ref('')

/** 全部碎片（一次拉取，本地按 Tab 过滤） */
const moments = ref<LifeMomentVo[]>([])

async function loadMoments() {
  loading.value = true
  errorMsg.value = ''
  try {
    const page = await fetchLifeMoments({ page: 1, pageSize: 100 })
    moments.value = page.list ?? []
  } catch (e) {
    errorMsg.value = (e as Error).message || '加载失败'
    moments.value = []
  } finally {
    loading.value = false
    // 数据就绪后刷新滚动揭示动画，让新挂载的 section 也能淡入
    void nextTick().then(() => refreshReveal())
  }
}

onMounted(loadMoments)

/** ISO 日期 → YYYY.MM.DD（用于展示） */
function fmtDate(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}.${m}.${day}`
}

/** 渐变色 null 兜底 */
const DEFAULT_GRADIENT_FROM = '#7c3aed'
const DEFAULT_GRADIENT_TO = '#f59e0b'

/** 鼠标跟踪：3D 倾斜效果 */
const hoveredPhoto = ref<number | null>(null)
const tiltX = ref(0)
const tiltY = ref(0)

function onPhotoMove(e: MouseEvent, id: number) {
  if (hoveredPhoto.value !== id) return
  const el = e.currentTarget as HTMLElement
  const rect = el.getBoundingClientRect()
  const cx = rect.left + rect.width / 2
  const cy = rect.top + rect.height / 2
  // 鼠标偏移量映射为 -8° ~ 8° 倾斜
  tiltY.value = ((e.clientX - cx) / (rect.width / 2)) * 6
  tiltX.value = -((e.clientY - cy) / (rect.height / 2)) * 6
}

/** 星光粒子位置池（固定位置避免每帧重新计算） */
const sparkPositions = [
  { x: 15, y: 20, delay: 0 },
  { x: 70, y: 15, delay: 0.3 },
  { x: 40, y: 60, delay: 0.6 },
  { x: 85, y: 50, delay: 0.15 }
]

/** 惊喜 emoji：按心情弹出不同表情 */
const surpriseEmoji: Record<string, string> = {
  '治愈': '🐱',
  '灵感': '💡',
  '深夜': '🌙',
  '日常': '☕',
  '旅行': '🧳',
  '美食': '🍜',
  '释然': '🍃',
  '兴奋': '🎆'
}

const activeTab = ref<TabKey>('all')

/** 按 type 过滤的各类碎片（用于统计与 Tab 显隐） */
function byType(type: LifeMomentTypeDto) {
  return moments.value.filter((m) => m.type === type)
}
const photos = computed(() => byType('photo'))
const musics = computed(() => byType('music'))
const essays = computed(() => byType('essay'))
const footprints = computed(() => byType('footprint'))
const booknotes = computed(() => byType('booknote'))

/** Tab：基础四类常驻，足迹/书影仅有数据时才出现 */
const baseTabs: { key: TabKey; label: string; icon: string }[] = [
  { key: 'all', label: '全部', icon: '✨' },
  { key: 'photo', label: '照片', icon: '📷' },
  { key: 'music', label: '音乐', icon: '🎵' },
  { key: 'essay', label: '随笔', icon: '✍️' }
]
const tabs = computed<{ key: TabKey; label: string; icon: string }[]>(() => {
  const arr = [...baseTabs]
  if (footprints.value.length) arr.push({ key: 'footprint', label: '足迹', icon: '📍' })
  if (booknotes.value.length) arr.push({ key: 'booknote', label: '书影', icon: '📚' })
  return arr
})

/** 当前 Tab 可见的各类碎片 */
const photosShown = computed(() => activeTab.value === 'all' || activeTab.value === 'photo' ? photos.value : [])
const musicsShown = computed(() => activeTab.value === 'all' || activeTab.value === 'music' ? musics.value : [])
const essaysShown = computed(() => activeTab.value === 'all' || activeTab.value === 'essay' ? essays.value : [])
const footprintsShown = computed(() => activeTab.value === 'all' || activeTab.value === 'footprint' ? footprints.value : [])
const booknotesShown = computed(() => activeTab.value === 'all' || activeTab.value === 'booknote' ? booknotes.value : [])

/** 所有出现过的月份（YYYY.MM），降序 */
const months = computed(() => {
  const set = new Set<string>()
  moments.value.forEach((m) => {
    if (m.date) set.add(fmtDate(m.date).slice(0, 7))
  })
  return [...set].sort((a, b) => b.localeCompare(a))
})

/** 照片高度映射 */
const heightMap: Record<string, number> = {
  sm: 120,
  md: 180,
  lg: 240,
  xl: 300
}
function photoHeight(key: string | null): number {
  return heightMap[key ?? ''] ?? 180
}

/** 照片卡片旋转角度池（随机微倾斜，增加灵动感） */
const tiltPool = [-2, 1.5, -1, 2, -1.5, 1, -0.5, 0.5]
function tilt(index: number): number {
  return tiltPool[index % tiltPool.length]
}

/** 心情 emoji 取值（兼容 null / 未知 mood） */
function emojiOf(mood: string | null): string {
  if (!mood) return ''
  return moodEmoji[mood as Mood] ?? ''
}

/** 书影评分星（★ × N，最多 5 颗） */
function ratingStars(rating: number | null): string {
  if (!rating || rating <= 0) return ''
  return '★'.repeat(Math.max(1, Math.min(5, Math.round(rating))))
}

/** 统计数字 */
const stats = computed(() => ({
  total: moments.value.length,
  photos: photos.value.length,
  songs: musics.value.length,
  essays: essays.value.length
}))

function goHome() {
  router.push('/')
}
</script>

<template>
  <article ref="rootRef" class="max-w-6xl mx-auto space-y-12 pb-20">

    <!-- 1. 页头 -->
    <header class="space-y-5" data-reveal>
      <p class="m-0 text-xs font-mono text-brand uppercase tracking-wider">/ life</p>
      <h1 class="m-0 text-3xl md:text-4xl font-bold tracking-tight leading-tight">
        生活<span class="text-brand">碎片</span>
      </h1>
      <p class="m-0 text-base md:text-lg text-text-muted leading-relaxed max-w-2xl">
        照片、音乐、随笔 —— 那些不属于代码，却构成了生活的东西。
      </p>
      <!-- 统计 chip -->
      <div class="flex flex-wrap gap-3">
        <div class="rounded-lg border border-border/60 bg-surface-muted/25 px-4 py-2.5 flex items-center gap-2">
          <span class="font-mono text-xl font-bold text-brand">{{ stats.total }}</span>
          <span class="text-xs text-text-muted">条碎片</span>
        </div>
        <div class="rounded-lg border border-border/60 bg-surface-muted/25 px-4 py-2.5 flex items-center gap-2">
          <span class="font-mono text-xl font-bold text-text">📷 {{ stats.photos }}</span>
          <span class="text-xs text-text-muted">张照片</span>
        </div>
        <div class="rounded-lg border border-border/60 bg-surface-muted/25 px-4 py-2.5 flex items-center gap-2">
          <span class="font-mono text-xl font-bold text-text">🎵 {{ stats.songs }}</span>
          <span class="text-xs text-text-muted">首歌</span>
        </div>
        <div class="rounded-lg border border-border/60 bg-surface-muted/25 px-4 py-2.5 flex items-center gap-2">
          <span class="font-mono text-xl font-bold text-text">✍️ {{ stats.essays }}</span>
          <span class="text-xs text-text-muted">篇随笔</span>
        </div>
      </div>
    </header>

    <!-- 三态：加载中 / 失败 / 已加载 -->
    <div v-if="loading" class="space-y-4" data-reveal="0.04">
      <div class="flex items-center gap-2">
        <span class="text-lg">⏳</span>
        <h2 class="m-0 text-lg font-semibold tracking-tight">加载中</h2>
      </div>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-3 auto-rows-min">
        <div
          v-for="n in 8"
          :key="n"
          class="skel rounded-xl"
          :class="n % 5 === 0 ? 'col-span-2' : 'col-span-1'"
          :style="{ height: (n % 4 === 0 ? 300 : n % 3 === 0 ? 240 : 180) + 'px' }"
        />
      </div>
    </div>
    <div v-else-if="errorMsg" class="rounded-xl border border-red-400/40 bg-red-500/5 p-8 flex flex-col items-center text-center gap-4" data-reveal="0.04">
      <div class="size-12 rounded-full bg-red-500/10 flex items-center justify-center text-2xl">⚠️</div>
      <div class="space-y-1">
        <p class="m-0 text-base font-semibold text-text">碎片加载失败</p>
        <p class="m-0 text-sm text-text-muted">{{ errorMsg }}</p>
      </div>
      <div class="flex items-center gap-3">
        <button type="button" class="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand text-white text-sm font-medium hover:opacity-90 transition-opacity" @click="loadMoments">
          <RefreshCcw class="size-4" /> 重试
        </button>
        <button type="button" class="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-text-muted text-sm font-medium hover:text-text hover:border-brand/40 transition-colors" @click="goHome">
          <Home class="size-4" /> 回首页
        </button>
      </div>
    </div>
    <template v-else>
    <!-- 2. Tab 筛选栏 -->
    <div class="flex flex-wrap items-center gap-2" data-reveal="0.04">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        class="px-4 py-2 rounded-full text-sm font-medium border transition-all duration-200"
        :class="[
          activeTab === tab.key
            ? 'bg-brand text-white border-brand shadow-sm'
            : 'bg-surface text-text-muted border-border hover:text-text hover:border-brand/40 hover:bg-surface-muted/40'
        ]"
        @click="activeTab = tab.key"
      >
        {{ tab.icon }} {{ tab.label }}
      </button>
    </div>

    <!-- 3. 照片墙 · 创意瀑布流 -->
    <section v-if="photosShown.length" class="space-y-4" data-reveal="0.06">
      <div class="flex items-center gap-2">
        <span class="text-lg">📷</span>
        <h2 class="m-0 text-lg font-semibold tracking-tight">照片墙</h2>
        <span class="text-xs text-text-muted font-mono">{{ photosShown.length }} 张</span>
      </div>
      <!-- 创意排布：CSS Grid 不规则跨行跨列 -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-3 auto-rows-min">
        <div
          v-for="(photo, i) in photosShown"
          :key="photo.id"
          class="photo-card group relative overflow-hidden rounded-xl cursor-pointer"
          :class="[
            photo.span === 2 ? 'col-span-2' : 'col-span-1',
          ]"
          :style="{
            height: photoHeight(photo.heightKey) + 'px',
            '--tilt': tilt(i) + 'deg',
            '--tilt-x': hoveredPhoto === photo.id ? tiltX + 'deg' : '0deg',
            '--tilt-y': hoveredPhoto === photo.id ? tiltY + 'deg' : '0deg',
            '--glow-from': photo.gradientFrom || DEFAULT_GRADIENT_FROM,
            '--glow-to': photo.gradientTo || DEFAULT_GRADIENT_TO,
            background: `linear-gradient(135deg, ${photo.gradientFrom || DEFAULT_GRADIENT_FROM}, ${photo.gradientTo || DEFAULT_GRADIENT_TO})`
          }"
          @mousemove="onPhotoMove($event, photo.id)"
          @mouseenter="hoveredPhoto = photo.id"
          @mouseleave="hoveredPhoto = null"
        >
          <!-- 暗角遮罩 -->
          <div class="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-80 group-hover:opacity-90 transition-opacity duration-300" />
          <!-- 光泽扫过效果 -->
          <div class="shine-sweep absolute inset-0 pointer-events-none" />
          <!-- 浮动星光粒子 -->
          <div class="sparkles absolute inset-0 pointer-events-none">
            <span
              v-for="s in 4"
              :key="s"
              class="sparkle-dot"
              :style="{
                '--sx': sparkPositions[s - 1].x + '%',
                '--sy': sparkPositions[s - 1].y + '%',
                '--sd': sparkPositions[s - 1].delay + 's'
              }"
            >✨</span>
          </div>
          <!-- 内容 -->
          <div class="absolute inset-0 flex flex-col justify-end p-4">
            <div class="flex items-center gap-2 mb-1 photo-meta">
              <span class="text-xs font-mono text-white/80">{{ fmtDate(photo.date) }}</span>
            </div>
            <p class="m-0 text-sm font-semibold text-white drop-shadow photo-title">{{ photo.title || '无题' }}</p>
            <span class="mt-1 inline-flex items-center gap-1 text-[11px] text-white/70 photo-mood">
              {{ emojiOf(photo.mood) }} {{ photo.mood }}
            </span>
          </div>
          <!-- 惊喜 emoji 弹出 -->
          <div class="surprise-emoji absolute inset-0 flex items-center justify-center pointer-events-none">
            <span class="surprise-text">{{ surpriseEmoji[photo.mood ?? ''] }}</span>
          </div>
          <!-- hover 放大提示 -->
          <div class="absolute top-3 right-3 size-7 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <span class="text-xs text-white">🔍</span>
          </div>
        </div>
      </div>
    </section>

    <!-- 4. 音乐区 -->
    <section v-if="musicsShown.length" class="space-y-4" data-reveal="0.08">
      <div class="flex items-center gap-2">
        <span class="text-lg">🎵</span>
        <h2 class="m-0 text-lg font-semibold tracking-tight">最近在听</h2>
        <span class="text-xs text-text-muted font-mono">{{ musicsShown.length }} 首</span>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
        <a
          v-for="song in musicsShown"
          :key="song.id"
          :href="song.externalLink || '#'"
          target="_blank"
          rel="noopener noreferrer"
          class="group flex items-center gap-3 p-4 rounded-xl border border-border/60 bg-surface hover:bg-surface-muted/40 hover:border-brand/30 transition-all duration-200 no-underline"
        >
          <!-- 封面 -->
          <div
            class="size-12 rounded-lg flex items-center justify-center text-white shrink-0 transition-transform group-hover:scale-105"
            :style="{ background: song.coverColor || DEFAULT_GRADIENT_FROM }"
          >
            <span class="text-lg">♪</span>
          </div>
          <!-- 歌曲信息 -->
          <div class="flex-1 min-w-0 space-y-0.5">
            <p class="m-0 text-sm font-semibold text-text truncate">{{ song.title || '无题' }}</p>
            <p class="m-0 text-xs text-text-muted truncate">{{ song.artist || '未知' }}</p>
            <p v-if="song.comment" class="m-0 text-[11px] text-text-subtle truncate italic">"{{ song.comment }}"</p>
          </div>
          <!-- 循环次数 -->
          <div class="shrink-0 flex flex-col items-end gap-1">
            <span class="font-mono text-lg font-bold text-brand/80">{{ song.playCount }}</span>
            <span class="text-[10px] text-text-muted">次循环</span>
          </div>
          <!-- 心情标签 -->
          <span class="shrink-0 text-[11px] text-text-muted px-2 py-1 rounded-full bg-surface-muted/50">
            {{ emojiOf(song.mood) }} {{ song.mood }}
          </span>
        </a>
      </div>
    </section>

    <!-- 5. 随笔区 -->
    <section v-if="essaysShown.length" class="space-y-4" data-reveal="0.10">
      <div class="flex items-center gap-2">
        <span class="text-lg">✍️</span>
        <h2 class="m-0 text-lg font-semibold tracking-tight">随手记</h2>
        <span class="text-xs text-text-muted font-mono">{{ essaysShown.length }} 篇</span>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        <article
          v-for="essay in essaysShown"
          :key="essay.id"
          class="group relative overflow-hidden rounded-xl border border-border/60 p-5 transition-all duration-200 hover:border-brand/30 hover:shadow-md"
          :style="(essay.gradientFrom && essay.gradientTo)
            ? { background: `linear-gradient(135deg, ${essay.gradientFrom}15, ${essay.gradientTo}10)` }
            : undefined
          "
        >
          <!-- 渐变装饰条 -->
          <div
            v-if="essay.gradientFrom && essay.gradientTo"
            class="absolute top-0 left-0 h-full w-1 transition-all duration-200 group-hover:w-1.5"
            :style="{ background: `linear-gradient(${essay.gradientFrom}, ${essay.gradientTo})` }"
          />
          <!-- 日期 -->
          <p class="m-0 mb-3 text-xs font-mono text-brand/70">{{ fmtDate(essay.date) }}</p>
          <!-- 正文 -->
          <p class="m-0 text-sm leading-relaxed text-text">{{ essay.content }}</p>
          <!-- 心情标签 -->
          <span class="mt-4 inline-flex items-center gap-1 text-[11px] text-text-muted px-2.5 py-1 rounded-full bg-surface-muted/50">
            {{ emojiOf(essay.mood) }} {{ essay.mood }}
          </span>
        </article>
      </div>
    </section>

    <!-- 5.5 足迹 -->
    <section v-if="footprintsShown.length" class="space-y-4" data-reveal="0.10">
      <div class="flex items-center gap-2">
        <span class="text-lg">📍</span>
        <h2 class="m-0 text-lg font-semibold tracking-tight">足迹</h2>
        <span class="text-xs text-text-muted font-mono">{{ footprintsShown.length }} 处</span>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        <article
          v-for="fp in footprintsShown"
          :key="fp.id"
          class="group relative overflow-hidden rounded-xl border border-border/60 p-5 transition-all duration-200 hover:border-brand/30 hover:shadow-md"
        >
          <div class="flex items-center gap-2 mb-2">
            <span class="text-base">📍</span>
            <p class="m-0 text-sm font-semibold text-text truncate">{{ fp.locationName || '未知地点' }}</p>
          </div>
          <p class="m-0 mb-2 text-xs font-mono text-brand/70">{{ fmtDate(fp.date) }}</p>
          <p v-if="fp.content" class="m-0 text-sm leading-relaxed text-text">{{ fp.content }}</p>
          <span v-if="fp.mood" class="mt-3 inline-flex items-center gap-1 text-[11px] text-text-muted px-2.5 py-1 rounded-full bg-surface-muted/50">
            {{ emojiOf(fp.mood) }} {{ fp.mood }}
          </span>
        </article>
      </div>
    </section>

    <!-- 5.6 书影 -->
    <section v-if="booknotesShown.length" class="space-y-4" data-reveal="0.10">
      <div class="flex items-center gap-2">
        <span class="text-lg">📚</span>
        <h2 class="m-0 text-lg font-semibold tracking-tight">书影</h2>
        <span class="text-xs text-text-muted font-mono">{{ booknotesShown.length }} 条</span>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        <article
          v-for="bn in booknotesShown"
          :key="bn.id"
          class="group relative overflow-hidden rounded-xl border border-border/60 p-5 transition-all duration-200 hover:border-brand/30 hover:shadow-md"
        >
          <div class="flex items-center gap-2 mb-2">
            <span class="text-[11px] px-2 py-0.5 rounded-full bg-brand/10 text-brand font-medium shrink-0">
              {{ bn.bookType === '影' ? '🎬 影' : '📖 书' }}
            </span>
            <p class="m-0 text-sm font-semibold text-text truncate flex-1">{{ bn.title || '无题' }}</p>
          </div>
          <p class="m-0 mb-2 text-xs text-text-muted">{{ bn.bookAuthor || '佚名' }}</p>
          <p v-if="bn.rating" class="m-0 mb-2 text-sm text-amber-500 tracking-wide">{{ ratingStars(bn.rating) }}</p>
          <p v-if="bn.content" class="m-0 text-sm leading-relaxed text-text">{{ bn.content }}</p>
          <span v-if="bn.mood" class="mt-3 inline-flex items-center gap-1 text-[11px] text-text-muted px-2.5 py-1 rounded-full bg-surface-muted/50">
            {{ emojiOf(bn.mood) }} {{ bn.mood }}
          </span>
        </article>
      </div>
    </section>

    <!-- 6. 底部时间轴 -->
    <section class="space-y-4" data-reveal="0.12">
      <div class="flex items-center gap-2">
        <span class="text-lg">⏳</span>
        <h2 class="m-0 text-lg font-semibold tracking-tight">时间轴</h2>
      </div>
      <div class="relative py-6 px-2 overflow-x-auto">
        <!-- 主线 -->
        <div class="absolute top-1/2 left-0 right-0 h-px bg-border -translate-y-1/2" />
        <!-- 月份节点 -->
        <div class="relative flex items-center justify-between gap-4 min-w-max">
          <div
            v-for="(month, i) in months"
            :key="month"
            class="flex flex-col items-center gap-2 relative"
          >
            <!-- 节点圆 -->
            <div
              class="size-3 rounded-full border-2 transition-all"
              :class="[
                i === 0
                  ? 'bg-brand border-brand scale-125 shadow-md'
                  : 'bg-surface border-border'
              ]"
            />
            <span
              class="text-xs font-mono whitespace-nowrap"
              :class="i === 0 ? 'text-brand font-semibold' : 'text-text-muted'"
            >
              {{ month }}
            </span>
            <span v-if="i === 0" class="text-[10px] text-brand/60 font-mono">此刻</span>
          </div>
        </div>
      </div>
    </section>
    </template>

  </article>
</template>

<style scoped>
/* ====== 照片卡片基础 ====== */
.photo-card {
  transform: rotate(var(--tilt, 0deg));
  transition: transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1),
              box-shadow 0.35s ease;
  box-shadow: 0 2px 8px -2px rgba(0, 0, 0, 0.12);
  will-change: transform;
}

/* hover：归正 + 3D 视差倾斜 + 放大 + 彩色光晕 */
.photo-card:hover {
  transform: rotate(0deg) perspective(800px)
    rotateX(var(--tilt-x, 0deg))
    rotateY(var(--tilt-y, 0deg))
    scale(1.05);
  box-shadow:
    0 16px 32px -8px rgba(0, 0, 0, 0.25),
    0 0 24px -4px var(--glow-from, #7c3aed);
  z-index: 20;
}

/* ====== 光泽扫过 ====== */
.shine-sweep::before {
  content: '';
  position: absolute;
  top: -50%;
  left: -60%;
  width: 40%;
  height: 200%;
  background: linear-gradient(
    100deg,
    transparent,
    rgba(255, 255, 255, 0.25),
    transparent
  );
  transform: rotate(25deg) translateX(0);
  opacity: 0;
  transition: none;
}
.photo-card:hover .shine-sweep::before {
  animation: shine-sweep 0.7s ease-out;
}
@keyframes shine-sweep {
  0%   { left: -60%; opacity: 0; }
  20%  { opacity: 1; }
  80%  { opacity: 1; }
  100% { left: 120%; opacity: 0; }
}

/* ====== 浮动星光粒子 ====== */
.sparkle-dot {
  position: absolute;
  left: var(--sx, 50%);
  top: var(--sy, 50%);
  font-size: 12px;
  opacity: 0;
  transform: scale(0);
  pointer-events: none;
}
.photo-card:hover .sparkle-dot {
  animation: sparkle-pop 0.9s ease-out var(--sd, 0s) both;
}
@keyframes sparkle-pop {
  0%   { opacity: 0; transform: scale(0) translateY(0); }
  40%  { opacity: 1; transform: scale(1.3) translateY(-8px); }
  100% { opacity: 0; transform: scale(0.6) translateY(-20px); }
}

/* ====== 惊喜 emoji 弹出 ====== */
.surprise-emoji {
  z-index: 5;
}
.surprise-text {
  font-size: 2rem;
  opacity: 0;
  transform: scale(0) rotate(-30deg);
  transition: none;
  filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.2));
}
.photo-card:hover .surprise-text {
  animation: surprise-pop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 0.15s both;
}
@keyframes surprise-pop {
  0%   { opacity: 0; transform: scale(0) rotate(-30deg); }
  50%  { opacity: 1; transform: scale(1.2) rotate(8deg); }
  70%  { transform: scale(1) rotate(-3deg); }
  100% { opacity: 0; transform: scale(0.8) translateY(-16px) rotate(0deg); }
}

/* ====== 内容上滑揭示 ====== */
.photo-meta,
.photo-title,
.photo-mood {
  transform: translateY(6px);
  opacity: 0.85;
  transition: transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1),
              opacity 0.3s ease;
}
.photo-card:hover .photo-meta {
  transform: translateY(0);
  opacity: 1;
  transition-delay: 0.05s;
}
.photo-card:hover .photo-title {
  transform: translateY(0);
  opacity: 1;
  transition-delay: 0.1s;
}
.photo-card:hover .photo-mood {
  transform: translateY(0);
  opacity: 1;
  transition-delay: 0.15s;
}

/* ====== 随笔卡片 hover 时左侧装饰条加宽 ====== */

/* ====== 加载骨架 shimmer ====== */
.skel {
  position: relative;
  overflow: hidden;
  background: var(--surface-muted, #e5e7eb);
}
.skel::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(
    90deg,
    transparent,
    var(--surface-elevated, var(--surface, #ffffff)),
    transparent
  );
  transform: translateX(-100%);
  animation: life-shimmer 1.5s infinite;
}
@keyframes life-shimmer {
  100% { transform: translateX(100%); }
}
</style>
