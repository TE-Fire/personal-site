<script setup lang="ts">
/**
 * ContactPage · 联系方式 + 前端校验表单（完整填充）。
 * - 左侧：contactChannels 列表 + 复制邮箱 支持
 * - 右侧：响应式表单（name/email/message）+ validateContactForm + 提交后提示
 */
import { reactive, ref, computed } from 'vue'
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
  Lightbulb
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
</script>

<template>
  <article class="grid grid-cols-1 lg:grid-cols-[0.9fr_1.1fr] gap-8 max-w-5xl mx-auto">
    <!-- 左：联系方式 + 社交渠道 -->
    <section class="space-y-5">
      <header class="space-y-3">
        <p class="m-0 text-xs font-mono text-brand uppercase tracking-wider">/ contact</p>
        <h1 class="m-0 text-3xl md:text-4xl font-bold tracking-tight">联系我</h1>
        <p class="m-0 text-base md:text-lg text-text-muted leading-relaxed">
          不管是合作、约稿、技术咨询、或者单纯想交个朋友，都欢迎。下面是几种最容易找到我的方式。
        </p>
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
              'group flex items-center gap-4 no-underline px-5 py-4 text-text transition-colors',
              idx !== contactChannels.length - 1 ? 'border-b border-border/60' : '',
              ch.href ? 'hover:bg-surface-muted/50' : 'cursor-pointer hover:bg-surface-muted/50'
            ]"
          >
            <span class="inline-flex size-10 items-center justify-center rounded-full bg-surface-muted/60 text-text-muted group-hover:text-brand group-hover:bg-brand/5 transition">
              <component :is="ch.icon" class="size-[18px]" />
            </span>
            <div class="flex-1 min-w-0 space-y-0.5">
              <div class="flex items-center gap-2">
                <span class="font-medium text-sm">{{ ch.label }}</span>
                <Badge v-if="ch.copyValue" variant="outline" class="text-[10px] !py-0 opacity-80 group-hover:opacity-100">
                  点击复制
                </Badge>
              </div>
              <div class="text-xs md:text-sm text-text-muted truncate">{{ ch.hint }}</div>
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
      <div class="rounded-lg border border-brand/20 bg-brand/[0.04] p-4 flex gap-3">
        <Lightbulb class="size-5 text-brand shrink-0 mt-0.5" />
        <div class="space-y-1 text-sm text-text-muted leading-relaxed">
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

    <!-- 右：留言表单 -->
    <section>
      <form novalidate class="h-full flex flex-col" @submit.prevent="onSubmit">
        <Card class="flex flex-col flex-1">
          <CardHeader>
            <CardTitle>给我留个言</CardTitle>
            <CardDescription>
              目前还在纠结接哪个邮件服务（T05 规划），所以表单先保留在前端校验。填完后直接发我邮箱也行～
            </CardDescription>
          </CardHeader>
          <CardContent class="p-6 pt-0 space-y-5 flex-1">
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
        </Card>
      </form>
    </section>
  </article>
</template>

<style scoped>
.toast-enter-active,
.toast-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}
</style>
