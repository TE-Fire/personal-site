<script setup lang="ts">
/**
 * PortfolioManagePage · 作品集管理页（/admin/portfolio，requiresAuth）
 *
 * 2026-09-23 UI 走查后重构：
 *   · 新建/编辑不再用弹窗表单，改为跳转独立编辑器页
 *     /admin/portfolio/new、/admin/portfolio/:id/edit（与博客/生活碎片一致）
 *   · 新增「分类与标签」词库管理弹窗（WorkVocabDialog）
 *   · 行内操作按钮统一走 btn-spec-b 工具栏规范（图标尺寸与文字同比，不再挤压）
 *
 * 数据流：
 *   onMounted → getAdminWorks() 拉列表
 *   删除      → deleteWork（window.confirm 二次确认）→ 局部移除
 *   词库变更  → WorkVocabDialog emit('changed') → 重新拉列表（分类徽标同步）
 */
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useToast } from '@/composables/useToast'
import { getAdminWorks, deleteWork, type WorkData } from '@/api/portfolio'
import { Badge, Card, CardContent } from '@/components/ui'
import WorkVocabDialog from '@/components/WorkVocabDialog.vue'
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Briefcase,
  Star,
  ExternalLink,
  FolderOpen,
} from 'lucide-vue-next'

defineOptions({ name: 'PortfolioManagePage' })

const router = useRouter()
const toast = useToast()

/* ---------- 状态 ---------- */
const loading = ref(false)
const deletingId = ref<number | null>(null)
const vocabOpen = ref(false)

/* ---------- 列表数据 ---------- */
const works = ref<WorkData[]>([])

/** 按 sortOrder 升序；同 sortOrder 时按 id 降序（新创建在前） */
const sortedWorks = computed(() =>
  [...works.value].sort((a, b) => {
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder
    return b.id - a.id
  }),
)

const statusBadgeVariant: Record<string, 'secondary' | 'default' | 'outline'> = {
  PUBLISHED: 'default',
  DRAFT: 'secondary',
  ARCHIVED: 'outline',
}

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

/* ---------- 跳转编辑器 ---------- */
function openCreate() {
  router.push('/admin/portfolio/new')
}

function openEdit(w: WorkData) {
  router.push(`/admin/portfolio/${w.id}/edit`)
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
      <!-- B 类规范按钮：44px · 1px 细边 · 图标 65% -->
      <div class="flex flex-wrap items-center gap-2.5">
        <button
          type="button"
          class="btn-spec-b btn-spec-b--outline"
          @click="vocabOpen = true"
        >
          <FolderOpen class="btn-spec-b__icon" />
          <span>分类与标签</span>
        </button>
        <button type="button" class="btn-spec-b btn-spec-b--primary" @click="openCreate">
          <Plus class="btn-spec-b__icon" />
          <span>新建项目</span>
        </button>
      </div>
    </header>

    <!-- ==================== 加载中 ==================== -->
    <div v-if="loading" class="flex items-center justify-center gap-2 py-16 text-text-muted">
      <Loader2 class="size-5 animate-spin" />
      <span class="text-sm">正在加载作品列表…</span>
    </div>

    <!-- ==================== 空状态 ==================== -->
    <div
      v-else-if="sortedWorks.length === 0"
      class="rounded-lg border border-dashed border-border/70 bg-surface-muted/20 py-16 flex flex-col items-center justify-center gap-4 text-center"
    >
      <Briefcase class="size-8 text-text-muted" />
      <p class="m-0 text-text-muted text-sm">还没有任何作品，点击「新建项目」开始添加。</p>
      <button type="button" class="btn-spec-b btn-spec-b--outline" @click="openCreate">
        <Plus class="btn-spec-b__icon" />
        <span>新建项目</span>
      </button>
    </div>

    <!-- ==================== 作品列表 ==================== -->
    <div v-else class="space-y-3">
      <Card v-for="w in sortedWorks" :key="w.id" class="overflow-hidden">
        <CardContent class="flex flex-wrap items-center gap-4 p-4">
          <!-- 左侧小封面：有图显示图，否则渐变兜底 -->
          <div
            :style="w.coverImage ? undefined : { backgroundImage: w.cover || 'none' }"
            class="hidden sm:flex shrink-0 size-14 rounded-lg overflow-hidden items-center justify-center"
          >
            <img
              v-if="w.coverImage"
              :src="w.coverImage"
              :alt="w.title"
              class="size-full object-cover"
            />
            <Briefcase v-else class="size-5 text-text-muted/70" />
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

          <!-- 右侧操作（B 类工具栏规范：40px · 0.75px 极浅边 · 图标同比） -->
          <div class="flex items-center gap-2 shrink-0">
            <a
              v-if="w.status === 'PUBLISHED'"
              :href="`/#/portfolio/${w.slug}`"
              target="_blank"
              rel="noopener noreferrer"
              class="btn-spec-b btn-spec-b--icon btn-spec-b--toolbar"
              :aria-label="`查看 ${w.title}`"
              :title="`查看 ${w.title}`"
            >
              <ExternalLink class="btn-spec-b__icon" />
            </a>
            <button type="button" class="btn-spec-b btn-spec-b--toolbar" @click="openEdit(w)">
              <Pencil class="btn-spec-b__icon" />
              <span>编辑</span>
            </button>
            <button
              type="button"
              class="btn-spec-b btn-spec-b--toolbar btn-spec-b--toolbar-danger"
              :disabled="deletingId === w.id"
              @click="handleDelete(w)"
            >
              <Loader2 v-if="deletingId === w.id" class="btn-spec-b__icon animate-spin" />
              <Trash2 v-else class="btn-spec-b__icon" />
              <span>删除</span>
            </button>
          </div>
        </CardContent>
      </Card>
    </div>

    <!-- ==================== 分类与标签管理弹窗 ==================== -->
    <WorkVocabDialog :open="vocabOpen" @close="vocabOpen = false" @changed="loadList" />
  </article>
</template>
