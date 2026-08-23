<script setup lang="ts">
/**
 * ContactPage · 联系方式 + 前端校验表单（完整填充）。
 * - 左侧：contactChannels 列表 + 复制邮箱 支持
 * - 右侧：响应式表单（name/email/message）+ validateContactForm + 提交后提示
 */
import {
  reactive, ref, computed, onBeforeUnmount, onMounted, watch, nextTick
} from 'vue'
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Input,
  Label
} from '@/components/ui'
import {
  contactChannels,
  validateContactForm,
  type ContactChannel,
  type ContactFormErrors
} from '@/data'
import {
  Copy,
  Check,
  Send,
  AlertCircle,
  Lightbulb,
  MessageSquarePlus,
  X
} from 'lucide-vue-next'

/** 复制反馈：每个 channel 都可能正在复制或已复制（用于 UI 反馈） */
const copiedId = ref<string | null>(null)

async function copyValue(id: string, value: string) {
  try {
    await navigator.clipboard.writeText(value)
    copiedId.value = id
    setTimeout(() => { if (copiedId.value === id) copiedId.value = null }, 2000)
  } catch {
    // 老浏览器兜底：fallback 不做额外处理，用户可手动选择
    alert(`复制失败，请手动复制：${value}`)
  }
}

function handleChannelClick(ch: ContactChannel, ev: MouseEvent) {
  // 有 copyValue 且不依赖 href = 点击复制（例如微信二维码链接占位 / Telegram @ 名 等）
  if (ch.copyValue && (ch.href === null || ev.shiftKey)) {
    ev.preventDefault()
    copyValue(ch.id, ch.copyValue)
  }
}

/* ---------------- 表单 ---------------- */
const formValues = reactive({
  name: '',
  email: '',
  message: ''
})

const errors = ref<ContactFormErrors>({})
const submitting = ref(false)
const submitted = ref(false)

function validateAll(): boolean {
  errors.value = validateContactForm({ ...formValues })
  return Object.keys(errors.value).length === 0
}

function clearForm() {
  formValues.name = ''
  formValues.email = ''
  formValues.message = ''
  errors.value = {}
}

async function onSubmit() {
  submitting.value = true
  submitted.value = false
  try {
    if (!validateAll()) return
    // T05 不接后端：模拟 700ms 请求延迟
    await new Promise(r => setTimeout(r, 700))
    submitted.value = true
    setTimeout(() => { submitted.value = false }, 6000)
    clearForm()
  } finally {
    submitting.value = false
  }
}

const formHasAnyError = computed(() => Object.keys(errors.value).length > 0)

/* ---------------- Modal 弹窗 ---------------- */
const modalOpen = ref(false)
const modalCardRef = ref<HTMLElement | null>(null)
const firstInputRef = ref<HTMLInputElement | null>(null)
const lastFocusableRef = ref<HTMLButtonElement | null>(null)

/** 打开弹窗：锁 body 滚动 + 自动聚焦第一输入框 */
async function openModal() {
  modalOpen.value = true
  document.body.style.overflow = 'hidden'
  // 默认清空旧错误（但保留已填内容；要清空内容可调用 clearForm）
  errors.value = {}
  await nextTick()
  firstInputRef.value?.focus?.()
}
function closeModal() {
  modalOpen.value = false
  document.body.style.overflow = ''
}

/** Esc 关闭 + Tab 焦点环（基础无障碍） */
function onKeydown(ev: KeyboardEvent) {
  if (!modalOpen.value) return
  if (ev.key === 'Escape') {
    ev.preventDefault()
    closeModal()
  } else if (ev.key === 'Tab' && firstInputRef.value && lastFocusableRef.value) {
    const active = document.activeElement
    if (ev.shiftKey && active === firstInputRef.value) {
      ev.preventDefault()
      lastFocusableRef.value.focus()
    } else if (!ev.shiftKey && active === lastFocusableRef.value) {
      ev.preventDefault()
      firstInputRef.value.focus()
    }
  }
}

/** 只允许点击遮罩（透明背景，非卡片）关闭；避免点击内容区冒泡误关 */
function onOverlayClick(ev: MouseEvent) {
  if (modalCardRef.value && !modalCardRef.value.contains(ev.target as Node)) {
    closeModal()
  }
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  document.body.style.overflow = ''
})

/** 提交成功后 1.8s 自动关闭弹窗 */
watch(submitted, (v) => {
  if (v) {
    const t = setTimeout(() => {
      if (submitted.value) closeModal()
      clearTimeout(t)
    }, 1800)
  }
})
</script>

<template>
  <article class="max-w-3xl mx-auto">
    <section class="space-y-6">
      <header class="space-y-4">
        <p class="m-0 text-xs font-mono text-brand uppercase tracking-wider">/ contact</p>
        <h1 class="m-0 text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight leading-tight">联系我</h1>
        <p class="m-0 text-base md:text-lg text-text-muted leading-relaxed max-w-2xl">
          不管是合作、约稿、技术咨询、或者单纯想交个朋友，都欢迎。下面是几种最容易找到我的方式，或者直接点击下方按钮给我留言。
        </p>
        <Button size="lg" @click="openModal" class="mt-1">
          <MessageSquarePlus class="size-5" />
          <span>给我留言</span>
        </Button>
      </header>

      <!-- 联系方式卡片 -->
      <Card>
        <CardContent class="p-0">
          <a
            v-for="(ch, idx) in contactChannels"
            :key="ch.id"
            :href="ch.href ?? '#'"
            :target="ch.href ? '_blank' : undefined"
            :rel="ch.href ? 'noopener noreferrer' : undefined"
            @click="handleChannelClick(ch, $event)"
            :class="[
              'group flex items-center gap-4 no-underline px-6 py-5 text-text transition-colors',
              idx !== contactChannels.length - 1 ? 'border-b border-border/60' : '',
              ch.href ? 'hover:bg-surface-muted/50' : 'cursor-pointer hover:bg-surface-muted/50'
            ]"
          >
            <span class="inline-flex size-11 items-center justify-center rounded-xl bg-surface-muted/60 text-text-muted group-hover:text-brand group-hover:bg-brand/10 transition">
              <component :is="ch.icon" class="size-[20px]" />
            </span>
            <div class="flex-1 min-w-0 space-y-1">
              <div class="flex items-center gap-2">
                <span class="font-semibold text-base">{{ ch.label }}</span>
                <Badge v-if="ch.copyValue" variant="outline" class="text-[10px] !py-0 opacity-80 group-hover:opacity-100">
                  点击复制
                </Badge>
              </div>
              <div class="text-sm text-text-muted truncate">{{ ch.hint }}</div>
            </div>

            <!-- 复制反馈：已复制 -->
            <span
              v-if="copiedId === ch.id"
              class="inline-flex items-center gap-1 rounded-full bg-success/10 text-success text-xs font-medium px-2.5 py-1"
            >
              <Check class="size-3.5" />
              已复制
            </span>
            <!-- 复制按钮（仅当提供 copyValue 时显示） -->
            <span
              v-else-if="ch.copyValue"
              class="inline-flex items-center gap-1 rounded-full border border-border/60 bg-surface-muted/40 text-text-muted text-xs px-2.5 py-1 group-hover:border-brand/40 group-hover:text-brand transition"
            >
              <Copy class="size-3.5" />
              复制
            </span>
          </a>
        </CardContent>
      </Card>

      <!-- 温馨提示 -->
      <div class="rounded-xl border border-brand/20 bg-brand/[0.04] p-5 flex gap-4">
        <Lightbulb class="size-5 text-brand shrink-0 mt-0.5" />
        <div class="space-y-1.5 text-sm text-text-muted leading-relaxed">
          <p class="m-0">
            <strong class="text-text">响应时间：</strong>
            工作日 24 小时内回复；周末与节假日可能 2-3 天。
          </p>
          <p class="m-0">
            <strong class="text-text">推荐渠道：</strong>
            合作/咨询发邮件（有归档更靠谱），即时聊天走 Telegram。
          </p>
        </div>
      </div>
    </section>

    <!-- 丝滑 Modal 弹窗（固定定位 + 居中卡片） -->
    <Teleport to="body">
      <Transition name="modal-overlay" appear>
        <div
          v-if="modalOpen"
          class="fixed inset-0 z-[100] flex items-center justify-center px-4 py-8 sm:py-12"
          :aria-modal="true"
          role="dialog"
          @mousedown="onOverlayClick"
        >
          <!-- 遮罩：品牌色半透明 + backdrop 毛玻璃 -->
          <div class="absolute inset-0 bg-black/45 backdrop-blur-sm" aria-hidden="true" />

          <!-- 卡片：缩放 + 淡入（prefers-reduced-motion 自动关） -->
          <Transition name="modal-card" appear>
            <Card
              v-if="modalOpen"
              ref="modalCardRef"
              class="relative w-full max-w-lg overflow-hidden shadow-2xl border-border/60"
            >
              <!-- 右上角关闭按钮 -->
              <button
                type="button"
                aria-label="关闭留言弹窗"
                class="absolute right-4 top-4 z-10 inline-flex size-9 items-center justify-center rounded-full text-text-muted hover:text-text hover:bg-surface-muted/60 transition"
                @click="closeModal"
              >
                <X class="size-5" />
              </button>

              <CardHeader class="pr-14">
                <CardTitle class="text-xl">给我留个言</CardTitle>
                <CardDescription class="text-sm">
                  目前还在纠结接哪个邮件服务（T05 规划），所以表单先保留在前端校验。填完后直接发我邮箱也行～
                </CardDescription>
              </CardHeader>

              <form novalidate @submit.prevent="onSubmit">
                <CardContent class="p-6 pt-0 space-y-5">
                  <!-- 姓名 -->
                  <div class="space-y-1.5">
                    <div class="flex items-center justify-between">
                      <Label htmlFor="cf-name">称呼 *</Label>
                      <span v-if="errors.name" class="text-[11px] text-danger flex items-center gap-1">
                        <AlertCircle class="size-3" />
                        {{ errors.name }}
                      </span>
                    </div>
                    <Input
                      ref="firstInputRef"
                      id="cf-name"
                      v-model="formValues.name"
                      placeholder="怎么称呼你？"
                      :class="errors.name ? 'border-danger ring-danger/30 focus-visible:ring-danger' : ''"
                      autocomplete="name"
                    />
                  </div>

                  <!-- 邮箱 -->
                  <div class="space-y-1.5">
                    <div class="flex items-center justify-between">
                      <Label htmlFor="cf-email">邮箱 *</Label>
                      <span v-if="errors.email" class="text-[11px] text-danger flex items-center gap-1">
                        <AlertCircle class="size-3" />
                        {{ errors.email }}
                      </span>
                    </div>
                    <Input
                      id="cf-email"
                      type="email"
                      v-model="formValues.email"
                      placeholder="name@example.com"
                      :class="errors.email ? 'border-danger ring-danger/30 focus-visible:ring-danger' : ''"
                      autocomplete="email"
                    />
                  </div>

                  <!-- 消息 -->
                  <div class="space-y-1.5">
                    <div class="flex items-center justify-between">
                      <Label htmlFor="cf-msg">想聊什么？*</Label>
                      <span v-if="errors.message" class="text-[11px] text-danger flex items-center gap-1">
                        <AlertCircle class="size-3" />
                        {{ errors.message }}
                      </span>
                    </div>
                    <textarea
                      id="cf-msg"
                      rows="6"
                      v-model="formValues.message"
                      placeholder="简单描述一下你的需求或问题，比如背景、期望、时间线……"
                      :class="[
                        'flex w-full rounded-md border bg-surface-elevated px-3 py-2 text-sm shadow-sm placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-surface transition-colors resize-y',
                        errors.message
                          ? 'border-danger ring-danger/30 focus-visible:ring-danger'
                          : 'border-border focus-visible:ring-brand'
                      ]"
                    />
                  </div>

                  <!-- 提交成功提示 -->
                  <Transition name="toast">
                    <div
                      v-if="submitted"
                      role="status"
                      class="rounded-lg border border-success/30 bg-success/5 text-success text-sm px-4 py-3 flex items-start gap-2"
                    >
                      <Check class="size-4 mt-0.5" />
                      <div class="space-y-0.5">
                        <p class="m-0 font-medium">已收到！（Mock 模式）</p>
                        <p class="m-0 text-xs text-text-muted leading-relaxed">
                          目前还没对接后端，不会真的发送。推荐直接把这段文字复制到上面的邮箱，我会更快看到～
                        </p>
                      </div>
                    </div>
                  </Transition>

                  <!-- 通用错误提示 -->
                  <Transition name="toast">
                    <div
                      v-if="formHasAnyError && !submitting && submitted === false && (formValues.name || formValues.email || formValues.message)"
                      role="alert"
                      class="rounded-lg border border-danger/30 bg-danger/5 text-danger text-sm px-4 py-3 flex items-start gap-2"
                    >
                      <AlertCircle class="size-4 mt-0.5" />
                      <p class="m-0">表单还没填写完整，检查一下红色提示～</p>
                    </div>
                  </Transition>
                </CardContent>

                <div class="px-6 pb-6 pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-border/60 bg-surface-muted/10 rounded-b-lg">
                  <p class="m-0 text-xs text-text-muted">
                    * 为必填项 · 你的信息只会用于回复本次留言
                  </p>
                  <Button
                    ref="lastFocusableRef"
                    type="submit"
                    size="lg"
                    :disabled="submitting"
                    class="min-w-[120px]"
                  >
                    <template v-if="submitting">
                      <span class="size-4 border-2 border-brand-on/30 border-t-brand-on rounded-full animate-spin" />
                      <span>发送中...</span>
                    </template>
                    <template v-else>
                      <Send class="size-4" />
                      <span>发送消息</span>
                    </template>
                  </Button>
                </div>
              </form>
            </Card>
          </Transition>
        </div>
      </Transition>
    </Teleport>
  </article>
</template>

<style scoped>
/* Toast：表单内提示的轻淡入 */
.toast-enter-active,
.toast-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

/* Modal Overlay：遮罩淡入（prefers-reduced-motion 自动跳过） */
.modal-overlay-enter-active,
.modal-overlay-leave-active {
  transition: opacity 0.22s ease;
}
.modal-overlay-enter-from,
.modal-overlay-leave-to {
  opacity: 0;
}

/* Modal Card：卡片缩放 + 淡入 + 轻微上浮，时间轴错开（prefers-reduced-motion 关） */
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
