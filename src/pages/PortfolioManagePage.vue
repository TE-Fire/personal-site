<script setup lang="ts">
/**
 * PortfolioManagePage · 作品集管理页（/admin/portfolio，requiresAuth）
 *
 * 管理端 CRUD：
 *   · 列表展示所有作品（含草稿/归档），按 sortOrder 排序
 *   · 新建 / 编辑共用一个抽屉式弹窗表单
 *   · 删除需 window.confirm 二次确认
 *
 * 数据流：
 *   onMounted → getAdminWorks() 拉列表
 *   保存     → createWork / updateWork → toast 反馈 → 局部刷新列表
 *   删除     → deleteWork → toast 反馈 → 局部移除
 *
 * 风格参考 ContactManagePage：inline Label + Input 横排、Card 分区、页头操作按钮。
 */
import { computed, onMounted, reactive, ref } from 'vue'
import { useToast } from '@/composables/useToast'
import {
  getAdminWorks,
  createWork,
  updateWork,
  deleteWork,
  type WorkData,
} from '@/api/portfolio'
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Switch,
} from '@/components/ui'
import {
  Plus,
  Pencil,
  Trash2,
  Save,
  Loader2,
  X,
  Briefcase,
  Star,
  ExternalLink,
} from 'lucide-vue-next'

defineOptions({ name: 'PortfolioManagePage' })

const toast = useToast()

/* ---------- 加载 / 提交状态 ---------- */
const loading = ref(false)      // 列表加载
const submitting = ref(false)   // 表单保存中
const deletingId = ref<number | null>(null)  // 删除中的 id

/* ---------- 列表数据 ---------- */
const works = ref<WorkData[]>([])

/** 按 sortOrder 升序；同 sortOrder 时按 id 降序（新创建在前） */
const sortedWorks = computed(() =>
  [...works.value].sort((a, b) => {
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder
    return b.id - a.id
  }),
)

/* ---------- 分类 / 状态 候选值 ---------- */
const categoryOptions = ['Web 应用', '独立项目', '开源协作', '设计系统']
const statusOptions: Array<'DRAFT' | 'PUBLISHED' | 'ARCHIVED'> = [
  'DRAFT',
  'PUBLISHED',
  'ARCHIVED',
]

const statusBadgeVariant: Record<string, 'secondary' | 'default' | 'outline'> = {
  PUBLISHED: 'default',
  DRAFT: 'secondary',
  ARCHIVED: 'outline',
}

/* ---------- 编辑弹窗 ---------- */
const dialogOpen = ref(false)
/** 当前编辑的作品 id；null 表示新建 */
const editingId = ref<number | null>(null)

/** 表单草稿：扁平结构，提交时按需组装为 WorkData 局部字段 */
interface DraftForm {
  slug: string
  title: string
  summary: string
  description: string
  cover: string
  tagsInput: string // 逗号分隔
  category: string
  homepage: string
  repo: string
  demo: string
  finishedAt: string // YYYY-MM
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
    // 默认渐变色（与列表 mock 第一个色阶接近）
    cover: 'from-brand/30 via-accent/30 to-chart-c1/30',
    tagsInput: '',
    category: categoryOptions[0],
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

/** 把 WorkData 填入 draft，用于编辑 */
function hydrateDraft(w: WorkData) {
  draft.slug = w.slug
  draft.title = w.title
  draft.summary = w.summary
  draft.description = w.description
  draft.cover = w.cover
  draft.tagsInput = (w.tags || []).join(', ')
  draft.category = w.category
  draft.homepage = w.links?.homepage ?? ''
  draft.repo = w.links?.repo ?? ''
  draft.demo = w.links?.demo ?? ''
  draft.finishedAt = (w.finishedAt || '').slice(0, 7)
  draft.highlight = !!w.highlight
  draft.sortOrder = w.sortOrder ?? 0
  draft.status = (w.status as DraftForm['status']) || 'DRAFT'
}

/* ---------- 列表加载 ---------- */
async function loadList() {
  loading.value = true
  try {
    works.value = await getAdminWorks()
  } catch (e: any) {
    toast.danger('加载失败', e?.message || '无法获取作品列表，请刷新重试')
  } finally {
    loading.value = false
  }
}

onMounted(loadList)

/* ---------- 打开弹窗 ---------- */
function openCreate() {
  editingId.value = null
  Object.assign(draft, emptyDraft())
  dialogOpen.value = true
}

function openEdit(w: WorkData) {
  editingId.value = w.id
  hydrateDraft(w)
  dialogOpen.value = true
}

function closeDialog() {
  if (submitting.value) return
  dialogOpen.value = false
  editingId.value = null
}

/* ---------- 表单校验（轻量） ---------- */
function validate(): string | null {
  if (!draft.slug.trim()) return 'slug 不能为空'
  if (!/^[a-z0-9-]+$/.test(draft.slug)) return 'slug 只能包含小写字母、数字和短横线'
  if (!draft.title.trim()) return '标题不能为空'
  if (!draft.category) return '请选择分类'
  if (draft.finishedAt && !/^\d{4}-\d{2}$/.test(draft.finishedAt))
    return '完成时间格式应为 YYYY-MM'
  return null
}

/** 把 draft 组装为后端 WorkData 局部字段 */
function buildPayload(): Partial<WorkData> {
  const tags = draft.tagsInput
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)
  const links: WorkData['links'] = {}
  if (draft.homepage) links.homepage = draft.homepage
  if (draft.repo) links.repo = draft.repo
  if (draft.demo) links.demo = draft.demo
  return {
    slug: draft.slug.trim(),
    title: draft.title.trim(),
    summary: draft.summary.trim(),
    description: draft.description,
    cover: draft.cover.trim(),
    tags,
    category: draft.category,
    links,
    finishedAt: draft.finishedAt,
    highlight: draft.highlight,
    sortOrder: Number(draft.sortOrder) || 0,
    status: draft.status,
  }
}

/* ---------- 保存 ---------- */
async function handleSave() {
  if (submitting.value) return
  const err = validate()
  if (err) {
    toast.warn('表单不完整', err)
    return
  }
  submitting.value = true
  const payload = buildPayload()
  try {
    if (editingId.value == null) {
      const created = await createWork(payload)
      works.value.push(created)
      toast.success('创建成功', `${created.title} 已新增`)
    } else {
      const updated = await updateWork(editingId.value, payload)
      const idx = works.value.findIndex((w) => w.id === editingId.value)
      if (idx >= 0) works.value[idx] = updated
      toast.success('保存成功', `${updated.title} 已同步`)
    }
    dialogOpen.value = false
    editingId.value = null
  } catch (e: any) {
    toast.danger('保存失败', e?.message || '请稍后重试')
  } finally {
    submitting.value = false
  }
}

/* ---------- 删除 ---------- */
async function handleDelete(w: WorkData) {
  if (deletingId.value === w.id) return
  if (!window.confirm(`确定删除作品「${w.title}」？该操作不可撤销。`)) return
  deletingId.value = w.id
  try {
    await deleteWork(w.id)
    works.value = works.value.filter((x) => x.id !== w.id)
    toast.success('已删除', w.title)
  } catch (e: any) {
    toast.danger('删除失败', e?.message || '请稍后重试')
  } finally {
    deletingId.value = null
  }
}

/* ---------- 弹窗遮罩点击关闭 ---------- */
function onMaskClick() {
  closeDialog()
}
</script>

<template>
  <article class="max-w-5xl mx-auto space-y-6">
    <!-- ==================== 页头 ==================== -->
    <header class="flex flex-wrap items-start justify-between gap-4">
      <div class="space-y-1">
        <p class="m-0 text-xs font-mono text-brand uppercase tracking-wider">
          / admin / portfolio
        </p>
        <h1 class="m-0 text-2xl md:text-3xl font-semibold tracking-tight">作品集管理</h1>
        <p class="m-0 text-sm text-text-muted">
          管理对外展示的项目，支持新建、编辑、删除与排序。草稿/归档不会在公开列表显示。
        </p>
      </div>
      <Button type="button" class="h-9 px-4 shadow hover:shadow-md transition-shadow" @click="openCreate">
        <Plus class="size-4" />
        <span>新建项目</span>
      </Button>
    </header>

    <!-- ==================== 加载中 ==================== -->
    <div
      v-if="loading"
      class="flex items-center justify-center gap-2 py-16 text-text-muted"
    >
      <Loader2 class="size-5 animate-spin" />
      <span class="text-sm">正在加载作品列表…</span>
    </div>

    <!-- ==================== 空状态 ==================== -->
    <div
      v-else-if="sortedWorks.length === 0"
      class="rounded-lg border border-dashed border-border/70 bg-surface-muted/20 py-16 flex flex-col items-center justify-center gap-3 text-center"
    >
      <Briefcase class="size-8 text-text-muted" />
      <p class="m-0 text-text-muted text-sm">还没有任何作品，点击「新建项目」开始添加。</p>
      <Button size="sm" variant="outline" @click="openCreate">
        <Plus class="size-4" />
        新建项目
      </Button>
    </div>

    <!-- ==================== 作品列表 ==================== -->
    <div v-else class="space-y-3">
      <Card
        v-for="w in sortedWorks"
        :key="w.id"
        class="overflow-hidden"
      >
        <CardContent class="flex flex-wrap items-center gap-4 p-4">
          <!-- 左侧渐变小封面 -->
          <div
            :class="[
              'hidden sm:flex shrink-0 size-14 rounded-lg bg-gradient-to-br items-center justify-center',
              w.cover
            ]"
          >
            <Briefcase class="size-5 text-text-muted/70" />
          </div>

          <!-- 中间信息 -->
          <div class="flex-1 min-w-[200px] space-y-1">
            <div class="flex flex-wrap items-center gap-2">
              <h3 class="m-0 text-base font-semibold text-text leading-snug">{{ w.title }}</h3>
              <Badge v-if="w.highlight" variant="default" class="gap-1 !px-1.5">
                <Star class="size-3" /> 精选
              </Badge>
            </div>
            <p class="m-0 text-xs text-text-muted line-clamp-1">
              {{ w.summary || w.description || '—' }}
            </p>
            <div class="flex flex-wrap items-center gap-2 text-[11px] text-text-muted">
              <Badge variant="outline" class="!py-0">{{ w.category }}</Badge>
              <Badge :variant="statusBadgeVariant[w.status] || 'secondary'" class="!py-0">
                {{ w.status }}
              </Badge>
              <span class="font-mono">sort: {{ w.sortOrder }}</span>
              <span class="font-mono">{{ w.finishedAt }}</span>
              <span class="font-mono truncate max-w-[180px]">/ {{ w.slug }}</span>
            </div>
          </div>

          <!-- 右侧操作 -->
          <div class="flex items-center gap-2 shrink-0">
            <a
              v-if="w.status === 'PUBLISHED'"
              :href="`/#/portfolio/${w.slug}`"
              target="_blank"
              rel="noopener noreferrer"
              class="inline-flex size-8 items-center justify-center rounded-md text-text-muted hover:text-brand hover:bg-surface-muted/40 transition"
              :aria-label="`查看 ${w.title}`"
            >
              <ExternalLink class="size-4" />
            </a>
            <Button size="sm" variant="outline" @click="openEdit(w)">
              <Pencil class="size-3.5" />
              <span class="hidden sm:inline">编辑</span>
            </Button>
            <Button
              size="sm"
              variant="outline"
              :disabled="deletingId === w.id"
              class="!text-danger hover:!bg-danger/10 hover:!border-danger/40"
              @click="handleDelete(w)"
            >
              <Loader2 v-if="deletingId === w.id" class="size-3.5 animate-spin" />
              <Trash2 v-else class="size-3.5" />
              <span class="hidden sm:inline">删除</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>

    <!-- ==================== 编辑弹窗（Teleport to body） ==================== -->
    <Teleport to="body">
      <Transition name="fade">
        <div
          v-if="dialogOpen"
          class="fixed inset-0 z-50 flex items-start justify-center p-4 md:p-8 overflow-y-auto"
          role="dialog"
          aria-modal="true"
        >
          <!-- 遮罩 -->
          <div
            class="fixed inset-0 bg-black/50 backdrop-blur-sm"
            @click="onMaskClick"
          />

          <!-- 弹窗主体 -->
          <div
            class="relative z-10 w-full max-w-2xl my-6 rounded-2xl border border-border/60 bg-surface-elevated shadow-2xl"
          >
            <!-- 弹窗头 -->
            <div class="flex items-center justify-between gap-4 px-6 py-4 border-b border-border/60">
              <div class="space-y-0.5">
                <p class="m-0 text-xs font-mono text-brand uppercase tracking-wider">
                  / admin / portfolio / {{ editingId == null ? 'new' : 'edit' }}
                </p>
                <h2 class="m-0 text-lg font-semibold text-text">
                  {{ editingId == null ? '新建作品' : '编辑作品' }}
                </h2>
              </div>
              <Button variant="ghost" size="icon" :disabled="submitting" @click="closeDialog">
                <X class="size-4" />
              </Button>
            </div>

            <!-- 弹窗正文：表单 -->
            <div class="px-6 py-5 space-y-5 max-h-[70vh] overflow-y-auto">
              <!-- slug + sortOrder 横排 -->
              <div class="flex flex-col md:flex-row gap-4">
                <div class="flex-1 space-y-1.5">
                  <Label class="text-sm font-medium">Slug <span class="text-danger">*</span></Label>
                  <Input v-model="draft.slug" placeholder="唯一标识，如 my-project" class="font-mono" />
                  <p class="m-0 text-xs text-text-muted">只能小写字母/数字/短横线，作为 URL 末段。</p>
                </div>
                <div class="w-full md:w-32 space-y-1.5">
                  <Label class="text-sm font-medium">排序号</Label>
                  <Input v-model="draft.sortOrder" type="number" placeholder="0" />
                </div>
              </div>

              <!-- 标题 -->
              <div class="space-y-1.5">
                <Label class="text-sm font-medium">标题 <span class="text-danger">*</span></Label>
                <Input v-model="draft.title" placeholder="项目名称" />
              </div>

              <!-- 摘要 -->
              <div class="space-y-1.5">
                <Label class="text-sm font-medium">摘要</Label>
                <Input
                  v-model="draft.summary"
                  maxlength="160"
                  placeholder="一句话概括（列表卡片 + 详情页 hero 上展示）"
                />
              </div>

              <!-- 描述 -->
              <div class="space-y-1.5">
                <Label class="text-sm font-medium">描述</Label>
                <textarea
                  v-model="draft.description"
                  rows="4"
                  placeholder="详细描述，支持换行"
                  class="flex w-full rounded-md border border-border bg-surface-elevated px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
                />
              </div>

              <!-- 分类 + 状态 -->
              <div class="flex flex-col md:flex-row gap-4">
                <div class="flex-1 space-y-1.5">
                  <Label class="text-sm font-medium">分类</Label>
                  <select
                    v-model="draft.category"
                    class="flex h-9 w-full rounded-md border border-border bg-surface-elevated px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                  >
                    <option v-for="c in categoryOptions" :key="c" :value="c">{{ c }}</option>
                  </select>
                </div>
                <div class="flex-1 space-y-1.5">
                  <Label class="text-sm font-medium">状态</Label>
                  <select
                    v-model="draft.status"
                    class="flex h-9 w-full rounded-md border border-border bg-surface-elevated px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                  >
                    <option v-for="s in statusOptions" :key="s" :value="s">{{ s }}</option>
                  </select>
                </div>
              </div>

              <!-- 封面渐变 -->
              <div class="space-y-1.5">
                <Label class="text-sm font-medium">封面渐变</Label>
                <Input
                  v-model="draft.cover"
                  placeholder="Tailwind from-via-to 表达式，如 from-brand/30 via-accent/30 to-chart-c1/30"
                  class="font-mono text-xs"
                />
                <div
                  :class="['mt-2 h-16 rounded-lg bg-gradient-to-br border border-border/60', draft.cover || 'from-brand/30 via-accent/30 to-chart-c1/30']"
                />
                <p class="m-0 text-xs text-text-muted">写入 bg-gradient-to-br class 的 from/via/to 部分。</p>
              </div>

              <!-- 标签 -->
              <div class="space-y-1.5">
                <Label class="text-sm font-medium">技术标签</Label>
                <Input
                  v-model="draft.tagsInput"
                  placeholder="用英文逗号分隔，如 Vue 3, Vite, Tailwind"
                />
                <p class="m-0 text-xs text-text-muted">保存时会自动拆分为数组。</p>
              </div>

              <!-- 链接区 -->
              <div class="space-y-1.5">
                <Label class="text-sm font-medium">链接</Label>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <Input v-model="draft.homepage" placeholder="主页 URL" />
                  <Input v-model="draft.repo" placeholder="仓库 URL" />
                  <Input v-model="draft.demo" placeholder="Demo URL" />
                </div>
              </div>

              <!-- 完成时间 + 精选 -->
              <div class="flex flex-col md:flex-row gap-4">
                <div class="flex-1 space-y-1.5">
                  <Label class="text-sm font-medium">完成时间</Label>
                  <Input v-model="draft.finishedAt" placeholder="YYYY-MM" class="font-mono" />
                </div>
                <div class="flex items-end gap-3 pb-1">
                  <Label class="text-sm font-medium m-0">精选</Label>
                  <Switch v-model:checked="draft.highlight" />
                  <span v-if="draft.highlight" class="inline-flex items-center gap-1 text-xs text-brand">
                    <Star class="size-3" /> Featured
                  </span>
                </div>
              </div>
            </div>

            <!-- 弹窗底 -->
            <div class="flex items-center justify-end gap-2 px-6 py-4 border-t border-border/60 bg-surface-muted/30 rounded-b-2xl">
              <Button variant="ghost" :disabled="submitting" @click="closeDialog">取消</Button>
              <Button :disabled="submitting" @click="handleSave">
                <Loader2 v-if="submitting" class="size-4 animate-spin" />
                <Save v-else class="size-4" />
                <span>{{ submitting ? '保存中…' : '保存' }}</span>
              </Button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </article>
</template>

<style scoped>
/* 弹窗淡入淡出 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
