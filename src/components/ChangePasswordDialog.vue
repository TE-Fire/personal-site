<script setup lang="ts">
/**
 * ChangePasswordDialog.vue · 重置密码弹窗
 *
 * 功能：
 *   · 三个输入：旧密码 / 新密码 / 确认新密码
 *   · 前端校验：必填、新密码 ≥6 位、两次新密码一致、新旧不能相同
 *   · 提交调用 authStore.changePassword，成功后 emit('success') 由父级强制登出跳登录页
 *   · ESC / 点遮罩关闭，提交中禁止关闭
 *
 * 由父级通过 `open` prop 驱动显隐，关闭时 emit('close')。
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Button, Card, Input, Label } from '@/components/ui'
import { KeyRound, Eye, EyeOff, Check, X } from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth'

interface Props {
  open: boolean
}
const props = defineProps<Props>()
const emit = defineEmits<{ close: []; success: [] }>()

const authStore = useAuthStore()

/* ---------------- 表单状态 ---------------- */
const oldPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
/** 三个输入框的明文/密文切换 */
const showOld = ref(false)
const showNew = ref(false)
const showConfirm = ref(false)
const submitting = ref(false)

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
  }, 3000)
}

/* ---------------- 前端校验 ---------------- */
const errors = ref<{ old?: string; new?: string; confirm?: string }>({})

function validate(): boolean {
  const e: typeof errors.value = {}
  if (!oldPassword.value) e.old = '请输入旧密码'
  if (!newPassword.value) {
    e.new = '请输入新密码'
  } else if (newPassword.value.length < 6) {
    e.new = '新密码至少 6 位'
  } else if (newPassword.value === oldPassword.value) {
    e.new = '新密码不能与旧密码相同'
  }
  if (!confirmPassword.value) {
    e.confirm = '请再次输入新密码'
  } else if (confirmPassword.value !== newPassword.value) {
    e.confirm = '两次输入的新密码不一致'
  }
  errors.value = e
  return !e.old && !e.new && !e.confirm
}

/** 提交按钮是否可点（粗粒度，避免无输入也高亮） */
const canSubmit = computed(
  () => !!oldPassword.value && !!newPassword.value && !!confirmPassword.value && !submitting.value,
)

/* ---------------- 提交 ---------------- */
async function onSubmit() {
  if (!validate()) return
  submitting.value = true
  feedback.value = null
  try {
    await authStore.changePassword({
      oldPassword: oldPassword.value,
      newPassword: newPassword.value,
    })
    showFeedback('success', '密码修改成功，即将跳转登录页')
    // 给提示一点展示时间，再通知父级强制登出
    window.setTimeout(() => {
      emit('success')
    }, 800)
  } catch (err: any) {
    const message = err?.response?.data?.message || err?.message || '修改失败，请重试'
    showFeedback('error', message)
  } finally {
    submitting.value = false
  }
}

/* ---------------- 弹窗控制 ---------------- */
function resetState() {
  oldPassword.value = ''
  newPassword.value = ''
  confirmPassword.value = ''
  showOld.value = false
  showNew.value = false
  showConfirm.value = false
  submitting.value = false
  errors.value = {}
  feedback.value = null
  if (feedbackTimer) {
    window.clearTimeout(feedbackTimer)
    feedbackTimer = undefined
  }
}

function onOverlayClick(ev: MouseEvent) {
  const target = ev.target as HTMLElement | null
  if (!target) return
  if (submitting.value) return // 提交中禁止关闭
  if (!target.closest('.cp-card')) emit('close')
}

function onKeydown(ev: KeyboardEvent) {
  if (!props.open) return
  if (ev.key === 'Escape' && !submitting.value) {
    ev.preventDefault()
    emit('close')
  }
}

watch(
  () => props.open,
  async (v) => {
    document.body.style.overflow = v ? 'hidden' : ''
    if (v) {
      resetState()
      await nextTick()
      oldInputEl.value?.focus()
    }
  },
)

onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  document.body.style.overflow = ''
  if (feedbackTimer) window.clearTimeout(feedbackTimer)
})

/* ---------------- 输入框 DOM 绑定（聚焦） ---------------- */
const oldInputEl = ref<HTMLInputElement | null>(null)

function resolveEl(el: any): HTMLInputElement | null {
  if (!el) return null
  if (el.$el) return el.$el as HTMLInputElement
  return el instanceof HTMLInputElement ? el : null
}
function bindOldInput(el: any) {
  oldInputEl.value = resolveEl(el)
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
        aria-labelledby="cp-title"
        @mousedown="onOverlayClick"
      >
        <!-- 遮罩 -->
        <div class="absolute inset-0 bg-black/45 backdrop-blur-sm" aria-hidden="true" />

        <!-- 卡片 -->
        <Transition name="modal-card" appear>
          <Card
            v-if="open"
            class="cp-card relative w-full max-w-md overflow-hidden rounded-2xl border-border/60 shadow-2xl"
          >
            <!-- 关闭按钮 -->
            <button
              type="button"
              aria-label="关闭"
              :disabled="submitting"
              class="absolute right-4 top-4 z-10 inline-flex size-9 items-center justify-center rounded-full text-text-muted transition hover:bg-surface-muted/60 hover:text-text disabled:opacity-40 disabled:cursor-not-allowed"
              @click="emit('close')"
            >
              <X class="size-5" />
            </button>

            <!-- 头部 -->
            <div class="flex items-center gap-3 border-b border-border/60 p-6 pr-14">
              <span class="inline-flex size-10 items-center justify-center rounded-xl bg-brand/10 text-brand">
                <KeyRound class="size-5" />
              </span>
              <div class="space-y-0.5">
                <h2 id="cp-title" class="m-0 text-lg font-semibold leading-tight">重置密码</h2>
                <p class="m-0 text-xs text-text-muted">修改成功后需重新登录</p>
              </div>
            </div>

            <!-- 表单 -->
            <form class="space-y-4 p-6" @submit.prevent="onSubmit">
              <!-- 旧密码 -->
              <div class="space-y-1.5">
                <Label htmlFor="cp-old" class="text-xs font-normal text-text-muted">旧密码</Label>
                <div class="relative">
                  <Input
                    id="cp-old"
                    :ref="bindOldInput"
                    v-model="oldPassword"
                    :type="showOld ? 'text' : 'password'"
                    placeholder="输入当前密码"
                    autocomplete="current-password"
                    :class="errors.old ? 'border-danger focus-visible:ring-danger' : ''"
                  />
                  <button
                    type="button"
                    tabindex="-1"
                    class="absolute right-2 top-1/2 -translate-y-1/2 inline-flex size-7 items-center justify-center rounded text-text-muted hover:text-text"
                    :aria-label="showOld ? '隐藏密码' : '显示密码'"
                    @click="showOld = !showOld"
                  >
                    <EyeOff v-if="showOld" class="size-4" />
                    <Eye v-else class="size-4" />
                  </button>
                </div>
                <p v-if="errors.old" class="m-0 text-xs text-danger">{{ errors.old }}</p>
              </div>

              <!-- 新密码 -->
              <div class="space-y-1.5">
                <Label htmlFor="cp-new" class="text-xs font-normal text-text-muted">
                  新密码 <span class="text-text-muted/70">（至少 6 位）</span>
                </Label>
                <div class="relative">
                  <Input
                    id="cp-new"
                    v-model="newPassword"
                    :type="showNew ? 'text' : 'password'"
                    placeholder="输入新密码"
                    autocomplete="new-password"
                    :class="errors.new ? 'border-danger focus-visible:ring-danger' : ''"
                  />
                  <button
                    type="button"
                    tabindex="-1"
                    class="absolute right-2 top-1/2 -translate-y-1/2 inline-flex size-7 items-center justify-center rounded text-text-muted hover:text-text"
                    :aria-label="showNew ? '隐藏密码' : '显示密码'"
                    @click="showNew = !showNew"
                  >
                    <EyeOff v-if="showNew" class="size-4" />
                    <Eye v-else class="size-4" />
                  </button>
                </div>
                <p v-if="errors.new" class="m-0 text-xs text-danger">{{ errors.new }}</p>
              </div>

              <!-- 确认新密码 -->
              <div class="space-y-1.5">
                <Label htmlFor="cp-confirm" class="text-xs font-normal text-text-muted">确认新密码</Label>
                <div class="relative">
                  <Input
                    id="cp-confirm"
                    v-model="confirmPassword"
                    :type="showConfirm ? 'text' : 'password'"
                    placeholder="再次输入新密码"
                    autocomplete="new-password"
                    :class="errors.confirm ? 'border-danger focus-visible:ring-danger' : ''"
                    @keydown.enter.prevent="onSubmit"
                  />
                  <button
                    type="button"
                    tabindex="-1"
                    class="absolute right-2 top-1/2 -translate-y-1/2 inline-flex size-7 items-center justify-center rounded text-text-muted hover:text-text"
                    :aria-label="showConfirm ? '隐藏密码' : '显示密码'"
                    @click="showConfirm = !showConfirm"
                  >
                    <EyeOff v-if="showConfirm" class="size-4" />
                    <Eye v-else class="size-4" />
                  </button>
                </div>
                <p v-if="errors.confirm" class="m-0 text-xs text-danger">{{ errors.confirm }}</p>
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

              <!-- 底部按钮 -->
              <div class="flex items-center justify-end gap-2 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  :disabled="submitting"
                  @click="emit('close')"
                >
                  取消
                </Button>
                <Button type="submit" :disabled="!canSubmit">
                  <span v-if="submitting" class="inline-block size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  <span>{{ submitting ? '提交中…' : '确认修改' }}</span>
                </Button>
              </div>
            </form>
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

/* Modal Card：卡片缩放 + 淡入 */
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
