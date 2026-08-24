<script setup lang="ts">
/**
 * LifePage · 生活碎片页面。
 * 分区瀑布流布局：照片墙创意排布 + 音乐卡片 + 随笔网格 + 底部时间轴。
 * Tab 支持按类型筛选（全部/照片/音乐/随笔）。
 */
import { ref, computed } from 'vue'
import { photoMoments, musicMoments, essayMoments, moodEmoji, getMonths, type Mood, type PhotoMoment } from '@/data/life'
import { useScrollReveal } from '@/composables/useScrollReveal'

const rootRef = ref<HTMLElement | null>(null)
useScrollReveal(rootRef)

type TabKey = 'all' | 'photo' | 'music' | 'essay'

const activeTab = ref<TabKey>('all')

const tabs: { key: TabKey; label: string; icon: string }[] = [
  { key: 'all', label: '全部', icon: '✨' },
  { key: 'photo', label: '照片', icon: '📷' },
  { key: 'music', label: '音乐', icon: '🎵' },
  { key: 'essay', label: '随笔', icon: '✍️' }
]

const photos = computed(() => activeTab.value === 'all' || activeTab.value === 'photo' ? photoMoments : [])
const musics = computed(() => activeTab.value === 'all' || activeTab.value === 'music' ? musicMoments : [])
const essays = computed(() => activeTab.value === 'all' || activeTab.value === 'essay' ? essayMoments : [])
const months = getMonths()

/** 照片高度映射 */
const heightMap: Record<PhotoMoment['height'], number> = {
  sm: 120,
  md: 180,
  lg: 240,
  xl: 300
}

/** 照片卡片旋转角度池（随机微倾斜，增加灵动感） */
const tiltPool = [-2, 1.5, -1, 2, -1.5, 1, -0.5, 0.5]
function tilt(index: number): number {
  return tiltPool[index % tiltPool.length]
}

/** 统计数字 */
const stats = computed(() => ({
  total: photoMoments.length + musicMoments.length + essayMoments.length,
  photos: photoMoments.length,
  songs: musicMoments.length,
  essays: essayMoments.length
}))
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
    <section v-if="photos.length" class="space-y-4" data-reveal="0.06">
      <div class="flex items-center gap-2">
        <span class="text-lg">📷</span>
        <h2 class="m-0 text-lg font-semibold tracking-tight">照片墙</h2>
        <span class="text-xs text-text-muted font-mono">{{ photos.length }} 张</span>
      </div>
      <!-- 创意排布：CSS Grid 不规则跨行跨列 -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-3 auto-rows-min">
        <div
          v-for="(photo, i) in photos"
          :key="photo.id"
          class="photo-card group relative overflow-hidden rounded-xl cursor-pointer transition-all duration-300"
          :class="[
            photo.span === 2 ? 'col-span-2' : 'col-span-1',
          ]"
          :style="{
            height: heightMap[photo.height] + 'px',
            transform: `rotate(${tilt(i)}deg)`,
            background: `linear-gradient(135deg, ${photo.gradient.from}, ${photo.gradient.to})`
          }"
        >
          <!-- 暗角遮罩 -->
          <div class="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-80 group-hover:opacity-90 transition-opacity" />
          <!-- 内容 -->
          <div class="absolute inset-0 flex flex-col justify-end p-4">
            <div class="flex items-center gap-2 mb-1">
              <span class="text-xs font-mono text-white/80">{{ photo.date }}</span>
            </div>
            <p class="m-0 text-sm font-semibold text-white drop-shadow">{{ photo.title }}</p>
            <span class="mt-1 inline-flex items-center gap-1 text-[11px] text-white/70">
              {{ moodEmoji[photo.mood as Mood] }} {{ photo.mood }}
            </span>
          </div>
          <!-- hover 放大提示 -->
          <div class="absolute top-3 right-3 size-7 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <span class="text-xs text-white">🔍</span>
          </div>
        </div>
      </div>
    </section>

    <!-- 4. 音乐区 -->
    <section v-if="musics.length" class="space-y-4" data-reveal="0.08">
      <div class="flex items-center gap-2">
        <span class="text-lg">🎵</span>
        <h2 class="m-0 text-lg font-semibold tracking-tight">最近在听</h2>
        <span class="text-xs text-text-muted font-mono">{{ musics.length }} 首</span>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
        <a
          v-for="song in musics"
          :key="song.id"
          :href="song.link || '#'"
          target="_blank"
          rel="noopener noreferrer"
          class="group flex items-center gap-3 p-4 rounded-xl border border-border/60 bg-surface hover:bg-surface-muted/40 hover:border-brand/30 transition-all duration-200 no-underline"
        >
          <!-- 封面 -->
          <div
            class="size-12 rounded-lg flex items-center justify-center text-white shrink-0 transition-transform group-hover:scale-105"
            :style="{ background: song.coverColor }"
          >
            <span class="text-lg">♪</span>
          </div>
          <!-- 歌曲信息 -->
          <div class="flex-1 min-w-0 space-y-0.5">
            <p class="m-0 text-sm font-semibold text-text truncate">{{ song.title }}</p>
            <p class="m-0 text-xs text-text-muted truncate">{{ song.artist }}</p>
            <p v-if="song.comment" class="m-0 text-[11px] text-text-subtle truncate italic">"{{ song.comment }}"</p>
          </div>
          <!-- 循环次数 -->
          <div class="shrink-0 flex flex-col items-end gap-1">
            <span class="font-mono text-lg font-bold text-brand/80">{{ song.playCount }}</span>
            <span class="text-[10px] text-text-muted">次循环</span>
          </div>
          <!-- 心情标签 -->
          <span class="shrink-0 text-[11px] text-text-muted px-2 py-1 rounded-full bg-surface-muted/50">
            {{ moodEmoji[song.mood as Mood] }} {{ song.mood }}
          </span>
        </a>
      </div>
    </section>

    <!-- 5. 随笔区 -->
    <section v-if="essays.length" class="space-y-4" data-reveal="0.10">
      <div class="flex items-center gap-2">
        <span class="text-lg">✍️</span>
        <h2 class="m-0 text-lg font-semibold tracking-tight">随手记</h2>
        <span class="text-xs text-text-muted font-mono">{{ essays.length }} 篇</span>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        <article
          v-for="essay in essays"
          :key="essay.id"
          class="group relative overflow-hidden rounded-xl border border-border/60 p-5 transition-all duration-200 hover:border-brand/30 hover:shadow-md"
          :style="essay.gradient
            ? { background: `linear-gradient(135deg, ${essay.gradient.from}15, ${essay.gradient.to}10)` }
            : undefined
          "
        >
          <!-- 渐变装饰条 -->
          <div
            v-if="essay.gradient"
            class="absolute top-0 left-0 h-full w-1 transition-all duration-200 group-hover:w-1.5"
            :style="{ background: `linear-gradient(${essay.gradient.from}, ${essay.gradient.to})` }"
          />
          <!-- 日期 -->
          <p class="m-0 mb-3 text-xs font-mono text-brand/70">{{ essay.date }}</p>
          <!-- 正文 -->
          <p class="m-0 text-sm leading-relaxed text-text">{{ essay.content }}</p>
          <!-- 心情标签 -->
          <span class="mt-4 inline-flex items-center gap-1 text-[11px] text-text-muted px-2.5 py-1 rounded-full bg-surface-muted/50">
            {{ moodEmoji[essay.mood as Mood] }} {{ essay.mood }}
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

  </article>
</template>

<style scoped>
/* 照片卡片 hover 效果 */
.photo-card {
  box-shadow: 0 2px 8px -2px rgba(0, 0, 0, 0.1);
}
.photo-card:hover {
  transform: rotate(0deg) scale(1.03) !important;
  box-shadow: 0 12px 24px -6px rgba(0, 0, 0, 0.2);
  z-index: 10;
}

/* 随笔卡片 hover 时左侧装饰条加宽 */
</style>
