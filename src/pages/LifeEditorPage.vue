<script setup lang="ts">
/**
 * LifeEditorPage.vue · 生活碎片发布/编辑器
 *
 * 路由：
 *   /life/new          → 新建模式
 *   /life/:id/edit     → 编辑模式（props: true，通过 route.params.id 取 id）
 *
 * 数据源：
 *   · 编辑态加载 → GET /api/life/:id
 *   · 新建 / 更新 / 删除 → POST / PUT / DELETE /api/life[/:id]
 *   · 文件上传 → POST /api/life/upload
 */
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useToast } from '@/composables/useToast'
import { useScrollReveal } from '@/composables/useScrollReveal'
import {
  fetchLifeMomentById,
  createLifeMoment,
  updateLifeMoment,
  deleteLifeMoment,
  uploadLifeFile,
} from '@/api/life'
import type {
  LifeMomentVo,
  LifeMomentTypeDto,
  LifeStatusDto,
  CreateLifeMomentData,
} from '@/lib/api-types'

const route = useRoute()
const router = useRouter()
const toast = useToast()

const rootRef = ref<HTMLElement | null>(null)
useScrollReveal(rootRef)

/* ---------- 模式判断 ---------- */
const editId = computed<number | null>(() => {
  const raw = route.params.id
  if (!raw) return null
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? n : null
})
const isEditMode = computed(() => editId.value !== null)

/* ---------- 类型 / 选项字典 ---------- */
const typeOptions: { value: LifeMomentTypeDto; icon: string; label: string }[] = [
  { value: 'photo', icon: '📷', label: '照片' },
  { value: 'music', icon: '🎵', label: '音乐' },
  { value: 'essay', icon: '✍️', label: '随笔' },
  { value: 'footprint', icon: '📍', label: '足迹' },
  { value: 'booknote', icon: '📖', label: '书影' },
]

const moodOptions = ['治愈', '灵感', '深夜', '日常', '旅行', '美食', '释然', '兴奋']

/* ---------- 表单状态（单个 reactive 对象） ---------- */
const form = reactive({
  type: 'photo' as LifeMomentTypeDto,
  title: '',
  content: '',
  date: new Date().toISOString().slice(0, 10), // YYYY-MM-DD
  mood: '',
  featured: false,
  status: 'published' as LifeStatusDto,
  // 照片
  mediaUrl: '',
  mediaType: '',
  gradientFrom: '#7c3aed',
  gradientTo: '#f59e0b',
  span: 1,
  heightKey: 'md',
  // 音乐
  artist: '',
  playCount: 0,
  externalLink: '',
  coverColor: '#7c3aed',
  comment: '',
  // 书影
  bookAuthor: '',
  rating: 5,
  bookType: 'book',
  // 足迹
  geoLat: undefined as number | undefined,
  geoLng: undefined as number | undefined,
  locationName: '',
  // 缩略图（音乐封面 / 书影封面）
  thumbnailUrl: '',
})

/* ---------- 加载 / 保存态 ---------- */
const loading = ref(false)
const saving = ref(false)

/* ---------- 文件上传（共享一个 input，靠 uploadTarget 区分写入字段） ---------- */
const fileInputRef = ref<HTMLInputElement | null>(null)
const uploadTarget = ref<'photo' | 'thumbnail'>('photo')
const dragOver = ref(false)
const uploading = ref(false)

function pickFile(target: 'photo' | 'thumbnail') {
  uploadTarget.value = target
  fileInputRef.value?.click()
}

function onFileChange(ev: Event) {
  const file = (ev.target as HTMLInputElement).files?.[0]
  if (file) applyFile(file)
  ;(ev.target as HTMLInputElement).value = ''
}

async function applyFile(file: File) {
  uploading.value = true
  const loadingId = toast.info('正在上传文件…', file.name, { duration: 0 })
  try {
    const rsp = await uploadLifeFile(file)
    if (uploadTarget.value === 'photo') {
      form.mediaUrl = rsp.url
      form.mediaType = rsp.mimeType
    } else {
      form.thumbnailUrl = rsp.url
    }
    toast.remove(loadingId)
    toast.success('上传成功', file.name)
  } catch (e) {
    toast.remove(loadingId)
    toast.danger('上传失败', (e as Error).message || '请稍后重试')
  } finally {
    uploading.value = false
  }
}

function onDragOver(ev: DragEvent) {
  if (!ev.dataTransfer) return
  ev.preventDefault()
  ev.dataTransfer.dropEffect = 'copy'
  dragOver.value = true
}
function onDragLeave() {
  dragOver.value = false
}
function onDrop(ev: DragEvent) {
  if (!ev.dataTransfer) return
  ev.preventDefault()
  dragOver.value = false
  const file = ev.dataTransfer.files?.[0]
  if (file) applyFile(file)
}

/* ---------- 数字安全解析（处理 input v-model.number 空串） ---------- */
function num(v: unknown): number | undefined {
  if (typeof v === 'number' && !Number.isNaN(v)) return v
  if (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v))) return Number(v)
  return undefined
}

/* ---------- 构建提交载荷（只包含当前 type 相关的非空字段） ---------- */
function buildPayload(): CreateLifeMomentData {
  const data: CreateLifeMomentData = {
    type: form.type,
    title: form.title.trim() || undefined,
    content: form.content.trim() || undefined,
    date: form.date,
    mood: form.mood || undefined,
    featured: form.featured,
    status: form.status,
  }

  if (form.type === 'photo') {
    if (form.mediaUrl) data.mediaUrl = form.mediaUrl
    if (form.mediaType) data.mediaType = form.mediaType
    data.gradientFrom = form.gradientFrom
    data.gradientTo = form.gradientTo
    data.span = form.span
    data.heightKey = form.heightKey
  } else if (form.type === 'music') {
    data.artist = form.artist.trim() || undefined
    data.playCount = form.playCount
    data.externalLink = form.externalLink.trim() || undefined
    data.coverColor = form.coverColor
    data.comment = form.comment.trim() || undefined
    if (form.thumbnailUrl) data.thumbnailUrl = form.thumbnailUrl
  } else if (form.type === 'footprint') {
    data.locationName = form.locationName.trim() || undefined
    const lat = num(form.geoLat)
    const lng = num(form.geoLng)
    if (lat !== undefined) data.geoLat = lat
    if (lng !== undefined) data.geoLng = lng
  } else if (form.type === 'booknote') {
    data.bookType = form.bookType
    data.bookAuthor = form.bookAuthor.trim() || undefined
    data.rating = form.rating
    if (form.thumbnailUrl) data.thumbnailUrl = form.thumbnailUrl
  }
  // essay：仅通用字段，无类型专属字段
  return data
}

/* ---------- 保存 ---------- */
async function handleSave(publish: boolean) {
  if (!form.title.trim()) {
    toast.warn('标题必填', '请先输入碎片标题')
    return
  }
  form.status = publish ? 'published' : 'draft'
  saving.value = true
  const payload = buildPayload()
  const loadingId = toast.info(
    publish ? '正在发布…' : '正在保存草稿…',
    form.title.trim(),
    { duration: 0 },
  )
  try {
    if (isEditMode.value && editId.value !== null) {
      await updateLifeMoment(editId.value, payload)
      toast.remove(loadingId)
      toast.success(publish ? '已发布' : '已保存草稿', form.title.trim())
    } else {
      await createLifeMoment(payload)
      toast.remove(loadingId)
      toast.success(publish ? '已发布' : '已保存草稿', form.title.trim())
    }
    await router.push('/life')
  } catch (e) {
    toast.remove(loadingId)
    toast.danger('保存失败', (e as Error).message || '请稍后重试')
  } finally {
    saving.value = false
  }
}

/* ---------- 删除（仅编辑模式） ---------- */
async function handleDelete() {
  if (!isEditMode.value || editId.value === null) return
  if (!window.confirm('确定要删除这条碎片吗？此操作不可恢复。')) return
  const loadingId = toast.info('正在删除…', form.title.trim() || '', { duration: 0 })
  try {
    await deleteLifeMoment(editId.value)
    toast.remove(loadingId)
    toast.success('已删除', form.title.trim() || '')
    await router.push('/life')
  } catch (e) {
    toast.remove(loadingId)
    toast.danger('删除失败', (e as Error).message || '请稍后重试')
  }
}

/* ---------- 加载编辑态数据 ---------- */
function applyMoment(m: LifeMomentVo) {
  form.type = m.type
  form.title = m.title ?? ''
  form.content = m.content ?? ''
  form.date = (m.date || '').slice(0, 10) || new Date().toISOString().slice(0, 10)
  form.mood = m.mood ?? ''
  form.featured = m.featured
  form.status = m.status === 'archived' ? 'draft' : (m.status as LifeStatusDto)
  // 照片
  form.mediaUrl = m.mediaUrl ?? ''
  form.mediaType = m.mediaType ?? ''
  form.gradientFrom = m.gradientFrom ?? '#7c3aed'
  form.gradientTo = m.gradientTo ?? '#f59e0b'
  form.span = m.span || 1
  form.heightKey = m.heightKey || 'md'
  // 音乐
  form.artist = m.artist ?? ''
  form.playCount = m.playCount ?? 0
  form.externalLink = m.externalLink ?? ''
  form.coverColor = m.coverColor ?? '#7c3aed'
  form.comment = m.comment ?? ''
  // 书影
  form.bookAuthor = m.bookAuthor ?? ''
  form.rating = m.rating ?? 5
  form.bookType = m.bookType ?? 'book'
  // 足迹
  form.geoLat = m.geoLat ?? undefined
  form.geoLng = m.geoLng ?? undefined
  form.locationName = m.locationName ?? ''
  // 缩略图
  form.thumbnailUrl = m.thumbnailUrl ?? ''
}

async function loadEditData() {
  if (editId.value === null) return
  loading.value = true
  try {
    const m = await fetchLifeMomentById(editId.value)
    applyMoment(m)
  } catch (e) {
    toast.danger('加载失败', (e as Error).message || '请稍后重试')
    await router.push('/life')
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  if (isEditMode.value) loadEditData()
})

/* ---------- 共享样式串 ---------- */
const inputClass =
  'w-full h-10 rounded-lg border border-input bg-surface px-3 py-2 text-sm text-text placeholder:text-text-muted/70 focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand transition disabled:opacity-50'
const selectClass = inputClass + ' cursor-pointer'
const textareaClass =
  'w-full rounded-lg border border-input bg-surface px-3 py-2 text-sm text-text placeholder:text-text-muted/70 focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand resize-none transition disabled:opacity-50'
const labelClass = 'block text-xs font-medium text-text-muted mb-1.5'
</script>

<template>
  <div ref="rootRef" class="max-w-4xl mx-auto py-8 px-4">
    <!-- 共享文件 input -->
    <input
      ref="fileInputRef"
      type="file"
      accept="image/*"
      class="hidden"
      @change="onFileChange"
    />

    <!-- 加载态 -->
    <div v-if="loading" class="flex items-center justify-center py-20 text-text-muted">
      <span class="animate-pulse text-sm">正在加载…</span>
    </div>

    <template v-else>
      <!-- ========== 页面头部 ========== -->
      <header class="flex items-center justify-between gap-3 mb-6" data-reveal>
        <div class="flex items-center gap-3 min-w-0">
          <button type="button" class="btn-spec-b" @click="router.push('/life')" aria-label="返回">
            <span>← 返回</span>
          </button>
          <div class="min-w-0">
            <div class="text-xs uppercase tracking-wider font-semibold text-brand">生活碎片</div>
            <h1 class="mt-0.5 text-xl sm:text-2xl font-bold text-text truncate">
              {{ isEditMode ? '编辑碎片' : '生活碎片编辑器' }}
            </h1>
          </div>
        </div>
        <button
          type="button"
          class="btn-spec-b btn-spec-b--primary"
          :disabled="saving"
          @click="handleSave(true)"
        >
          {{ saving ? '保存中…' : '发布' }}
        </button>
      </header>

      <!-- ========== 类型选择 ========== -->
      <section class="mb-6" data-reveal="0.05">
        <div class="text-xs uppercase tracking-wider font-semibold text-brand mb-2.5">类型选择</div>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="t in typeOptions"
            :key="t.value"
            type="button"
            class="px-4 py-2 rounded-full border text-sm font-medium transition"
            :class="
              form.type === t.value
                ? 'bg-brand text-white border-brand shadow-sm'
                : 'bg-surface border-border text-text-muted hover:border-brand/50 hover:text-text'
            "
            @click="form.type = t.value"
          >
            <span class="mr-1">{{ t.icon }}</span>{{ t.label }}
          </button>
        </div>
      </section>

      <!-- ========== 通用字段 ========== -->
      <section class="space-y-4 mb-6" data-reveal="0.1">
        <div class="text-xs uppercase tracking-wider font-semibold text-brand">通用字段</div>

        <!-- 标题 -->
        <div>
          <label :class="labelClass">标题</label>
          <input
            v-model="form.title"
            type="text"
            :class="inputClass"
            placeholder="给这条碎片起个标题…"
          />
        </div>

        <!-- 日期 + 心情 -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label :class="labelClass">日期</label>
            <input v-model="form.date" type="date" :class="inputClass" />
          </div>
          <div>
            <label :class="labelClass">心情</label>
            <select v-model="form.mood" :class="selectClass">
              <option value="">无</option>
              <option v-for="m in moodOptions" :key="m" :value="m">{{ m }}</option>
            </select>
          </div>
        </div>

        <!-- 首页精选 + 状态 -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
          <label
            class="flex items-center gap-2 cursor-pointer select-none h-10 px-3 rounded-lg border border-input bg-surface"
          >
            <input type="checkbox" v-model="form.featured" class="size-4 accent-brand" />
            <span class="text-sm text-text">首页精选</span>
          </label>
          <div>
            <label :class="labelClass">状态</label>
            <select v-model="form.status" :class="selectClass">
              <option value="draft">草稿</option>
              <option value="published">发布</option>
            </select>
          </div>
        </div>
      </section>

      <!-- ========== 类型专属字段 ========== -->
      <section class="space-y-4 mb-6" data-reveal="0.15">
        <div class="text-xs uppercase tracking-wider font-semibold text-brand">类型专属字段</div>

        <!-- 照片 -->
        <template v-if="form.type === 'photo'">
          <!-- 已上传图片预览 -->
          <div
            v-if="form.mediaUrl"
            class="relative rounded-lg overflow-hidden border border-border aspect-[4/3]"
          >
            <img
              :src="form.mediaUrl"
              alt="照片预览"
              class="w-full h-full object-cover"
              @error="($event.target as HTMLImageElement).style.opacity = '0.3'"
            />
            <button
              type="button"
              class="btn-spec-b btn-spec-b--danger absolute top-2 right-2"
              style="--btn-b-h: 32px; --btn-b-px: 10px; --btn-b-fs: 12px"
              @click="form.mediaUrl = ''; form.mediaType = ''"
            >
              移除
            </button>
          </div>

          <!-- 拖拽上传区 -->
          <button
            v-else
            type="button"
            class="w-full aspect-[4/3] min-h-[160px] rounded-lg border-2 border-dashed flex flex-col items-center justify-center gap-2 px-4 text-center transition"
            :class="
              dragOver
                ? 'border-brand bg-brand/5 ring-2 ring-brand/30'
                : 'border-border bg-surface hover:border-brand/50 hover:bg-surface-muted/40'
            "
            @click="pickFile('photo')"
            @dragover="onDragOver"
            @dragleave="onDragLeave"
            @drop="onDrop"
          >
            <span v-if="uploading" class="text-sm text-text-muted animate-pulse">正在上传…</span>
            <template v-else>
              <span class="text-3xl">📤</span>
              <span class="text-sm font-medium text-text">点击或拖拽图片到这里</span>
              <span class="text-xs text-text-muted">支持 JPG / PNG / WEBP / GIF</span>
            </template>
          </button>

          <!-- 渐变色（无图时作为照片占位） -->
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label :class="labelClass">渐变起色</label>
              <input
                v-model="form.gradientFrom"
                type="color"
                class="w-full h-10 rounded-lg border border-input bg-surface cursor-pointer"
              />
            </div>
            <div>
              <label :class="labelClass">渐变止色</label>
              <input
                v-model="form.gradientTo"
                type="color"
                class="w-full h-10 rounded-lg border border-input bg-surface cursor-pointer"
              />
            </div>
          </div>
          <div
            class="h-12 rounded-lg border border-border"
            :style="{ background: `linear-gradient(135deg, ${form.gradientFrom}, ${form.gradientTo})` }"
          />

          <!-- 布局：跨度 + 行高 -->
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label :class="labelClass">布局跨度</label>
              <select v-model="form.span" :class="selectClass">
                <option :value="1">1 列（标准）</option>
                <option :value="2">2 列（宽卡）</option>
              </select>
            </div>
            <div>
              <label :class="labelClass">行高</label>
              <select v-model="form.heightKey" :class="selectClass">
                <option value="sm">小</option>
                <option value="md">中</option>
                <option value="lg">大</option>
                <option value="xl">超大</option>
              </select>
            </div>
          </div>
        </template>

        <!-- 音乐 -->
        <template v-else-if="form.type === 'music'">
          <div>
            <label :class="labelClass">演唱者</label>
            <input v-model="form.artist" type="text" :class="inputClass" placeholder="演唱者 / 乐队" />
          </div>

          <div>
            <label :class="labelClass">封面色</label>
            <div class="flex items-center gap-3">
              <input
                v-model="form.coverColor"
                type="color"
                class="h-10 w-24 rounded-lg border border-input bg-surface cursor-pointer"
              />
              <span
                class="h-10 flex-1 rounded-lg border border-border"
                :style="{ background: form.coverColor }"
              />
            </div>
          </div>

          <!-- 封面图（可选） -->
          <div>
            <label :class="labelClass">封面图（可选）</label>
            <div
              v-if="form.thumbnailUrl"
              class="relative rounded-lg overflow-hidden border border-border h-24"
            >
              <img :src="form.thumbnailUrl" alt="封面预览" class="w-full h-full object-cover" />
              <button
                type="button"
                class="btn-spec-b btn-spec-b--danger absolute top-2 right-2"
                style="--btn-b-h: 28px; --btn-b-px: 10px; --btn-b-fs: 12px"
                @click="form.thumbnailUrl = ''"
              >
                移除
              </button>
            </div>
            <button
              v-else
              type="button"
              class="btn-spec-b"
              :disabled="uploading"
              @click="pickFile('thumbnail')"
            >
              {{ uploading ? '上传中…' : '上传封面图' }}
            </button>
          </div>

          <div>
            <label :class="labelClass">外链</label>
            <input
              v-model="form.externalLink"
              type="text"
              :class="inputClass"
              placeholder="https://music.163.com/song?id=..."
            />
          </div>

          <div>
            <label :class="labelClass">循环次数</label>
            <input
              v-model.number="form.playCount"
              type="number"
              min="0"
              :class="inputClass"
              placeholder="0"
            />
          </div>

          <div>
            <label :class="labelClass">一句话点评</label>
            <input
              v-model="form.comment"
              type="text"
              :class="inputClass"
              placeholder="前奏一响，就回到了那个夏天"
            />
          </div>
        </template>

        <!-- 随笔：只有通用字段 + 正文，无类型专属字段 -->
        <template v-else-if="form.type === 'essay'">
          <p class="text-sm text-text-muted">
            随笔类型没有专属字段，直接在下方「描述/正文」里写内容即可。
          </p>
        </template>

        <!-- 足迹 -->
        <template v-else-if="form.type === 'footprint'">
          <div>
            <label :class="labelClass">地点</label>
            <input
              v-model="form.locationName"
              type="text"
              :class="inputClass"
              placeholder="地点名称"
            />
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label :class="labelClass">纬度</label>
              <input
                v-model.number="form.geoLat"
                type="number"
                step="any"
                :class="inputClass"
                placeholder="纬度"
              />
            </div>
            <div>
              <label :class="labelClass">经度</label>
              <input
                v-model.number="form.geoLng"
                type="number"
                step="any"
                :class="inputClass"
                placeholder="经度"
              />
            </div>
          </div>
        </template>

        <!-- 书影 -->
        <template v-else-if="form.type === 'booknote'">
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label :class="labelClass">类型</label>
              <select v-model="form.bookType" :class="selectClass">
                <option value="book">书</option>
                <option value="movie">影</option>
              </select>
            </div>
            <div>
              <label :class="labelClass">评分</label>
              <select v-model.number="form.rating" :class="selectClass">
                <option v-for="n in 5" :key="n" :value="n">{{ n }} 星</option>
              </select>
            </div>
          </div>

          <div>
            <label :class="labelClass">作者</label>
            <input
              v-model="form.bookAuthor"
              type="text"
              :class="inputClass"
              placeholder="作者 / 导演"
            />
          </div>

          <!-- 封面图（可选） -->
          <div>
            <label :class="labelClass">封面图（可选）</label>
            <div
              v-if="form.thumbnailUrl"
              class="relative rounded-lg overflow-hidden border border-border h-24"
            >
              <img :src="form.thumbnailUrl" alt="封面预览" class="w-full h-full object-cover" />
              <button
                type="button"
                class="btn-spec-b btn-spec-b--danger absolute top-2 right-2"
                style="--btn-b-h: 28px; --btn-b-px: 10px; --btn-b-fs: 12px"
                @click="form.thumbnailUrl = ''"
              >
                移除
              </button>
            </div>
            <button
              v-else
              type="button"
              class="btn-spec-b"
              :disabled="uploading"
              @click="pickFile('thumbnail')"
            >
              {{ uploading ? '上传中…' : '上传封面图' }}
            </button>
          </div>
        </template>
      </section>

      <!-- ========== 描述 / 正文 ========== -->
      <section class="space-y-2 mb-6" data-reveal="0.2">
        <div class="text-xs uppercase tracking-wider font-semibold text-brand">描述 / 正文</div>
        <textarea
          v-model="form.content"
          rows="5"
          :class="textareaClass"
          placeholder="写点什么吧…"
        />
      </section>

      <!-- ========== 底部操作栏 ========== -->
      <div
        class="flex flex-wrap items-center gap-2 justify-between pt-4 border-t border-border"
        data-reveal="0.25"
      >
        <div class="flex flex-wrap gap-2">
          <button type="button" class="btn-spec-b" :disabled="saving" @click="router.push('/life')">
            取消
          </button>
          <button
            type="button"
            class="btn-spec-b"
            :disabled="saving"
            @click="handleSave(false)"
          >
            保存草稿
          </button>
          <button
            type="button"
            class="btn-spec-b btn-spec-b--primary"
            :disabled="saving"
            @click="handleSave(true)"
          >
            {{ saving ? '保存中…' : '发布' }}
          </button>
        </div>
        <button
          v-if="isEditMode"
          type="button"
          class="btn-spec-b btn-spec-b--danger"
          :disabled="saving"
          @click="handleDelete"
        >
          删除
        </button>
      </div>
    </template>
  </div>
</template>
