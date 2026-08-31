<script setup lang="ts">
/**
 * CategoryManageDialog.vue · 博客分类管理弹窗
 *
 * 数据源：打开时调 GET /api/categories 拉取真实分类（含 postCount）。
 * 增删改均调后端接口（POST/PUT/DELETE /api/categories），不再走 localStorage。
 *
 * 功能：
 *   · 列表：分类名 + 文章数徽标 + 重命名 / 删除
 *   · 新增：顶部输入 + 添加按钮
 *   · 内联重命名：编辑态切为 input + 确认/取消
 *   · 删除二次确认：内联确认 + 至少保留 1 个分类
 *   · 反馈：新增/重命名/删除失败时（重名等）显示轻提示
 *
 * 由父级通过 `open` prop 驱动显隐，关闭时 emit('close')。
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  fetchCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} from '@/api/category'
import type { CategoryVo } from '@/lib/api-types'
import { Button, Card, Input, Label } from '@/components/ui'
import { Plus, Pencil, Trash2, Check, X, FolderOpen } from 'lucide-vue-next'

interface Props {
  open: boolean
}
const props = defineProps<Props>()
const emit = defineEmits<{ close: [] }>()

const categories = ref<CategoryVo[]>([])
const isLoading = ref(false)

async function loadCategories() {
  isLoading.value = true
  try {
    categories.value = await fetchCategories()
  } catch {
    /* 静默失败，列表保持原状 */
  } finally {
    isLoading.value = false
  }
}

/** 仅剩 1 个分类时禁止删除 */
const canDeleteAny = computed(() => categories.value.length > 1)

/* ---------------- 新增 ---------------- */

const newCategoryName = ref('')

async function onAdd() {
  const name = newCategoryName.value.trim()
  if (!name) return
  try {
    const created = await createCategory({ name })
    categories.value = [...categories.value, created]
    newCategoryName.value = ''
    showFeedback('success', `已添加「${name}」`)
  } catch (e) {
    showFeedback('error', (e as Error).message || '添加失败：名称为空或已存在')
  }
}

/* ---------------- 内联重命名 ---------------- */

const editingId = ref<number | null>(null)
const editingName = ref('')

async function startEdit(cat: CategoryVo) {
  editingId.value = cat.id
  editingName.value = cat.name
  confirmingDelete.value = null
  await nextTick()
  editInputEl.value?.focus()
  editInputEl.value?.select?.()
}

function cancelEdit() {
  editingId.value = null
  editingName.value = ''
}

async function confirmRename() {
  if (!editingId.value) return
  const newName = editingName.value.trim()
  if (!newName) {
    showFeedback('error', '名称不能为空')
    return
  }
  const old = categories.value.find((c) => c.id === editingId.value)
  if (old && newName === old.name) {
    cancelEdit()
    return
  }
  try {
    const updated = await updateCategory(editingId.value, { name: newName })
    categories.value = categories.value.map((c) => (c.id === updated.id ? updated : c))
    cancelEdit()
    showFeedback('success', `已重命名为「${newName}」`)
  } catch (e) {
    showFeedback('error', (e as Error).message || '重命名失败：名称为空或已存在')
  }
}

/* ---------------- 删除二次确认 ---------------- */

const confirmingDelete = ref<number | null>(null)

function startDeleteConfirm(cat: CategoryVo) {
  if (!canDeleteAny.value) return
  confirmingDelete.value = cat.id
  editingId.value = null
}

function cancelDelete() {
  confirmingDelete.value = null
}

async function confirmDelete() {
  const id = confirmingDelete.value
  if (!id) return
  if (!canDeleteAny.value) {
    showFeedback('error', '至少保留 1 个分类')
    return
  }
  try {
    await deleteCategory(id)
    categories.value = categories.value.filter((c) => c.id !== id)
    confirmingDelete.value = null
    showFeedback('success', '已删除')
  } catch (e) {
    showFeedback('error', (e as Error).message || '删除失败')
  }
}

/* ---------------- 反馈提示 ---------------- */

type FeedbackType = 'success' | 'error'
const feedback = ref<{ type: FeedbackType; message: string } | null>(null)
let feedbackTimer: number | undefined

function showFeedback(type: FeedbackType, message: string) {
  feedback.value = { type, message }
  if (feedbackTimer) window.clearTimeout(feedbackTimer)
  feedbackTimer = window.setTimeout(() => {
    feedback.value = null
    feedbackTimer = undefined
  }, 2600)
}

/* ---------------- 弹窗控制（open 由父级驱动） ---------------- */

function onOverlayClick(ev: MouseEvent) {
  const target = ev.target as HTMLElement | null
  if (!target) return
  // 点到卡片内部不关闭；点到遮罩/背景才关闭
  if (!target.closest('.cm-card')) emit('close')
}

function onKeydown(ev: KeyboardEvent) {
  if (!props.open) return
  if (ev.key === 'Escape') {
    ev.preventDefault()
    // 先取消内联编辑/确认，再关闭弹窗
    if (editingId.value || confirmingDelete.value) {
      editingId.value = null
      confirmingDelete.value = null
    } else {
      emit('close')
    }
  }
}

function resetState() {
  newCategoryName.value = ''
  editingId.value = null
  editingName.value = ''
  confirmingDelete.value = null
  feedback.value = null
  if (feedbackTimer) {
    window.clearTimeout(feedbackTimer)
    feedbackTimer = undefined
  }
}

watch(
  () => props.open,
  async (v) => {
    document.body.style.overflow = v ? 'hidden' : ''
    if (v) {
      resetState()
      loadCategories()
      await nextTick()
      addInputEl.value?.focus()
    }
  }
)

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
  loadCategories()
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  document.body.style.overflow = ''
  if (feedbackTimer) window.clearTimeout(feedbackTimer)
})

/* ---------------- 输入框 DOM 绑定（用于聚焦） ---------------- */

const addInputEl = ref<HTMLInputElement | null>(null)
const editInputEl = ref<HTMLInputElement | null>(null)

function resolveEl(el: any): HTMLInputElement | null {
  if (!el) return null
  if (el.$el) return el.$el as HTMLInputElement
  return el instanceof HTMLInputElement ? el : null
}

function bindAddInput(el: any) {
  addInputEl.value = resolveEl(el)
}
function bindEditInput(el: any) {
  editInputEl.value = resolveEl(el)
}
</script>

<template>
  <Teleport to="body">
    <Transition name="modal-overlay" appear>
      <div
        v-if="open"
        class="fixed inset-0 z-[100] flex items-center justify-center px-4 py-8 sm:py-12"
        :aria-modal="true"
        role="dialog"
        aria-labelledby="cm-title"
        @mousedown="onOverlayClick"
      >
        <!-- 遮罩：半透明 + 毛玻璃 -->
        <div class="absolute inset-0 bg-black/45 backdrop-blur-sm" aria-hidden="true" />

        <!-- 卡片：缩放 + 淡入 -->
        <Transition name="modal-card" appear>
          <Card
            v-if="open"
            class="cm-card relative w-full max-w-md overflow-hidden rounded-2xl border-border/60 shadow-2xl"
          >
            <!-- 关闭按钮 -->
            <button
              type="button"
              aria-label="关闭分类管理"
              class="absolute right-4 top-4 z-10 inline-flex size-9 items-center justify-center rounded-full text-text-muted transition hover:bg-surface-muted/60 hover:text-text"
              @click="emit('close')"
            >
              <X class="size-5" />
            </button>

            <!-- 头部 -->
            <div class="flex items-center gap-3 border-b border-border/60 p-6 pr-14">
              <span class="inline-flex size-10 items-center justify-center rounded-xl bg-brand/10 text-brand">
                <FolderOpen class="size-5" />
              </span>
              <div class="space-y-0.5">
                <h2 id="cm-title" class="m-0 text-lg font-semibold leading-tight">分类管理</h2>
                <p class="m-0 text-xs text-text-muted">新增、重命名或删除博客文章分类</p>
              </div>
            </div>

            <!-- 新增区 -->
            <div class="space-y-3 p-6 pb-3">
              <Label htmlFor="cm-new" class="text-xs font-normal text-text-muted">新增分类</Label>
              <div class="flex gap-2">
                <Input
                  id="cm-new"
                  :ref="bindAddInput"
                  v-model="newCategoryName"
                  placeholder="输入分类名称"
                  maxlength="20"
                  class="flex-1"
                  @keydown.enter.prevent="onAdd"
                />
                <Button
                  type="button"
                  class="shrink-0"
                  :disabled="!newCategoryName.trim()"
                  @click="onAdd"
                >
                  <Plus class="size-4" />
                  <span>添加</span>
                </Button>
              </div>

              <!-- 反馈提示 -->
              <Transition name="toast">
                <div
                  v-if="feedback"
                  :role="feedback.type === 'error' ? 'alert' : 'status'"
                  :class="[
                    'flex items-start gap-2 rounded-lg border px-3 py-2 text-sm',
                    feedback.type === 'error'
                      ? 'border-danger/30 bg-danger/5 text-danger'
                      : 'border-success/30 bg-success/5 text-success'
                  ]"
                >
                  <X v-if="feedback.type === 'error'" class="mt-0.5 size-4 shrink-0" />
                  <Check v-else class="mt-0.5 size-4 shrink-0" />
                  <span class="leading-relaxed">{{ feedback.message }}</span>
                </div>
              </Transition>
            </div>

            <!-- 列表区 -->
            <div class="px-6 pb-2">
              <div class="mb-2 flex items-center justify-between text-xs text-text-muted">
                <span>共 {{ categories.length }} 个分类</span>
                <span>使用次数</span>
              </div>

              <div class="mr-[-4px] max-h-[340px] space-y-1 overflow-y-auto pr-1">
                <p
                  v-if="categories.length === 0"
                  class="m-0 py-8 text-center text-sm text-text-muted"
                >
                  暂无分类
                </p>

                <div
                  v-for="cat in categories"
                  :key="cat.id"
                  class="flex items-center justify-between gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-surface-muted"
                >
                  <!-- 内联重命名态 -->
                  <template v-if="editingId === cat.id">
                    <Input
                      :ref="bindEditInput"
                      v-model="editingName"
                      maxlength="20"
                      class="h-8 flex-1"
                      @keydown.enter.prevent="confirmRename"
                    />
                    <div class="flex items-center gap-1">
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        class="size-8 text-success hover:bg-success/10 hover:text-success"
                        aria-label="确认重命名"
                        @click="confirmRename"
                      >
                        <Check class="size-4" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        class="size-8"
                        aria-label="取消重命名"
                        @click="cancelEdit"
                      >
                        <X class="size-4" />
                      </Button>
                    </div>
                  </template>

                  <!-- 删除确认态 -->
                  <template v-else-if="confirmingDelete === cat.id">
                    <span class="flex min-w-0 flex-1 items-center gap-1.5 text-sm text-danger">
                      <Trash2 class="size-4 shrink-0" />
                      <span class="truncate">
                        确认删除「{{ cat.name }}」？<template v-if="cat.postCount > 0">（{{ cat.postCount }} 篇将迁移）</template>
                      </span>
                    </span>
                    <div class="flex shrink-0 items-center gap-1">
                      <Button type="button" size="sm" variant="destructive" @click="confirmDelete">
                        <Check class="size-3.5" />
                        删除
                      </Button>
                      <Button type="button" size="sm" variant="ghost" @click="cancelDelete">
                        取消
                      </Button>
                    </div>
                  </template>

                  <!-- 正常态 -->
                  <template v-else>
                    <div class="flex min-w-0 flex-1 items-center gap-2">
                      <span class="truncate text-sm font-medium">{{ cat.name }}</span>
                      <span
                        class="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-surface-muted px-1.5 text-[11px] tabular-nums text-text-muted"
                      >
                        {{ cat.postCount }}
                      </span>
                    </div>
                    <div class="flex shrink-0 items-center gap-2">
                      <button
                        type="button"
                        class="inline-flex size-9 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-brand/10 hover:text-brand cursor-pointer"
                        aria-label="重命名"
                        title="重命名"
                        @click="startEdit(cat)"
                      >
                        <Pencil class="size-5" />
                      </button>
                      <span
                        :title="!canDeleteAny ? '至少保留 1 个分类' : `删除「${cat.name}」`"
                        class="inline-flex"
                      >
                        <button
                          type="button"
                          class="inline-flex size-9 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-danger/10 hover:text-danger cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                          :disabled="!canDeleteAny"
                          :aria-label="!canDeleteAny ? '至少保留 1 个分类' : `删除${cat.name}`"
                          @click="startDeleteConfirm(cat)"
                        >
                          <Trash2 class="size-5" />
                        </button>
                      </span>
                    </div>
                  </template>
                </div>
              </div>
            </div>

            <!-- 底部 -->
            <div class="flex items-center justify-end gap-2 border-t border-border/60 bg-surface-muted/10 px-6 py-4">
              <Button type="button" @click="emit('close')">
                <Check class="size-4" />
                <span>完成</span>
              </Button>
            </div>
          </Card>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
/* Toast：内联提示轻淡入 */
.toast-enter-active,
.toast-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

/* Modal Overlay：遮罩淡入 */
.modal-overlay-enter-active,
.modal-overlay-leave-active {
  transition: opacity 0.22s ease;
}
.modal-overlay-enter-from,
.modal-overlay-leave-to {
  opacity: 0;
}

/* Modal Card：卡片缩放 + 淡入 + 轻微上浮 */
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
