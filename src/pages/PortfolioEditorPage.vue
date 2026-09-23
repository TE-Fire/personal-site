<script setup lang="ts">
/**
 * PortfolioEditorPage · 作品新建/编辑页（/admin/portfolio/new、/admin/portfolio/:id/edit）
 *
 * 与旧版「管理页内弹窗表单」的差异（2026-09-23 UI 走查结论）：
 *   · 新建/编辑改为独立页面（与博客/生活碎片编辑器一致），不再用弹窗
 *   · 分类/标签改为从词库中选择（下拉 + 多选 chips），不再手动输入；
 *     词库本体在「作品集管理 → 分类与标签」弹窗中维护
 *
 * 数据流：
 *   onMounted → getWorkMeta() 拉词库
 *             → 编辑模式再 getAdminWorks() 找到当前作品（无单条 admin 接口，列表量小直接查）
 *   保存      → createWork / updateWork → toast → 返回管理页
 */
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useToast } from '@/composables/useToast'
import {
  getWorkMeta,
  getAdminWorks,
  createWork,
  updateWork,
  type WorkData,
  type WorkMeta,
} from '@/api/portfolio'
import { Card, CardContent, Input, Label, Switch } from '@/components/ui'
import {
  ArrowLeft,
  Loader2,
  Save,
  Star,
  Briefcase,
  Palette,
  Link2,
  Tags,
  FileText,
  Settings2,
} from 'lucide-vue-next'

defineOptions({ name: 'PortfolioEditorPage' })

const props = defineProps<{ id?: string }>()

const router = useRouter()
const toast = useToast()

/* ---------- 状态 ---------- */
const loading = ref(true)
const submitting = ref(false)
const meta = ref<WorkMeta>({ categories: [], tags: [] })

/** 编辑模式下的作品 id（new 路由无 id） */
const workId = computed(() => (props.id ? Number(props.id) : null))
const isCreate = computed(() => workId.value == null)

/**
 * 封面渐变预设 · 标准 CSS gradient 表达式
 * 颜色取自 tokens.css（brand #4B3FE3 / accent #27D2BF / chart 系列），
 * 透明度 0.30-0.45 叠加在页面底色上，与卡片风格一致。
 */
const coverPresets = [
  'linear-gradient(135deg, rgba(75,63,227,0.35), rgba(39,210,191,0.35), rgba(34,165,247,0.35))',
  'linear-gradient(135deg, rgba(169,174,255,0.45), rgba(75,63,227,0.30), rgba(203,213,225,0.40))',
  'linear-gradient(135deg, rgba(60,46,202,0.35), rgba(39,210,191,0.35), rgba(111,111,255,0.35))',
  'linear-gradient(135deg, rgba(34,165,247,0.40), rgba(75,63,227,0.30), rgba(169,174,255,0.40))',
  'linear-gradient(135deg, rgba(60,46,202,0.30), rgba(34,165,247,0.40), rgba(111,111,255,0.35))',
  'linear-gradient(135deg, rgba(39,210,191,0.40), rgba(34,165,247,0.30), rgba(75,63,227,0.35))',
]

/** 兼容旧数据：历史封面存的是 Tailwind 类名（从未渲染成功），映射到对应预设 */
const LEGACY_COVER_MAP: Record<string, string> = {
  'from-brand/30 via-accent/30 to-chart-c1/30': coverPresets[0],
  'from-chart-c2/30 via-brand/30 to-surface-muted': coverPresets[1],
  'from-chart-c3/30 via-accent/30 to-chart-c4/30': coverPresets[2],
  'from-chart-c5/30 via-brand/30 to-chart-c2/30': coverPresets[3],
  'from-chart-c1/30 via-chart-c4/30 to-chart-c3/30': coverPresets[4],
  'from-accent/30 via-chart-c5/30 to-brand/30': coverPresets[5],
}

function normalizeCover(cover?: string | null): string {
  if (!cover) return coverPresets[0]
  if (LEGACY_COVER_MAP[cover]) return LEGACY_COVER_MAP[cover]
  return cover
}

const statusOptions = [
  { value: 'DRAFT', label: '草稿（仅自己可见）' },
  { value: 'PUBLISHED', label: '已发布（公开可见）' },
  { value: 'ARCHIVED', label: '已归档（下线隐藏）' },
] as const

/* ---------- 表单 ---------- */
interface DraftForm {
  slug: string
  title: string
  summary: string
  description: string
  cover: string
  category: string
  tags: string[]
  homepage: string
  repo: string
  demo: string
  finishedAt: string
  highlight: boolean
  sortOrder: number
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'
}

function emptyDraft(): DraftForm {
  return {
    slug: '',
    title: '',
    summary: '',
    description: '',
    cover: coverPresets[0],
    category: '',
    tags: [],
    homepage: '',
    repo: '',
    demo: '',
    finishedAt: new Date().toISOString().slice(0, 7),
    highlight: false,
    sortOrder: 0,
    status: 'DRAFT',
  }
}

const draft = reactive<DraftForm>(emptyDraft())

function hydrateDraft(w: WorkData) {
  draft.slug = w.slug
  draft.title = w.title
  draft.summary = w.summary
  draft.description = w.description
  draft.cover = normalizeCover(w.cover)
  draft.category = w.category
  draft.tags = [...(w.tags || [])]
  draft.homepage = w.links?.homepage ?? ''
  draft.repo = w.links?.repo ?? ''
  draft.demo = w.links?.demo ?? ''
  draft.finishedAt = (w.finishedAt || '').slice(0, 7)
  draft.highlight = !!w.highlight
  draft.sortOrder = w.sortOrder ?? 0
  draft.status = (w.status as DraftForm['status']) || 'DRAFT'
}

/* ---------- 加载 ---------- */
onMounted(async () => {
  loading.value = true
  try {
    meta.value = await getWorkMeta()
    // 分类默认值：新建时取词库第一个；编辑时由 hydrate 覆盖
    if (isCreate.value && !draft.category && meta.value.categories.length) {
      draft.category = meta.value.categories[0]
    }
    if (!isCreate.value) {
      const list = await getAdminWorks()
      const work = list.find((w) => w.id === workId.value)
      if (!work) {
        toast.danger('作品不存在', '可能已被删除，请返回列表刷新')
        router.replace('/admin/portfolio')
        return
      }
      hydrateDraft(work)
    }
  } catch (e: any) {
    toast.danger('加载失败', e?.message || '无法获取作品数据')
  } finally {
    loading.value = false
  }
})

/* ---------- 标签多选 ---------- */
function toggleTag(tag: string) {
  const idx = draft.tags.indexOf(tag)
  if (idx >= 0) draft.tags.splice(idx, 1)
  else draft.tags.push(tag)
}

/* ---------- 校验 / 提交 ---------- */
function validate(): string | null {
  if (!draft.slug.trim()) return 'slug 不能为空'
  if (!/^[a-z0-9-]+$/.test(draft.slug)) return 'slug 只能包含小写字母、数字和短横线'
  if (!draft.title.trim()) return '标题不能为空'
  if (!draft.category) return '请选择分类'
  if (draft.cover && !/gradient\(/.test(draft.cover))
    return '封面渐变应为 CSS gradient() 表达式，例如 linear-gradient(135deg, #4B3FE3, #27D2BF)'
  if (draft.finishedAt && !/^\d{4}-\d{2}$/.test(draft.finishedAt))
    return '完成时间格式应为 YYYY-MM'
  return null
}

function buildPayload(): Partial<WorkData> {
  const links: WorkData['links'] = {}
  if (draft.homepage.trim()) links.homepage = draft.homepage.trim()
  if (draft.repo.trim()) links.repo = draft.repo.trim()
  if (draft.demo.trim()) links.demo = draft.demo.trim()
  return {
    slug: draft.slug.trim(),
    title: draft.title.trim(),
    summary: draft.summary.trim(),
    description: draft.description,
    cover: draft.cover.trim(),
    tags: [...draft.tags],
    category: draft.category,
    links,
    finishedAt: draft.finishedAt,
    highlight: draft.highlight,
    sortOrder: Number(draft.sortOrder) || 0,
    status: draft.status,
  }
}

async function handleSave() {
  if (submitting.value) return
  const err = validate()
  if (err) {
    toast.warn('表单不完整', err)
    return
  }
  submitting.value = true
  try {
    if (isCreate.value) {
      const created = await createWork(buildPayload())
      toast.success('创建成功', created.title)
    } else {
      const updated = await updateWork(workId.value!, buildPayload())
      toast.success('保存成功', updated.title)
    }
    router.push('/admin/portfolio')
  } catch (e: any) {
    toast.danger('保存失败', e?.message || '请稍后重试')
  } finally {
    submitting.value = false
  }
}

function goBack() {
  router.push('/admin/portfolio')
}

/* 词库为空时的引导提示 */
const noVocab = computed(
  () => meta.value.categories.length === 0 && meta.value.tags.length === 0,
)
</script>

<template>
  <article class="max-w-3xl mx-auto space-y-6">
    <!-- ==================== 页头 ==================== -->
    <header class="flex flex-wrap items-center justify-between gap-4">
      <div class="flex items-center gap-3">
        <button
          type="button"
          class="btn-spec-b btn-spec-b--icon btn-spec-b--ghost"
          aria-label="返回作品集管理"
          @click="goBack"
        >
          <ArrowLeft class="btn-spec-b__icon" />
        </button>
        <div class="space-y-1">
          <p class="m-0 text-xs font-mono text-brand uppercase tracking-wider">
            / admin / portfolio / {{ isCreate ? 'new' : 'edit' }}
          </p>
          <h1 class="m-0 text-2xl md:text-3xl font-semibold tracking-tight">
            {{ isCreate ? '新建作品' : '编辑作品' }}
          </h1>
        </div>
      </div>
      <button
        type="button"
        class="btn-spec-b btn-spec-b--primary"
        :disabled="submitting || loading"
        @click="handleSave"
      >
        <Loader2 v-if="submitting" class="btn-spec-b__icon animate-spin" />
        <Save v-else class="btn-spec-b__icon" />
        <span>{{ submitting ? '保存中…' : '保存' }}</span>
      </button>
    </header>

    <!-- ==================== 加载中 ==================== -->
    <div v-if="loading" class="flex items-center justify-center gap-2 py-24 text-text-muted">
      <Loader2 class="size-5 animate-spin" />
      <span class="text-sm">正在加载…</span>
    </div>

    <template v-else>
      <!-- 词库为空引导 -->
      <div
        v-if="noVocab"
        class="rounded-xl border border-warning/30 bg-warning/[0.06] px-5 py-4 text-sm text-text-muted"
      >
        词库还是空的：请先到「作品集管理 → 分类与标签」新增分类与标签，再回来编辑作品。
      </div>

      <!-- ==================== 基础信息 ==================== -->
      <Card>
        <CardContent class="p-5 md:p-6 space-y-5">
          <h2 class="m-0 text-base font-semibold text-text flex items-center gap-2">
            <FileText class="size-5 text-brand" />
            基础信息
          </h2>

          <div class="space-y-1.5">
            <Label class="text-sm font-medium">标题 <span class="text-danger">*</span></Label>
            <Input v-model="draft.title" placeholder="项目名称" maxlength="200" />
          </div>

          <div class="flex flex-col md:flex-row gap-4">
            <div class="flex-1 space-y-1.5">
              <Label class="text-sm font-medium">Slug（网址标识） <span class="text-danger">*</span></Label>
              <Input v-model="draft.slug" placeholder="url 标识，如 my-project" class="font-mono" />
              <p class="m-0 text-xs text-text-muted">
                作品详情页网址的最后一段：…/#/portfolio/<b>my-project</b>。
                只能小写字母、数字、短横线，保存后不建议修改。
              </p>
            </div>
            <div class="w-full md:w-36 space-y-1.5">
              <Label class="text-sm font-medium">排序号</Label>
              <Input v-model="draft.sortOrder" type="number" placeholder="0" />
              <p class="m-0 text-xs text-text-muted">越小越靠前</p>
            </div>
          </div>

          <div class="space-y-1.5">
            <Label class="text-sm font-medium">摘要</Label>
            <Input
              v-model="draft.summary"
              maxlength="160"
              placeholder="一句话概括（列表卡片 + 详情页 hero 展示）"
            />
          </div>

          <div class="space-y-1.5">
            <Label class="text-sm font-medium">详细描述</Label>
            <textarea
              v-model="draft.description"
              rows="6"
              placeholder="项目背景、做了什么、亮点与产出…支持换行"
              class="flex w-full rounded-md border border-border bg-surface-elevated px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
            />
          </div>
        </CardContent>
      </Card>

      <!-- ==================== 分类与标签 ==================== -->
      <Card>
        <CardContent class="p-5 md:p-6 space-y-5">
          <div class="flex items-center justify-between gap-3">
            <h2 class="m-0 text-base font-semibold text-text flex items-center gap-2">
              <Tags class="size-5 text-brand" />
              分类与标签
            </h2>
            <router-link
              to="/admin/portfolio"
              class="text-xs text-brand hover:underline no-underline"
            >
              维护词库 →
            </router-link>
          </div>

          <div class="space-y-1.5">
            <Label class="text-sm font-medium">分类（单选）</Label>
            <select
              v-model="draft.category"
              class="flex h-10 w-full rounded-md border border-border bg-surface-elevated px-3 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              <option v-for="c in meta.categories" :key="c" :value="c">{{ c }}</option>
            </select>
          </div>

          <div class="space-y-2">
            <Label class="text-sm font-medium">技术标签（多选）</Label>
            <div v-if="meta.tags.length" class="flex flex-wrap gap-2">
              <button
                v-for="tag in meta.tags"
                :key="tag"
                type="button"
                class="text-sm inline-flex items-center rounded-full border transition px-3 py-1.5"
                :class="draft.tags.includes(tag)
                  ? 'border-brand/40 bg-brand/10 text-brand'
                  : 'border-border/60 bg-surface-muted/20 text-text-muted hover:border-border hover:text-text'"
                :aria-pressed="draft.tags.includes(tag)"
                @click="toggleTag(tag)"
              >
                #{{ tag }}
              </button>
            </div>
            <p v-else class="m-0 text-xs text-text-muted">词库中还没有标签。</p>
            <p class="m-0 text-xs text-text-muted">
              没有想要的标签？到「作品集管理 → 分类与标签」里新增。
            </p>
          </div>
        </CardContent>
      </Card>

      <!-- ==================== 封面 ==================== -->
      <Card>
        <CardContent class="p-5 md:p-6 space-y-5">
          <h2 class="m-0 text-base font-semibold text-text flex items-center gap-2">
            <Palette class="size-5 text-brand" />
            封面
          </h2>

          <div class="space-y-2">
            <Label class="text-sm font-medium">预设渐变</Label>
            <div class="flex flex-wrap gap-2.5">
              <button
                v-for="preset in coverPresets"
                :key="preset"
                type="button"
                class="size-12 rounded-lg border transition"
                :style="{ backgroundImage: preset }"
                :class="draft.cover === preset ? 'border-brand ring-2 ring-brand/30' : 'border-border/60 hover:border-border'"
                :aria-label="`选择渐变预设`"
                @click="draft.cover = preset"
              />
            </div>
          </div>

          <div class="space-y-1.5">
            <Label class="text-sm font-medium">自定义渐变（CSS）</Label>
            <Input
              v-model="draft.cover"
              placeholder="linear-gradient(135deg, #4B3FE3 0%, #27D2BF 100%)"
              class="font-mono text-xs"
            />
            <p class="m-0 text-xs text-text-muted">
              一段标准 CSS 渐变表达式（linear / radial-gradient 均可），不熟悉可直接用上面的预设。
            </p>
            <div
              class="h-16 rounded-lg border border-border/60"
              :style="{ backgroundImage: draft.cover || 'none' }"
            />
          </div>
        </CardContent>
      </Card>

      <!-- ==================== 链接 ==================== -->
      <Card>
        <CardContent class="p-5 md:p-6 space-y-4">
          <h2 class="m-0 text-base font-semibold text-text flex items-center gap-2">
            <Link2 class="size-5 text-brand" />
            相关链接
          </h2>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div class="space-y-1.5">
              <Label class="text-sm font-medium">项目主页</Label>
              <Input v-model="draft.homepage" placeholder="https://…" class="font-mono text-xs" />
            </div>
            <div class="space-y-1.5">
              <Label class="text-sm font-medium">源码仓库</Label>
              <Input v-model="draft.repo" placeholder="https://github.com/…" class="font-mono text-xs" />
            </div>
            <div class="space-y-1.5">
              <Label class="text-sm font-medium">在线 Demo</Label>
              <Input v-model="draft.demo" placeholder="https://…" class="font-mono text-xs" />
            </div>
          </div>
        </CardContent>
      </Card>

      <!-- ==================== 发布设置 ==================== -->
      <Card>
        <CardContent class="p-5 md:p-6 space-y-5">
          <h2 class="m-0 text-base font-semibold text-text flex items-center gap-2">
            <Settings2 class="size-5 text-brand" />
            发布设置
          </h2>

          <div class="flex flex-col md:flex-row gap-4">
            <div class="flex-1 space-y-1.5">
              <Label class="text-sm font-medium">发布状态</Label>
              <select
                v-model="draft.status"
                class="flex h-10 w-full rounded-md border border-border bg-surface-elevated px-3 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                <option v-for="s in statusOptions" :key="s.value" :value="s.value">
                  {{ s.label }}
                </option>
              </select>
              <p class="m-0 text-xs text-text-muted">仅「已发布」会出现在公开的作品集页面。</p>
            </div>
            <div class="flex-1 space-y-1.5">
              <Label class="text-sm font-medium">完成时间</Label>
              <Input v-model="draft.finishedAt" placeholder="YYYY-MM" class="font-mono" />
            </div>
          </div>

          <div class="flex items-center gap-3">
            <Label class="text-sm font-medium m-0">精选（首页「最近作品」优先展示）</Label>
            <Switch v-model:checked="draft.highlight" />
            <span v-if="draft.highlight" class="inline-flex items-center gap-1 text-xs text-brand">
              <Star class="size-3" /> Featured
            </span>
          </div>
        </CardContent>
      </Card>

      <!-- ==================== 底部操作条 ==================== -->
      <div
        class="sticky bottom-4 flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-surface-elevated/90 backdrop-blur px-4 py-3 shadow-lg"
      >
        <span class="text-xs text-text-muted inline-flex items-center gap-1.5 truncate">
          <Briefcase class="size-3.5 shrink-0" />
          {{ draft.title || '未命名作品' }}
        </span>
        <div class="flex items-center gap-2.5 shrink-0">
          <button type="button" class="btn-spec-b btn-spec-b--ghost" @click="goBack">取消</button>
          <button
            type="button"
            class="btn-spec-b btn-spec-b--primary"
            :disabled="submitting"
            @click="handleSave"
          >
            <Loader2 v-if="submitting" class="btn-spec-b__icon animate-spin" />
            <Save v-else class="btn-spec-b__icon" />
            <span>{{ submitting ? '保存中…' : '保存' }}</span>
          </button>
        </div>
      </div>
    </template>
  </article>
</template>
