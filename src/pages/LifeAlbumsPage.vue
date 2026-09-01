<script setup lang="ts">
/**
 * LifeAlbumsPage · 相册管理 + 浏览页面
 *
 * 两个入口共用同一个组件：
 *   /life/albums      → 相册集列表（默认）
 *   /life/albums/:id  → 直接展开某相册详情（props: true）
 *
 * 布局参考 LifePage 的简洁卡片风格。
 */
import { ref, computed, onMounted, reactive, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useToast } from '@/composables/useToast'
import { useScrollReveal } from '@/composables/useScrollReveal'
import { useAuthStore } from '@/stores/auth'
import {
  fetchLifeAlbums,
  createLifeAlbum,
  updateLifeAlbum,
  deleteLifeAlbum,
  fetchLifeMoments,
} from '@/api/life'
import type {
  LifeAlbumVo,
  LifeMomentVo,
  CreateLifeAlbumData,
} from '@/lib/api-types'
import { ArrowLeft, Plus, Edit3, Trash2, Home, RefreshCcw, X } from 'lucide-vue-next'

/* ---------- 基础 ---------- */
const route = useRoute()
const router = useRouter()
const toast = useToast()
const auth = useAuthStore()

const rootRef = ref<HTMLElement | null>(null)
const { refresh: refreshReveal } = useScrollReveal(rootRef)

/* ---------- 扩展类型（相册 + 碎片详情） ---------- */
interface AlbumWithMoments extends LifeAlbumVo {
  moments: LifeMomentVo[]
  coverPhoto?: LifeMomentVo
}

/* ---------- 状态 ---------- */
const loading = ref(true)
const errorMsg = ref('')
const albums = ref<AlbumWithMoments[]>([])
const expandedAlbumId = ref<number | null>(null)

/* ---------- 路由 props 支持（直接进入某相册详情） ---------- */
const routeId = computed<number | null>(() => {
  const raw = route.params.id
  if (!raw) return null
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? n : null
})

/* ---------- 工具函数 ---------- */
/** 相对路径 → 完整 URL（复用 LifePage 的逻辑） */
function formatMediaUrl(path: string | null | undefined): string | undefined {
  if (!path) return undefined
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:')) return path
  const base = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api').replace(/\/api$/, '')
  return `${base}${path}`
}

/** ISO 日期 → YYYY.MM.DD */
function fmtDate(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}.${m}.${day}`
}

const DEFAULT_GRADIENT = 'linear-gradient(135deg, #7c3aed, #f59e0b)'

/** 截断描述 */
function truncate(text: string | null | undefined, max = 40): string {
  if (!text) return ''
  return text.length > max ? text.slice(0, max) + '…' : text
}

/* ---------- 数据加载 ---------- */
async function loadAlbums() {
  loading.value = true
  errorMsg.value = ''
  try {
    const list = await fetchLifeAlbums()
    // 按 sortOrder 升序排
    list.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))

    const results: AlbumWithMoments[] = []
    for (const album of list) {
      try {
        const page = await fetchLifeMoments({ albumId: album.id, page: 1, pageSize: 100 })
        const moments = page.list ?? []
        // 找首张 photo 作为封面
        const coverPhoto = moments.find((m) => m.type === 'photo')
        results.push({ ...album, moments, coverPhoto })
      } catch {
        results.push({ ...album, moments: [], coverPhoto: undefined })
      }
    }
    albums.value = results
  } catch (e) {
    errorMsg.value = (e as Error).message || '加载失败'
    albums.value = []
  } finally {
    loading.value = false
    void nextTick().then(() => refreshReveal())
  }
}

onMounted(async () => {
  await loadAlbums()
  // 路由带了 :id → 直接展开对应相册
  if (routeId.value !== null) {
    const exists = albums.value.some((a) => a.id === routeId.value)
    if (exists) expandedAlbumId.value = routeId.value
  }
})

/* ---------- 交互 ---------- */
function goLife() {
  router.push('/life')
}
function toggleExpand(id: number) {
  expandedAlbumId.value = expandedAlbumId.value === id ? null : id
  void nextTick().then(() => refreshReveal())
}

/* ---------- Dialog 状态 ---------- */
const albumDialogOpen = ref(false)
const editingAlbum = ref<AlbumWithMoments | null>(null)
const deletingAlbum = ref<AlbumWithMoments | null>(null)

const albumForm = reactive<CreateLifeAlbumData>({
  name: '',
  description: '',
  coverUrl: '',
  sortOrder: 0,
})

function openCreateDialog() {
  editingAlbum.value = null
  albumForm.name = ''
  albumForm.description = ''
  albumForm.coverUrl = ''
  albumForm.sortOrder = (albums.value.length + 1) * 10
  albumDialogOpen.value = true
}

function openEditDialog(album: AlbumWithMoments) {
  editingAlbum.value = album
  albumForm.name = album.name
  albumForm.description = album.description ?? ''
  albumForm.coverUrl = album.coverUrl ?? ''
  albumForm.sortOrder = album.sortOrder ?? 0
  albumDialogOpen.value = true
}

async function submitAlbum() {
  if (!albumForm.name?.trim()) {
    toast.warn('相册名必填', '请输入相册名称')
    return
  }
  albumDialogOpen.value = false
  const loadingId = toast.info(
    editingAlbum.value ? '正在保存…' : '正在创建…',
    albumForm.name.trim(),
    { duration: 0 },
  )
  try {
    if (editingAlbum.value) {
      await updateLifeAlbum(editingAlbum.value.id, {
        ...albumForm,
        name: albumForm.name!.trim(),
        description: albumForm.description?.trim() || undefined,
        coverUrl: albumForm.coverUrl?.trim() || undefined,
      })
    } else {
      await createLifeAlbum({
        ...albumForm,
        name: albumForm.name!.trim(),
        description: albumForm.description?.trim() || undefined,
        coverUrl: albumForm.coverUrl?.trim() || undefined,
      })
    }
    toast.remove(loadingId)
    toast.success(editingAlbum.value ? '已保存' : '已创建', albumForm.name.trim())
    await loadAlbums()
  } catch (e) {
    toast.remove(loadingId)
    toast.danger('操作失败', (e as Error).message || '请稍后重试')
  }
}

function confirmDelete(album: AlbumWithMoments) {
  deletingAlbum.value = album
}

async function doDelete() {
  const album = deletingAlbum.value
  if (!album) return
  deletingAlbum.value = null
  const loadingId = toast.info('正在删除…', album.name, { duration: 0 })
  try {
    await deleteLifeAlbum(album.id)
    toast.remove(loadingId)
    toast.success('已删除', album.name)
    if (expandedAlbumId.value === album.id) expandedAlbumId.value = null
    await loadAlbums()
  } catch (e) {
    toast.remove(loadingId)
    toast.danger('删除失败', (e as Error).message || '请稍后重试')
  }
}

/* ---------- 类型过滤（相册详情内混排 → 按 Tab） ---------- */
type DetailTab = 'all' | 'photo' | 'music' | 'essay' | 'footprint' | 'booknote'
const detailTabs: { key: DetailTab; label: string; icon: string }[] = [
  { key: 'all', label: '全部', icon: '✨' },
  { key: 'photo', label: '照片', icon: '📷' },
  { key: 'music', label: '音乐', icon: '🎵' },
  { key: 'essay', label: '随笔', icon: '✍️' },
  { key: 'footprint', label: '足迹', icon: '📍' },
  { key: 'booknote', label: '书影', icon: '📚' },
]

const activeDetailTab = ref<DetailTab>('all')

function filteredMoments(moments: LifeMomentVo[]): LifeMomentVo[] {
  if (activeDetailTab.value === 'all') return moments
  return moments.filter((m) => m.type === activeDetailTab.value)
}
</script>

<template>
  <article ref="rootRef" class="max-w-6xl mx-auto space-y-10 pb-20">

    <!-- ===== 页头 ===== -->
    <header class="space-y-5" data-reveal>
      <div class="flex items-center justify-between gap-4">
        <div class="flex items-center gap-3 min-w-0">
          <button
            type="button"
            class="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-brand transition-colors"
            @click="goLife"
          >
            <ArrowLeft class="size-4" />
            返回
          </button>
          <div class="min-w-0">
            <p class="m-0 text-xs font-mono text-brand uppercase tracking-wider">/ life / albums</p>
            <h1 class="m-0 text-2xl md:text-3xl font-bold tracking-tight">
              相册<span class="text-brand">集</span>
            </h1>
          </div>
        </div>
        <button
          v-if="auth.isLoggedIn"
          type="button"
          class="inline-flex items-center gap-2 rounded-lg border border-brand/40 bg-brand/10 px-4 py-2 text-sm font-medium text-brand hover:bg-brand/20 hover:border-brand/60 transition-colors shrink-0"
          @click="openCreateDialog"
        >
          <Plus class="size-4" />
          新建相册
        </button>
      </div>
      <p class="m-0 text-base text-text-muted leading-relaxed max-w-2xl">
        把生活碎片按主题归在一起，翻看时更有故事感。
      </p>
    </header>

    <!-- ===== 三态 ===== -->

    <!-- 加载中 → shimmer -->
    <div v-if="loading" class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4" data-reveal="0.04">
      <div v-for="n in 6" :key="n" class="space-y-2">
        <div class="skel rounded-xl aspect-[4/3]" />
        <div class="skel h-4 w-3/4 rounded-md" />
        <div class="skel h-3 w-1/2 rounded-md" />
      </div>
    </div>

    <!-- 失败 → 红色卡片 -->
    <div
      v-else-if="errorMsg"
      class="rounded-xl border border-red-400/40 bg-red-500/5 p-8 flex flex-col items-center text-center gap-4"
      data-reveal="0.04"
    >
      <div class="size-12 rounded-full bg-red-500/10 flex items-center justify-center text-2xl">⚠️</div>
      <div class="space-y-1">
        <p class="m-0 text-base font-semibold text-text">相册加载失败</p>
        <p class="m-0 text-sm text-text-muted">{{ errorMsg }}</p>
      </div>
      <div class="flex items-center gap-3">
        <button
          type="button"
          class="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand text-white text-sm font-medium hover:opacity-90 transition-opacity"
          @click="loadAlbums"
        >
          <RefreshCcw class="size-4" /> 重试
        </button>
        <button
          type="button"
          class="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-text-muted text-sm font-medium hover:text-text hover:border-brand/40 transition-colors"
          @click="goLife"
        >
          <Home class="size-4" /> 回 /life
        </button>
      </div>
    </div>

    <!-- 空数据 → 虚线引导 -->
    <div
      v-else-if="albums.length === 0"
      class="rounded-xl border-2 border-dashed border-border bg-surface-muted/20 p-10 flex flex-col items-center text-center gap-4"
      data-reveal="0.04"
    >
      <div class="text-4xl">📷</div>
      <div class="space-y-1">
        <p class="m-0 text-base font-semibold text-text">还没相册？</p>
        <p class="m-0 text-sm text-text-muted">创建第一个相册，把散落的碎片归在一起。</p>
      </div>
      <button
        v-if="auth.isLoggedIn"
        type="button"
        class="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand text-white text-sm font-medium hover:opacity-90 transition-opacity"
        @click="openCreateDialog"
      >
        <Plus class="size-4" /> 新建相册
      </button>
      <button
        v-else
        type="button"
        class="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-text-muted text-sm font-medium hover:text-text hover:border-brand/40 transition-colors"
        @click="goLife"
      >
        <Home class="size-4" /> 回首页看看
      </button>
    </div>

    <!-- ===== 相册网格 ===== -->
    <template v-else>
      <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4" data-reveal="0.04">
        <div
          v-for="album in albums"
          :key="album.id"
          class="album-card group relative rounded-xl border border-border bg-surface overflow-hidden cursor-pointer transition-all duration-200 hover:border-brand/30 hover:shadow-md"
          :class="{ 'ring-2 ring-brand/50 border-brand/50': expandedAlbumId === album.id }"
          @click="toggleExpand(album.id)"
        >
          <!-- 封面图 / 渐变 fallback -->
          <div
            class="aspect-[4/3] relative overflow-hidden"
            :style="!album.coverPhoto && !album.coverUrl ? { background: DEFAULT_GRADIENT } : undefined"
          >
            <img
              v-if="album.coverUrl"
              :src="formatMediaUrl(album.coverUrl)"
              :alt="album.name"
              class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              loading="lazy"
            />
            <img
              v-else-if="album.coverPhoto"
              :src="formatMediaUrl(album.coverPhoto.mediaUrl) || formatMediaUrl(album.coverPhoto.thumbnailUrl)"
              :alt="album.name"
              class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              loading="lazy"
            />
            <!-- 暗色渐变遮罩（提高底部文字可读性） -->
            <div class="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
            <!-- 碎片数角标 -->
            <div class="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-black/50 backdrop-blur-sm text-white text-[11px] font-mono">
              {{ album.moments.length }} 张
            </div>
          </div>
          <!-- 相册名 + 描述 -->
          <div class="p-3 space-y-1">
            <p class="m-0 text-sm font-semibold text-text truncate">{{ album.name }}</p>
            <p class="m-0 text-[11px] text-text-muted line-clamp-2 min-h-[28px]">
              {{ truncate(album.description) || '暂无描述' }}
            </p>
          </div>

          <!-- admin hover 操作按钮 -->
          <div
            v-if="auth.isLoggedIn"
            class="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
            @click.stop
          >
            <button
              type="button"
              class="size-7 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center text-text-muted hover:text-brand hover:bg-white transition-colors shadow-sm"
              title="编辑相册"
              @click="openEditDialog(album)"
            >
              <Edit3 class="size-3.5" />
            </button>
            <button
              type="button"
              class="size-7 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center text-text-muted hover:text-danger hover:bg-white transition-colors shadow-sm"
              title="删除相册"
              @click="confirmDelete(album)"
            >
              <Trash2 class="size-3.5" />
            </button>
          </div>
        </div>
      </div>

      <!-- ===== 展开的相册详情 ===== -->
      <Transition name="expand">
        <section
          v-if="expandedAlbumId !== null"
          class="space-y-4 border border-border rounded-xl p-5 bg-surface-muted/10"
          data-reveal
        >
          <!-- 详情页头 -->
          <div class="flex items-start justify-between gap-4">
            <div class="min-w-0 flex-1">
              <p class="m-0 text-xs font-mono text-brand uppercase tracking-wider">相册详情</p>
              <h2 class="m-0 mt-1 text-xl font-bold text-text">
                {{ albums.find((a) => a.id === expandedAlbumId)?.name }}
              </h2>
              <p v-if="albums.find((a) => a.id === expandedAlbumId)?.description" class="m-0 mt-1 text-sm text-text-muted">
                {{ albums.find((a) => a.id === expandedAlbumId)?.description }}
              </p>
              <span class="mt-2 inline-flex items-center gap-1 text-xs text-text-muted font-mono">
                {{ albums.find((a) => a.id === expandedAlbumId)?.moments.length ?? 0 }} 条碎片
              </span>
            </div>
            <button
              type="button"
              class="shrink-0 size-8 rounded-lg border border-border flex items-center justify-center text-text-muted hover:text-text hover:border-brand/40 transition-colors"
              @click="expandedAlbumId = null"
            >
              <X class="size-4" />
            </button>
          </div>

          <!-- Tab 筛选 -->
          <div class="flex flex-wrap items-center gap-2">
            <button
              v-for="tab in detailTabs"
              :key="tab.key"
              type="button"
              class="px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-200"
              :class="[
                activeDetailTab === tab.key
                  ? 'bg-brand text-white border-brand shadow-sm'
                  : 'bg-surface text-text-muted border-border hover:text-text hover:border-brand/40'
              ]"
              @click="activeDetailTab = tab.key"
            >
              {{ tab.icon }} {{ tab.label }}
            </button>
          </div>

          <!-- 碎片网格（混合类型，简洁展示） -->
          <div
            v-if="albums.find((a) => a.id === expandedAlbumId)?.moments.length"
            class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3"
          >
            <template v-for="moment in filteredMoments(albums.find((a) => a.id === expandedAlbumId)?.moments ?? [])" :key="moment.id">
              <!-- 照片 -->
              <div
                v-if="moment.type === 'photo'"
                class="group relative overflow-hidden rounded-xl border border-border bg-surface cursor-pointer aspect-[4/3]"
                @click="router.push(`/life/${moment.id}/edit`)"
              >
                <img
                  v-if="moment.mediaUrl"
                  :src="formatMediaUrl(moment.mediaUrl)"
                  :alt="moment.title || '照片'"
                  class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  loading="lazy"
                />
                <div
                  v-else
                  class="w-full h-full"
                  :style="{ background: `linear-gradient(135deg, ${moment.gradientFrom || '#7c3aed'}, ${moment.gradientTo || '#f59e0b'})` }"
                />
                <div class="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/70 to-transparent">
                  <p class="m-0 text-xs font-medium text-white truncate">{{ moment.title || '无题' }}</p>
                </div>
              </div>
              <!-- 音乐 -->
              <a
                v-else-if="moment.type === 'music'"
                :href="moment.externalLink || '#'"
                target="_blank"
                rel="noopener noreferrer"
                class="group flex flex-col gap-2 p-3 rounded-xl border border-border bg-surface hover:border-brand/30 hover:bg-surface-muted/40 transition-all"
              >
                <div
                  class="aspect-square rounded-lg flex items-center justify-center text-white text-xl overflow-hidden"
                  :style="!moment.thumbnailUrl ? { background: moment.coverColor || '#7c3aed' } : undefined"
                >
                  <img v-if="moment.thumbnailUrl" :src="formatMediaUrl(moment.thumbnailUrl)" class="w-full h-full object-cover" loading="lazy" />
                  <span v-else>♪</span>
                </div>
                <p class="m-0 text-xs font-semibold text-text truncate">{{ moment.title || '无题' }}</p>
                <p class="m-0 text-[11px] text-text-muted truncate">{{ moment.artist || '未知' }}</p>
              </a>
              <!-- 随笔 -->
              <article
                v-else-if="moment.type === 'essay'"
                class="rounded-xl border border-border p-3 hover:border-brand/30 transition-all"
                :style="(moment.gradientFrom && moment.gradientTo)
                  ? { background: `linear-gradient(135deg, ${moment.gradientFrom}15, ${moment.gradientTo}10)` }
                  : undefined
                "
              >
                <p class="m-0 text-xs font-mono text-brand/70 mb-1">{{ fmtDate(moment.date) }}</p>
                <p class="m-0 text-xs text-text leading-relaxed line-clamp-4">{{ moment.content }}</p>
              </article>
              <!-- 足迹 -->
              <article
                v-else-if="moment.type === 'footprint'"
                class="rounded-xl border border-border p-3 hover:border-brand/30 transition-all"
              >
                <div class="flex items-center gap-1.5 mb-1">
                  <span class="text-sm">📍</span>
                  <p class="m-0 text-xs font-semibold text-text truncate">{{ moment.locationName || '未知地点' }}</p>
                </div>
                <p v-if="moment.content" class="m-0 text-xs text-text-muted line-clamp-3">{{ moment.content }}</p>
              </article>
              <!-- 书影 -->
              <article
                v-else-if="moment.type === 'booknote'"
                class="rounded-xl border border-border p-3 hover:border-brand/30 transition-all"
              >
                <div class="flex items-center gap-2 mb-1">
                  <span class="text-[10px] px-1.5 py-0.5 rounded-full bg-brand/10 text-brand font-medium shrink-0">
                    {{ moment.bookType === 'movie' ? '🎬 影' : '📖 书' }}
                  </span>
                  <p class="m-0 text-xs font-semibold text-text truncate">{{ moment.title || '无题' }}</p>
                </div>
                <p class="m-0 text-[11px] text-text-muted truncate">{{ moment.bookAuthor || '佚名' }}</p>
                <p v-if="moment.content" class="m-0 mt-1 text-xs text-text-muted line-clamp-2">{{ moment.content }}</p>
              </article>
            </template>
          </div>
          <p v-else class="m-0 text-sm text-text-muted text-center py-8">这个相册还没有碎片。</p>
        </section>
      </Transition>
    </template>

    <!-- ===== 新建/编辑相册 Dialog ===== -->
    <Teleport to="body">
      <Transition name="fade">
        <div
          v-if="albumDialogOpen"
          class="fixed inset-0 z-[9999] bg-black/50 flex items-center justify-center p-4"
          @click.self="albumDialogOpen = false"
        >
          <div class="bg-surface border border-border rounded-xl shadow-xl w-full max-w-md p-5 space-y-4" @click.stop>
            <div class="flex items-center justify-between">
              <h3 class="m-0 text-base font-semibold text-text">
                {{ editingAlbum ? '编辑相册' : '新建相册' }}
              </h3>
              <button
                type="button"
                class="size-7 rounded-lg text-text-muted hover:text-text hover:bg-surface-muted flex items-center justify-center transition-colors"
                @click="albumDialogOpen = false"
              >
                <X class="size-4" />
              </button>
            </div>

            <div class="space-y-3">
              <div>
                <label class="block text-xs font-medium text-text-muted mb-1.5">相册名 *</label>
                <input
                  v-model="albumForm.name"
                  type="text"
                  class="w-full h-10 rounded-lg border border-input bg-surface px-3 py-2 text-sm text-text placeholder:text-text-muted/70 focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand transition"
                  placeholder="给相册起个名字…"
                />
              </div>
              <div>
                <label class="block text-xs font-medium text-text-muted mb-1.5">描述</label>
                <textarea
                  v-model="albumForm.description"
                  rows="3"
                  class="w-full rounded-lg border border-input bg-surface px-3 py-2 text-sm text-text placeholder:text-text-muted/70 focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand resize-none transition"
                  placeholder="这个相册里有什么故事？"
                />
              </div>
              <div>
                <label class="block text-xs font-medium text-text-muted mb-1.5">封面图 URL（可选）</label>
                <input
                  v-model="albumForm.coverUrl"
                  type="text"
                  class="w-full h-10 rounded-lg border border-input bg-surface px-3 py-2 text-sm text-text placeholder:text-text-muted/70 focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand transition font-mono"
                  placeholder="/uploads/xxx.jpg 或 https://..."
                />
              </div>
              <div>
                <label class="block text-xs font-medium text-text-muted mb-1.5">排序（数字越小越靠前）</label>
                <input
                  v-model.number="albumForm.sortOrder"
                  type="number"
                  class="w-full h-10 rounded-lg border border-input bg-surface px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand transition"
                />
              </div>
            </div>

            <div class="flex justify-end gap-2 pt-1">
              <button
                type="button"
                class="px-3 py-1.5 rounded-lg border border-border text-sm text-text-muted hover:text-text hover:border-brand/40 transition-colors"
                @click="albumDialogOpen = false"
              >
                取消
              </button>
              <button
                type="button"
                class="px-3 py-1.5 rounded-lg bg-brand text-white text-sm font-medium hover:opacity-90 transition-opacity"
                @click="submitAlbum"
              >
                {{ editingAlbum ? '保存' : '创建' }}
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- ===== 删除确认 Dialog ===== -->
    <Teleport to="body">
      <Transition name="fade">
        <div
          v-if="deletingAlbum"
          class="fixed inset-0 z-[9999] bg-black/50 flex items-center justify-center p-4"
          @click.self="deletingAlbum = null"
        >
          <div class="bg-surface border border-border rounded-xl shadow-xl w-full max-w-sm p-5 space-y-4" @click.stop>
            <div class="space-y-1">
              <h3 class="m-0 text-base font-semibold text-text">删除相册</h3>
              <p class="text-sm text-text-muted">
                确定要删除「{{ deletingAlbum.name }}」吗？
              </p>
              <p class="text-xs text-danger">
                相册内的碎片不会被删除，只会与该相册解绑。
              </p>
            </div>
            <div class="flex justify-end gap-2 pt-1">
              <button
                type="button"
                class="px-3 py-1.5 rounded-lg border border-border text-sm text-text-muted hover:text-text hover:border-brand/40 transition-colors"
                @click="deletingAlbum = null"
              >
                取消
              </button>
              <button
                type="button"
                class="px-3 py-1.5 rounded-lg bg-danger text-white text-sm font-medium hover:opacity-90 transition-opacity"
                @click="doDelete"
              >
                删除
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

  </article>
</template>

<style scoped>
/* ===== shimmer 骨架 ===== */
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

/* ===== Dialog fade ===== */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
.fade-enter-active > div:last-child,
.fade-leave-active > div:last-child {
  transition: transform 0.2s ease;
}
.fade-enter-from > div:last-child,
.fade-leave-to > div:last-child {
  transform: translateY(-8px) scale(0.98);
}

/* ===== 展开详情 Transition ===== */
.expand-enter-active,
.expand-leave-active {
  transition: all 0.3s ease;
  overflow: hidden;
}
.expand-enter-from,
.expand-leave-to {
  opacity: 0;
  transform: translateY(-8px);
  max-height: 0;
  padding-top: 0;
  padding-bottom: 0;
  border-width: 0;
}
.expand-enter-to,
.expand-leave-from {
  max-height: 4000px;
}

/* ===== line-clamp ===== */
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.line-clamp-3 {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.line-clamp-4 {
  display: -webkit-box;
  -webkit-line-clamp: 4;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
