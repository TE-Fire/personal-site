<script setup lang="ts">
/**
 * WorkVocabDialog.vue · 作品集「分类与标签」词库管理弹窗
 *
 * 数据源：打开时调 GET /api/portfolio/admin/meta（词库表 ∪ 作品实际使用值的并集）。
 * 增删改均调后端：POST / PUT / DELETE /api/portfolio/admin/meta/:kind
 *   · 重命名 = 合并：目标名已存在时，作品全部归并到目标名
 *   · 删除标签：后端把该标签从所有作品中剥离
 *   · 删除分类：仍被作品引用时后端拒绝（提示先合并）
 *
 * 由父级通过 `open` prop 驱动显隐，关闭时 emit('close')；
 * 每次改动成功后 emit('changed')，让父级刷新作品列表。
 */
import { computed, ref, watch } from 'vue'
import {
  getWorkMeta,
  addVocab,
  renameVocab,
  deleteVocab,
  type WorkMeta,
  type VocabKind,
} from '@/api/portfolio'
import { useToast } from '@/composables/useToast'
import { Input } from '@/components/ui'
import { Plus, Pencil, Trash2, Check, X, FolderOpen, Tags, Loader2 } from 'lucide-vue-next'

interface Props {
  open: boolean
}
const props = defineProps<Props>()
const emit = defineEmits<{ close: []; changed: [] }>()

const toast = useToast()

/* ---------- 数据 ---------- */
const meta = ref<WorkMeta>({ categories: [], tags: [] })
const loading = ref(false)
const operating = ref(false) // 任一写操作进行中

/** 当前 tab：CATEGORY=分类 / TAG=标签 */
const activeKind = ref<VocabKind>('CATEGORY')

const items = computed(() =>
  activeKind.value === 'CATEGORY' ? meta.value.categories : meta.value.tags,
)

async function loadMeta() {
  loading.value = true
  try {
    meta.value = await getWorkMeta()
  } catch (e: any) {
    toast.danger('词库加载失败', e?.message || '请稍后重试')
  } finally {
    loading.value = false
  }
}

watch(
  () => props.open,
  (open) => {
    if (open) loadMeta()
  },
)

/* ---------------- 新增 ---------------- */
const newName = ref('')

async function onAdd() {
  const name = newName.value.trim()
  if (!name) return
  operating.value = true
  try {
    await addVocab(activeKind.value, name)
    newName.value = ''
    await loadMeta()
    emit('changed')
    toast.success('已新增', name)
  } catch (e: any) {
    toast.danger('新增失败', e?.message || '请稍后重试')
  } finally {
    operating.value = false
  }
}

/* ---------------- 内联重命名（= 合并） ---------------- */
const editingName = ref<string | null>(null)
const editingValue = ref('')

function startRename(name: string) {
  editingName.value = name
  editingValue.value = name
}

function cancelRename() {
  editingName.value = null
  editingValue.value = ''
}

async function confirmRename() {
  const from = editingName.value
  const to = editingValue.value.trim()
  if (!from || !to || from === to) {
    cancelRename()
    return
  }
  operating.value = true
  try {
    await renameVocab(activeKind.value, from, to)
    editingName.value = null
    editingValue.value = ''
    await loadMeta()
    emit('changed')
    toast.success(
      items.value.includes(to) ? '已合并' : '已重命名',
      `「${from}」→「${to}」`,
    )
  } catch (e: any) {
    toast.danger('操作失败', e?.message || '请稍后重试')
  } finally {
    operating.value = false
  }
}

/* ---------------- 删除（内联二次确认） ---------------- */
const confirmingDelete = ref<string | null>(null)

function askDelete(name: string) {
  confirmingDelete.value = name
}

function cancelDelete() {
  confirmingDelete.value = null
}

async function confirmDelete(name: string) {
  operating.value = true
  try {
    await deleteVocab(activeKind.value, name)
    confirmingDelete.value = null
    await loadMeta()
    emit('changed')
    toast.success('已删除', name)
  } catch (e: any) {
    confirmingDelete.value = null
    toast.danger('删除失败', e?.message || '请稍后重试')
  } finally {
    operating.value = false
  }
}

const kindLabel = computed(() => (activeKind.value === 'CATEGORY' ? '分类' : '标签'))
</script>

<template>
  <Teleport to="body">
    <Transition name="modal-overlay" appear>
      <div
        v-if="open"
        class="fixed inset-0 z-[100] flex items-center justify-center px-4 py-8"
        role="dialog"
        aria-modal="true"
        aria-label="作品集分类与标签管理"
      >
        <!-- 遮罩 -->
        <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" @click="emit('close')" />

        <Transition name="modal-card" appear>
          <div
            class="relative z-10 w-full max-w-lg rounded-2xl border border-border/60 bg-surface-elevated shadow-2xl flex flex-col max-h-[80vh]"
          >
            <!-- 头 -->
            <div class="flex items-start justify-between gap-4 px-6 py-4 border-b border-border/60">
              <div class="space-y-0.5">
                <p class="m-0 text-xs font-mono text-brand uppercase tracking-wider">
                  / admin / portfolio / vocab
                </p>
                <h2 class="m-0 text-lg font-semibold text-text">分类与标签管理</h2>
              </div>
              <button
                type="button"
                class="btn-spec-b btn-spec-b--icon btn-spec-b--ghost !h-9 !w-9"
                aria-label="关闭"
                @click="emit('close')"
              >
                <X class="btn-spec-b__icon" />
              </button>
            </div>

            <!-- Tab 切换 -->
            <div class="flex items-center gap-2 px-6 pt-4">
              <button
                type="button"
                class="inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium transition"
                :class="activeKind === 'CATEGORY'
                  ? 'bg-brand/10 text-brand border border-brand/30'
                  : 'text-text-muted border border-transparent hover:bg-surface-muted/60'"
                @click="activeKind = 'CATEGORY'; cancelRename(); cancelDelete()"
              >
                <FolderOpen class="size-4" />
                分类
                <span class="text-xs opacity-70">({{ meta.categories.length }})</span>
              </button>
              <button
                type="button"
                class="inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium transition"
                :class="activeKind === 'TAG'
                  ? 'bg-brand/10 text-brand border border-brand/30'
                  : 'text-text-muted border border-transparent hover:bg-surface-muted/60'"
                @click="activeKind = 'TAG'; cancelRename(); cancelDelete()"
              >
                <Tags class="size-4" />
                标签
                <span class="text-xs opacity-70">({{ meta.tags.length }})</span>
              </button>
            </div>

            <!-- 新增 -->
            <div class="px-6 pt-4">
              <div class="flex items-center gap-2">
                <Input
                  v-model="newName"
                  :placeholder="`新增${kindLabel}，如「${activeKind === 'CATEGORY' ? '开源协作' : 'Three.js'}」`"
                  maxlength="50"
                  @keyup.enter="onAdd"
                />
                <button
                  type="button"
                  class="btn-spec-b btn-spec-b--primary shrink-0"
                  :disabled="operating || !newName.trim()"
                  @click="onAdd"
                >
                  <Plus class="btn-spec-b__icon" />
                  <span>新增</span>
                </button>
              </div>
            </div>

            <!-- 列表 -->
            <div class="flex-1 min-h-0 overflow-y-auto px-6 py-4 space-y-1.5">
              <div v-if="loading" class="flex items-center justify-center gap-2 py-10 text-text-muted">
                <Loader2 class="size-5 animate-spin" />
                <span class="text-sm">加载中…</span>
              </div>

              <p v-else-if="items.length === 0" class="m-0 py-10 text-center text-sm text-text-muted">
                还没有任何{{ kindLabel }}，在上方输入框新增一个。
              </p>

              <template v-else>
                <div
                  v-for="name in items"
                  :key="name"
                  class="group flex items-center gap-2 rounded-lg border border-transparent px-3 py-2 transition hover:border-border/60 hover:bg-surface-muted/40"
                >
                  <!-- 重命名态 -->
                  <template v-if="editingName === name">
                    <Input v-model="editingValue" maxlength="50" class="h-8 text-sm" @keyup.enter="confirmRename" />
                    <button
                      type="button"
                      class="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-success hover:bg-success/10 transition"
                      :disabled="operating"
                      aria-label="确认"
                      @click="confirmRename"
                    >
                      <Check class="size-4" />
                    </button>
                    <button
                      type="button"
                      class="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-text-muted hover:bg-surface-muted transition"
                      :disabled="operating"
                      aria-label="取消"
                      @click="cancelRename"
                    >
                      <X class="size-4" />
                    </button>
                  </template>

                  <!-- 删除确认态 -->
                  <template v-else-if="confirmingDelete === name">
                    <span class="flex-1 text-sm text-text">
                      确定删除
                      <strong>{{ name }}</strong>
                      ？<template v-if="activeKind === 'TAG'">会从所有作品中移除该标签。</template>
                      <template v-else>仅未被作品使用时允许删除。</template>
                    </span>
                    <button
                      type="button"
                      class="btn-spec-b btn-spec-b--danger shrink-0 !h-8"
                      :disabled="operating"
                      @click="confirmDelete(name)"
                    >
                      <Check class="btn-spec-b__icon" />
                      <span>确认</span>
                    </button>
                    <button
                      type="button"
                      class="btn-spec-b btn-spec-b--ghost shrink-0 !h-8"
                      :disabled="operating"
                      @click="cancelDelete"
                    >
                      <X class="btn-spec-b__icon" />
                    </button>
                  </template>

                  <!-- 默认态 -->
                  <template v-else>
                    <span class="flex-1 text-sm text-text truncate">
                      {{ activeKind === 'TAG' ? '#' : '' }}{{ name }}
                    </span>
                    <button
                      type="button"
                      class="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-text-muted opacity-0 group-hover:opacity-100 hover:text-brand hover:bg-brand/10 transition"
                      :disabled="operating"
                      :aria-label="`重命名 ${name}`"
                      @click="startRename(name)"
                    >
                      <Pencil class="size-4" />
                    </button>
                    <button
                      type="button"
                      class="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-text-muted opacity-0 group-hover:opacity-100 hover:text-danger hover:bg-danger/10 transition"
                      :disabled="operating"
                      :aria-label="`删除 ${name}`"
                      @click="askDelete(name)"
                    >
                      <Trash2 class="size-4" />
                    </button>
                  </template>
                </div>
              </template>
            </div>

            <!-- 底部说明 -->
            <div class="px-6 py-3.5 border-t border-border/60 bg-surface-muted/30 rounded-b-2xl">
              <p class="m-0 text-xs text-text-muted leading-relaxed">
                重命名到已有名称即「合并」：原{{ kindLabel }}下的作品会全部归并过去；改动会即时同步到公开页面。
              </p>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-overlay-enter-active,
.modal-overlay-leave-active {
  transition: opacity 0.22s ease;
}
.modal-overlay-enter-from,
.modal-overlay-leave-to {
  opacity: 0;
}

.modal-card-enter-active,
.modal-card-leave-active {
  transition:
    opacity 0.22s ease,
    transform 0.28s cubic-bezier(0.22, 1, 0.36, 1);
}
.modal-card-enter-from {
  opacity: 0;
  transform: translateY(14px) scale(0.96);
}
.modal-card-leave-to {
  opacity: 0;
  transform: translateY(6px) scale(0.985);
}

@media (prefers-reduced-motion: reduce) {
  .modal-overlay-enter-active,
  .modal-overlay-leave-active,
  .modal-card-enter-active,
  .modal-card-leave-active {
    transition: none;
  }
  .modal-card-enter-from,
  .modal-card-leave-to {
    transform: none;
  }
}
</style>
