<script setup lang="ts">
/**
 * ContactPage · 联系方式展示页（可展开卡片式）。
 * - 从后端 API 拉取联系方式数据，管理端编辑后前台同步更新
 * - 点击卡片展开详细联系信息（手风琴式）
 */
import { ref, computed, onMounted, type Component } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { contactChannels } from '@/data'
import { getContact, type ContactData } from '@/api/contact'
import { Card, CardContent, Button, Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose } from '@/components/ui'
import { Copy, Check, ExternalLink, ChevronDown, Lightbulb, Pencil } from 'lucide-vue-next'

defineOptions({ name: 'ContactPage' })

const authStore = useAuthStore()
const router = useRouter()

/** 合并静态结构（icon/label/order）与 API 动态数据的卡片列表 */
type MergedChannel = {
  id: string
  label: string
  hint: string
  icon: Component
  order: number
  detail: {
    value: string
    description: string
    copyValue?: string
    linkUrl?: string
    linkText?: string
    qrCode?: string | null
  }
}

const channels = ref<MergedChannel[]>(contactChannels as unknown as MergedChannel[])
const loading = ref(true)

/** 从 API 拉取数据并合并到静态结构 */
async function loadContact() {
  loading.value = true
  try {
    const data: ContactData = await getContact()
    channels.value = contactChannels.map((ch) => {
      const api = ch.id === 'email' ? data.email
        : ch.id === 'github' ? data.github
        : data.wechat
      return {
        id: ch.id,
        label: ch.label,
        hint: api.hint ?? ch.hint,
        icon: ch.icon,
        order: ch.order,
        detail: {
          value: api.value,
          description: api.description ?? api.hint,
          copyValue: 'copyValue' in api ? (api as any).copyValue : undefined,
          linkUrl: 'linkUrl' in api ? (api as any).linkUrl : undefined,
          linkText: 'linkText' in api ? (api as any).linkText : undefined,
          qrCode: 'qrCode' in api ? (api as any).qrCode : null,
        },
      }
    })
  } catch {
    // API 失败时保持静态数据兜底
  } finally {
    loading.value = false
  }
}

onMounted(loadContact)

/** 当前展开的卡片 id（手风琴：同一时间只展开一个） */
const expandedId = ref<string | null>('email')

function toggleExpand(id: string) {
  expandedId.value = expandedId.value === id ? null : id
}

/** 当前正在查看二维码的卡片 id */
const qrDialogId = ref<string | null>(null)
const qrDialogOpen = computed({
  get: () => qrDialogId.value !== null,
  set: (v: boolean) => { if (!v) qrDialogId.value = null },
})

function openQrDialog(id: string) {
  qrDialogId.value = id
}

/** 当前对话框展示用的二维码 URL */
const currentQrCode = computed(() => {
  if (!qrDialogId.value) return null
  return channels.value.find(ch => ch.id === qrDialogId.value)?.detail.qrCode ?? null
})

/** 复制反馈 */
const copiedId = ref<string | null>(null)

async function copyToClipboard(id: string, value: string) {
  try {
    await navigator.clipboard.writeText(value)
    copiedId.value = id
    setTimeout(() => { if (copiedId.value === id) copiedId.value = null }, 2000)
  } catch {
    alert(`复制失败，请手动复制：${value}`)
  }
}
</script>

<template>
  <article class="max-w-3xl mx-auto">
    <section class="space-y-6">
      <header class="space-y-4">
        <p class="m-0 text-xs font-mono text-brand uppercase tracking-wider">/ contact</p>
        <div class="flex flex-wrap items-center justify-between gap-4">
          <h1 class="m-0 text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight leading-tight">联系我</h1>
          <button
            v-if="authStore.isLoggedIn"
            type="button"
            class="btn-spec-b btn-spec-b--outline"
            @click="router.push('/admin/contact')"
          >
            <Pencil class="btn-spec-b__icon" />
            <span>编辑联系方式</span>
          </button>
        </div>
        <p class="m-0 text-base md:text-lg text-text-muted leading-relaxed max-w-2xl">
          不管是合作、约稿、技术咨询、或者单纯想交个朋友，都欢迎。点击下方任意卡片展开联系方式，获取我的详细联系信息。
        </p>
      </header>

      <!-- 加载态 -->
      <div v-if="loading" class="flex items-center justify-center py-20 text-text-muted">
        <span class="animate-pulse text-sm">正在加载联系方式…</span>
      </div>

      <!-- 联系方式卡片（手风琴式展开） -->
      <Card v-if="!loading">
        <CardContent class="p-0">
          <div
            v-for="(ch, idx) in channels"
            :key="ch.id"
            :class="[
              'border-b border-border/60',
              idx === channels.length - 1 ? 'border-b-0' : ''
            ]"
          >
            <!-- 卡片头部（可点击展开） -->
            <button
              class="group flex w-full items-center gap-4 px-6 py-5 text-left transition-colors hover:bg-surface-muted/50"
              @click="toggleExpand(ch.id)"
            >
              <span class="inline-flex size-11 items-center justify-center rounded-xl bg-surface-muted/60 text-text-muted group-hover:text-brand group-hover:bg-brand/10 transition">
                <component :is="ch.icon" class="size-[20px]" />
              </span>
              <div class="flex-1 min-w-0 space-y-1 text-left">
                <div class="font-semibold text-base">{{ ch.label }}</div>
                <div class="text-sm text-text-muted truncate">{{ ch.hint }}</div>
              </div>
              <ChevronDown
                class="size-5 text-text-muted shrink-0 transition-transform duration-200"
                :class="expandedId === ch.id ? 'rotate-180' : ''"
              />
            </button>

            <!-- 展开内容 -->
            <Transition name="expand">
              <div v-if="expandedId === ch.id" class="overflow-hidden">
                <div class="px-6 pb-5 pt-1 space-y-3">
                  <!-- 主要内容值 -->
                  <div class="flex items-center gap-3 flex-wrap">
                    <span class="font-mono text-sm text-text bg-surface-muted/40 px-3 py-1.5 rounded-lg">
                      {{ ch.detail.value }}
                    </span>
                    <!-- 复制按钮 -->
                    <button
                      v-if="ch.detail.copyValue"
                      class="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-surface-muted/40 text-text-muted text-xs px-3 py-1.5 hover:border-brand/40 hover:text-brand transition"
                      @click="copyToClipboard(ch.id, ch.detail.copyValue)"
                    >
                      <template v-if="copiedId === ch.id">
                        <Check class="size-3.5" />
                        已复制
                      </template>
                      <template v-else>
                        <Copy class="size-3.5" />
                        复制
                      </template>
                    </button>
                    <!-- 访问链接按钮 -->
                    <a
                      v-if="ch.detail.linkUrl"
                      :href="ch.detail.linkUrl"
                      :target="ch.detail.linkUrl.startsWith('http') ? '_blank' : undefined"
                      :rel="ch.detail.linkUrl.startsWith('http') ? 'noopener noreferrer' : undefined"
                      class="inline-flex items-center gap-1.5 rounded-full border border-brand/30 bg-brand/10 text-brand text-xs font-medium px-3 py-1.5 hover:bg-brand/20 transition no-underline"
                    >
                      <ExternalLink class="size-3.5" />
                      {{ ch.detail.linkText ?? '访问' }}
                    </a>
                  </div>

                  <!-- 描述说明 -->
                  <p class="m-0 text-sm text-text-muted leading-relaxed">{{ ch.detail.description }}</p>

                  <!-- 二维码（微信）：点击打开大图弹窗 -->
                  <div v-if="ch.detail.qrCode" class="pt-2">
                    <button
                      type="button"
                      class="group inline-flex items-center gap-3 rounded-xl border border-border/60 bg-surface-muted/20 p-3 text-left transition hover:border-brand/40 hover:bg-brand/[0.04] focus:outline-none focus:ring-2 focus:ring-brand"
                      @click="openQrDialog(ch.id)"
                    >
                      <div class="relative size-16 overflow-hidden rounded-lg border border-border bg-white">
                        <img
                          :src="ch.detail.qrCode"
                          alt="微信二维码"
                          class="h-full w-full object-cover object-center [image-rendering:pixelated]"
                        />
                      </div>
                      <div class="flex flex-col gap-0.5 pr-2">
                        <span class="text-sm font-medium text-text">查看二维码</span>
                        <span class="text-xs text-text-muted">点击放大，微信扫一扫添加</span>
                      </div>
                    </button>
                  </div>
                </div>
              </div>
            </Transition>
          </div>
        </CardContent>
      </Card>

      <!-- 二维码放大弹窗 -->
      <Dialog v-model:open="qrDialogOpen">
        <DialogContent class="max-w-md sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>微信二维码</DialogTitle>
            <DialogDescription>使用微信扫一扫，添加好友</DialogDescription>
          </DialogHeader>
          <div class="flex items-center justify-center">
            <div class="relative w-full max-w-[420px] aspect-square overflow-hidden rounded-2xl border border-border/60 bg-white shadow-md [image-rendering:pixelated]">
              <img
                v-if="currentQrCode"
                :src="currentQrCode"
                alt="微信二维码"
                class="absolute inset-0 h-full w-full object-cover object-center"
              />
            </div>
          </div>
          <div class="mt-2 flex justify-end">
            <DialogClose as-child>
              <Button type="button" variant="outline" size="sm">关闭</Button>
            </DialogClose>
          </div>
        </DialogContent>
      </Dialog>

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
            合作/咨询发邮件（有归档更靠谱），日常交流走微信。
          </p>
        </div>
      </div>
    </section>
  </article>
</template>

<style scoped>
/* 展开过渡动画 */
.expand-enter-active,
.expand-leave-active {
  transition: max-height 0.3s ease, opacity 0.25s ease;
  max-height: 500px;
  overflow: hidden;
}
.expand-enter-from,
.expand-leave-to {
  max-height: 0;
  opacity: 0;
}
</style>
