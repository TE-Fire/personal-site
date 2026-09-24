<script setup lang="ts">
/**
 * TimelineEditorPage · 经历新建/编辑页（/admin/timeline/new、/admin/timeline/:id/edit）
 *
 * 与作品集编辑器保持同一套交互规范：
 *   · 分区卡片（图标 + 标题）+ 底部 sticky 保存条
 *   · 标签不手输：已有标签以 chips 形式点选，也可现场新增（新增即入库到本条经历）
 *
 * 数据流：
 *   onMounted → getTimelineMeta() 拉候选标签
 *             → 编辑模式再 getAdminTimeline() 找到当前条目（无单条 admin 接口，列表量小直接查）
 *   保存      → createTimelineNode / updateTimelineNode → toast → 返回管理页
 *
 * 校验（前端拦截一遍，后端 assertDateRange 兜底）：
 *   · 标题、开始时间、描述必填
 *   · 时间格式 YYYY-MM（month 输入框天然保证）
 *   · 非「进行中」时结束时间不能早于开始时间
 */
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useToast } from '@/composables/useToast'
import {
  getTimelineMeta,
  getAdminTimeline,
  createTimelineNode,
  updateTimelineNode,
  TIMELINE_KIND_OPTIONS,
  type TimelineNodeData,
  type TimelineKindLower,
  type TimelineNodePayload,
} from '@/api/timeline'
import { Card, CardContent, Input, Label, Switch } from '@/components/ui'
import {
  ArrowLeft,
  Loader2,
  Save,
  History,
  FileText,
  CalendarRange,
  Tags,
  Eye,
  Tag,
  Plus,
} from 'lucide-vue-next'

defineOptions({ name: 'TimelineEditorPage' })

const props = defineProps<{ id?: string }>()

const router = useRouter()
const toast = useToast()

/* ---------- 状态 ---------- */
const loading = ref(true)
const submitting = ref(false)
const metaTags = ref<string[]>([])

/** 编辑模式下的条目 id（new 路由无 id） */
const nodeId = computed(() => (props.id ? Number(props.id) : null))
const isCreate = computed(() => nodeId.value == null)

/* ---------- 表单 ---------- */
interface DraftForm {
  kind: TimelineKindLower
  title: string
  subTitle: string
  startedAt: string
  endedAt: string
  ongoing: boolean
  description: string
  tags: string[]
  visible: boolean
}

function emptyDraft(): DraftForm {
  return {
    kind: 'work',
    title: '',
    subTitle: '',
    startedAt: new Date().toISOString().slice(0, 7),
    endedAt: '',
    ongoing: true,
    description: '',
    tags: [],
    visible: true,
  }
}

const draft = reactive<DraftForm>(emptyDraft())

/** 新标签输入框 */
const newTag = ref('')

function hydrateDraft(n: TimelineNodeData) {
  draft.kind = n.kind
  draft.title = n.title
  draft.subTitle = n.subTitle || ''
  draft.startedAt = n.startedAt
  draft.endedAt = n.endedAt || ''
  draft.ongoing = n.ongoing
  draft.description = n.description
  draft.tags = [...(n.tags || [])]
  draft.visible = n.visible
}

/* ---------- 加载 ---------- */
onMounted(async () => {
  loading.value = true
  try {
    const meta = await getTimelineMeta()
    metaTags.value = meta.tags
    if (!isCreate.value) {
      const list = await getAdminTimeline()
      const node = list.find((n) => n.id === nodeId.value)
      if (!node) {
        toast.danger('经历不存在', '可能已被删除，请返回列表刷新')
        router.replace('/admin/timeline')
        return
      }
      hydrateDraft(node)
    }
  } catch (e: any) {
    toast.danger('加载失败', e?.message || '无法获取经历数据')
  } finally {
    loading.value = false
  }
})

/* ---------- 标签点选 ---------- */
function toggleTag(tag: string) {
  const i = draft.tags.indexOf(tag)
  if (i >= 0) {
    draft.tags.splice(i, 1)
  } else if (draft.tags.length < 8) {
    draft.tags.push(tag)
  } else {
    toast.warn('标签过多', '单条经历最多 8 个标签')
  }
}

/** 新增自定义标签并立即选中（保存时随本条经历一并写入） */
function addCustomTag() {
  const t = newTag.value.trim()
  if (!t) return
  if (draft.tags.includes(t)) {
    toast.warn('标签重复', `「${t}」已在当前标签中`)
    newTag.value = ''
    return
  }
  if (draft.tags.length >= 8) {
    toast.warn('标签过多', '单条经历最多 8 个标签')
    return
  }
  draft.tags.push(t)
  if (!metaTags.value.includes(t)) metaTags.value.push(t)
  newTag.value = ''
}

/* ---------- 校验 ---------- */
function validate(): string | null {
  if (!draft.title.trim()) return '标题不能为空'
  if (!draft.startedAt) return '请选择开始时间'
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(draft.startedAt)) return '开始时间格式应为 YYYY-MM'
  if (!draft.ongoing && draft.endedAt) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(draft.endedAt)) return '结束时间格式应为 YYYY-MM'
    if (draft.endedAt < draft.startedAt) return '结束时间不能早于开始时间'
  }
  if (!draft.description.trim()) return '描述不能为空'
  return null
}

/* ---------- 保存 ---------- */
function buildPayload(): TimelineNodePayload {
  return {
    kind: draft.kind,
    title: draft.title.trim(),
    subTitle: draft.subTitle.trim(),
    startedAt: draft.startedAt,
    // 进行中时后端会强制清空结束时间，这里也一并清掉，避免脏值回显
    endedAt: draft.ongoing ? '' : draft.endedAt,
    ongoing: draft.ongoing,
    description: draft.description,
    tags: [...draft.tags],
    visible: draft.visible,
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
      const created = await createTimelineNode(buildPayload())
      toast.success('创建成功', created.title)
    } else {
      const updated = await updateTimelineNode(nodeId.value!, buildPayload())
      toast.success('保存成功', updated.title)
    }
    router.push('/admin/timeline')
  } catch (e: any) {
    toast.danger('保存失败', e?.message || '请稍后重试')
  } finally {
    submitting.value = false
  }
}

function goBack() {
  router.push('/admin/timeline')
}

/** 候选标签（排除已选中的，避免重复渲染） */
const availableTags = computed(() =>
  metaTags.value.filter((t) => !draft.tags.includes(t)),
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
          aria-label="返回经历管理"
          @click="goBack"
        >
          <ArrowLeft class="btn-spec-b__icon" />
        </button>
        <div class="space-y-1">
          <p class="m-0 text-xs font-mono text-brand uppercase tracking-wider">
            / admin / timeline / {{ isCreate ? 'new' : 'edit' }}
          </p>
          <h1 class="m-0 text-2xl md:text-3xl font-semibold tracking-tight">
            {{ isCreate ? '新建经历' : '编辑经历' }}
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
      <!-- ==================== 基础信息 ==================== -->
      <Card>
        <CardContent class="p-5 md:p-6 space-y-5">
          <h2 class="m-0 text-base font-semibold text-text flex items-center gap-2">
            <FileText class="size-5 text-brand" />
            基础信息
          </h2>

          <div class="flex flex-col md:flex-row gap-4">
            <div class="w-full md:w-48 space-y-1.5">
              <Label class="text-sm font-medium">节点类型 <span class="text-danger">*</span></Label>
              <select
                v-model="draft.kind"
                class="flex h-10 w-full rounded-md border border-border bg-surface-elevated px-3 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                <option v-for="opt in TIMELINE_KIND_OPTIONS" :key="opt.value" :value="opt.value">
                  {{ opt.label }}
                </option>
              </select>
              <p class="m-0 text-xs text-text-muted">决定节点颜色与徽标文案</p>
            </div>
            <div class="flex-1 space-y-1.5">
              <Label class="text-sm font-medium">标题 <span class="text-danger">*</span></Label>
              <Input v-model="draft.title" placeholder="如：某公司 · 前端工程师" maxlength="200" />
            </div>
          </div>

          <div class="space-y-1.5">
            <Label class="text-sm font-medium">副标题</Label>
            <Input
              v-model="draft.subTitle"
              maxlength="300"
              placeholder="如：主导产品线迁移 + 工程基建（可留空）"
            />
          </div>

          <div class="space-y-1.5">
            <Label class="text-sm font-medium">描述 <span class="text-danger">*</span></Label>
            <textarea
              v-model="draft.description"
              rows="6"
              placeholder="写清「我扮演什么角色」+「具体产出」，可用数字量化…支持换行"
              class="flex w-full rounded-md border border-border bg-surface-elevated px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
            />
          </div>
        </CardContent>
      </Card>

      <!-- ==================== 时间区间 ==================== -->
      <Card>
        <CardContent class="p-5 md:p-6 space-y-5">
          <h2 class="m-0 text-base font-semibold text-text flex items-center gap-2">
            <CalendarRange class="size-5 text-brand" />
            时间区间
          </h2>

          <div class="flex flex-col md:flex-row gap-4">
            <div class="flex-1 space-y-1.5">
              <Label class="text-sm font-medium">开始时间 <span class="text-danger">*</span></Label>
              <Input v-model="draft.startedAt" type="month" />
            </div>
            <div class="flex-1 space-y-1.5">
              <Label class="text-sm font-medium">结束时间</Label>
              <Input v-model="draft.endedAt" type="month" :disabled="draft.ongoing" />
              <p class="m-0 text-xs text-text-muted">
                {{ draft.ongoing ? '「进行中」时无需填写，公开页显示「至今」' : '留空则不显示结束时间' }}
              </p>
            </div>
          </div>

          <div class="flex items-center justify-between gap-4 rounded-lg border border-border/60 bg-surface-muted/30 px-4 py-3">
            <div class="space-y-0.5">
              <Label class="text-sm font-medium">进行中</Label>
              <p class="m-0 text-xs text-text-muted">开启后公开页显示「进行中」徽标 + 「至今」</p>
            </div>
            <Switch v-model="draft.ongoing" />
          </div>
        </CardContent>
      </Card>

      <!-- ==================== 标签 ==================== -->
      <Card>
        <CardContent class="p-5 md:p-6 space-y-5">
          <h2 class="m-0 text-base font-semibold text-text flex items-center gap-2">
            <Tags class="size-5 text-brand" />
            标签
          </h2>

          <!-- 已选标签 -->
          <div class="space-y-2">
            <Label class="text-sm font-medium">
              已选（{{ draft.tags.length }}/8）
            </Label>
            <div v-if="draft.tags.length" class="flex flex-wrap gap-2">
              <button
                v-for="tag in draft.tags"
                :key="tag"
                type="button"
                class="inline-flex items-center gap-1.5 rounded-full border border-brand/40 bg-brand/10 px-3 py-1 text-xs font-medium text-brand transition hover:bg-brand/15"
                :title="`点击移除 ${tag}`"
                @click="toggleTag(tag)"
              >
                <Tag class="size-3.5" />
                {{ tag }}
                <span class="opacity-60">×</span>
              </button>
            </div>
            <p v-else class="m-0 text-xs text-text-muted">还没有标签，从下方点选或新建。</p>
          </div>

          <!-- 候选标签（来自已有经历的全量去重） -->
          <div v-if="availableTags.length" class="space-y-2">
            <Label class="text-sm font-medium">从已有标签选择</Label>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="tag in availableTags"
                :key="tag"
                type="button"
                class="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-elevated px-3 py-1 text-xs text-text-muted transition hover:border-brand/40 hover:text-brand"
                @click="toggleTag(tag)"
              >
                <Tag class="size-3.5" />
                {{ tag }}
              </button>
            </div>
          </div>

          <!-- 新建标签 -->
          <div class="space-y-1.5">
            <Label class="text-sm font-medium">新增标签</Label>
            <div class="flex items-center gap-2.5">
              <Input
                v-model="newTag"
                placeholder="输入新标签，如 Design System"
                maxlength="20"
                @keyup.enter="addCustomTag"
              />
              <button type="button" class="btn-spec-b btn-spec-b--outline shrink-0" @click="addCustomTag">
                <Plus class="btn-spec-b__icon" />
                <span>添加</span>
              </button>
            </div>
            <p class="m-0 text-xs text-text-muted">
              新标签会随本条经历一起保存，之后可在其他经历中复用。
            </p>
          </div>
        </CardContent>
      </Card>

      <!-- ==================== 展示设置 ==================== -->
      <Card>
        <CardContent class="p-5 md:p-6 space-y-4">
          <h2 class="m-0 text-base font-semibold text-text flex items-center gap-2">
            <Eye class="size-5 text-brand" />
            展示设置
          </h2>
          <div class="flex items-center justify-between gap-4 rounded-lg border border-border/60 bg-surface-muted/30 px-4 py-3">
            <div class="space-y-0.5">
              <Label class="text-sm font-medium">在公开页展示</Label>
              <p class="m-0 text-xs text-text-muted">
                关闭后仅管理端可见，适合暂存还没写完的条目
              </p>
            </div>
            <Switch v-model="draft.visible" />
          </div>
        </CardContent>
      </Card>

      <!-- ==================== 底部操作条 ==================== -->
      <div
        class="sticky bottom-4 flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-surface-elevated/90 backdrop-blur px-4 py-3 shadow-lg"
      >
        <span class="text-xs text-text-muted inline-flex items-center gap-1.5 truncate">
          <History class="size-3.5 shrink-0" />
          {{ draft.title || '未命名经历' }}
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
