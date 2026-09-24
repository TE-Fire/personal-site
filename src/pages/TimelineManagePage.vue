<script setup lang="ts">
/**
 * TimelineManagePage · 经历管理页（/admin/timeline，requiresAuth）
 *
 * 与作品集管理模式保持一致：
 *   · 新建/编辑跳转独立编辑器页（/admin/timeline/new、/admin/timeline/:id/edit）
 *   · 列表行内操作走 btn-spec-b 工具栏规范
 *   · 额外的「展示/隐藏」快捷开关（visible 字段），无需进编辑器即可上下架
 *
 * 数据流：
 *   onMounted → getAdminTimeline() 拉全部（含已隐藏）
 *   删除      → deleteTimelineNode（window.confirm 二次确认）→ 局部移除
 *   切换显隐  → updateTimelineNode(id, { visible }) → 局部更新
 */
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useToast } from '@/composables/useToast'
import {
  getAdminTimeline,
  deleteTimelineNode,
  updateTimelineNode,
  type TimelineNodeData,
} from '@/api/timeline'
import { nodeKindMeta } from '@/data'
import { Badge, Card, CardContent } from '@/components/ui'
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  History,
  Eye,
  EyeOff,
  ArrowUpRight,
} from 'lucide-vue-next'

defineOptions({ name: 'TimelineManagePage' })

const router = useRouter()
const toast = useToast()

/* ---------- 状态 ---------- */
const loading = ref(false)
const deletingId = ref<number | null>(null)
const togglingId = ref<number | null>(null)

/* ---------- 列表数据 ---------- */
const nodes = ref<TimelineNodeData[]>([])

/** kind → Badge variant（复用 data 层的元信息，保持公开页与后台配色一致） */
const kindBadgeVariant = computed<Record<string, 'default' | 'secondary' | 'outline' | 'destructive'>>(() => ({
  work: nodeKindMeta.work.badgeVariant,
  education: nodeKindMeta.education.badgeVariant,
  'open-source': nodeKindMeta['open-source'].badgeVariant,
  milestone: nodeKindMeta.milestone.badgeVariant,
}))

/** 时间区间展示文本 */
function periodText(n: TimelineNodeData): string {
  if (n.ongoing) return `${n.startedAt} – 至今`
  if (n.endedAt) return `${n.startedAt} – ${n.endedAt}`
  return `${n.startedAt}`
}

async function loadList() {
  loading.value = true
  try {
    nodes.value = await getAdminTimeline()
  } catch (e: any) {
    toast.danger('加载失败', e?.message || '无法获取经历列表，请刷新重试')
  } finally {
    loading.value = false
  }
}

onMounted(loadList)

/* ---------- 跳转编辑器 ---------- */
function openCreate() {
  router.push('/admin/timeline/new')
}

function openEdit(n: TimelineNodeData) {
  router.push(`/admin/timeline/${n.id}/edit`)
}

/* ---------- 展示 / 隐藏 ---------- */
async function toggleVisible(n: TimelineNodeData) {
  if (togglingId.value === n.id) return
  togglingId.value = n.id
  try {
    const updated = await updateTimelineNode(n.id, { visible: !n.visible })
    nodes.value = nodes.value.map((x) => (x.id === n.id ? updated : x))
    toast.success(updated.visible ? '已设为展示' : '已设为隐藏', updated.title)
  } catch (e: any) {
    toast.danger('操作失败', e?.message || '请稍后重试')
  } finally {
    togglingId.value = null
  }
}

/* ---------- 删除 ---------- */
async function handleDelete(n: TimelineNodeData) {
  if (deletingId.value === n.id) return
  if (!window.confirm(`确定删除经历「${n.title}」？该操作不可撤销。`)) return
  deletingId.value = n.id
  try {
    await deleteTimelineNode(n.id)
    nodes.value = nodes.value.filter((x) => x.id !== n.id)
    toast.success('已删除', n.title)
  } catch (e: any) {
    toast.danger('删除失败', e?.message || '请稍后重试')
  } finally {
    deletingId.value = null
  }
}
</script>

<template>
  <article class="max-w-5xl mx-auto space-y-6">
    <!-- ==================== 页头 ==================== -->
    <header class="flex flex-wrap items-start justify-between gap-4">
      <div class="space-y-1">
        <p class="m-0 text-xs font-mono text-brand uppercase tracking-wider">
          / admin / timeline
        </p>
        <h1 class="m-0 text-2xl md:text-3xl font-semibold tracking-tight">经历管理</h1>
        <p class="m-0 text-sm text-text-muted">
          管理「经历时间线」页面的节点，支持新建、编辑、删除与展示开关。按开始时间自动倒序排列，隐藏的节点不会在公开页显示。
        </p>
      </div>
      <!-- B 类规范按钮：44px · 1px 细边 · 图标 65% -->
      <div class="flex flex-wrap items-center gap-2.5">
        <button type="button" class="btn-spec-b btn-spec-b--outline" @click="router.push('/timeline')">
          <ArrowUpRight class="btn-spec-b__icon" />
          <span>查看公开页</span>
        </button>
        <button type="button" class="btn-spec-b btn-spec-b--primary" @click="openCreate">
          <Plus class="btn-spec-b__icon" />
          <span>新建经历</span>
        </button>
      </div>
    </header>

    <!-- ==================== 加载中 ==================== -->
    <div v-if="loading" class="flex items-center justify-center gap-2 py-16 text-text-muted">
      <Loader2 class="size-5 animate-spin" />
      <span class="text-sm">正在加载经历列表…</span>
    </div>

    <!-- ==================== 空状态 ==================== -->
    <div
      v-else-if="nodes.length === 0"
      class="rounded-lg border border-dashed border-border/70 bg-surface-muted/20 py-16 flex flex-col items-center justify-center gap-4 text-center"
    >
      <History class="size-8 text-text-muted" />
      <p class="m-0 text-text-muted text-sm">还没有任何经历节点，点击「新建经历」开始添加。</p>
      <button type="button" class="btn-spec-b btn-spec-b--outline" @click="openCreate">
        <Plus class="btn-spec-b__icon" />
        <span>新建经历</span>
      </button>
    </div>

    <!-- ==================== 经历列表 ==================== -->
    <div v-else class="space-y-3">
      <Card v-for="n in nodes" :key="n.id" class="overflow-hidden">
        <CardContent class="flex flex-wrap items-center gap-4 p-4">
          <!-- 左侧类型色点（与公开页节点染色一致） -->
          <div class="hidden sm:flex shrink-0 size-14 rounded-lg bg-surface-muted/40 items-center justify-center">
            <span
              class="size-3.5 rounded-full ring-4"
              :class="[nodeKindMeta[n.kind].dotClass, nodeKindMeta[n.kind].ringClass]"
            />
          </div>

          <!-- 中间信息 -->
          <div class="flex-1 min-w-[200px] space-y-1">
            <div class="flex flex-wrap items-center gap-2">
              <h3 class="m-0 text-base font-semibold text-text leading-snug">{{ n.title }}</h3>
              <Badge :variant="kindBadgeVariant[n.kind]" class="!py-0 !px-2">
                {{ nodeKindMeta[n.kind].label }}
              </Badge>
              <Badge v-if="n.ongoing" variant="default" class="!py-0 !px-2">进行中</Badge>
              <Badge v-if="!n.visible" variant="secondary" class="!py-0 !px-2">已隐藏</Badge>
            </div>
            <p v-if="n.subTitle" class="m-0 text-xs text-text-muted line-clamp-1">{{ n.subTitle }}</p>
            <div class="flex flex-wrap items-center gap-2 text-[11px] text-text-muted">
              <span class="font-mono">{{ periodText(n) }}</span>
              <span v-for="tag in n.tags" :key="tag" class="opacity-80">#{{ tag }}</span>
            </div>
          </div>

          <!-- 右侧操作（B 类工具栏规范：40px · 0.75px 极浅边 · 图标同比） -->
          <div class="flex items-center gap-2 shrink-0">
            <button
              type="button"
              class="btn-spec-b btn-spec-b--toolbar"
              :disabled="togglingId === n.id"
              :title="n.visible ? '设为隐藏' : '设为展示'"
              @click="toggleVisible(n)"
            >
              <Loader2 v-if="togglingId === n.id" class="btn-spec-b__icon animate-spin" />
              <EyeOff v-else-if="n.visible" class="btn-spec-b__icon" />
              <Eye v-else class="btn-spec-b__icon" />
              <span>{{ n.visible ? '隐藏' : '展示' }}</span>
            </button>
            <button type="button" class="btn-spec-b btn-spec-b--toolbar" @click="openEdit(n)">
              <Pencil class="btn-spec-b__icon" />
              <span>编辑</span>
            </button>
            <button
              type="button"
              class="btn-spec-b btn-spec-b--toolbar btn-spec-b--toolbar-danger"
              :disabled="deletingId === n.id"
              @click="handleDelete(n)"
            >
              <Loader2 v-if="deletingId === n.id" class="btn-spec-b__icon animate-spin" />
              <Trash2 v-else class="btn-spec-b__icon" />
              <span>删除</span>
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  </article>
</template>
