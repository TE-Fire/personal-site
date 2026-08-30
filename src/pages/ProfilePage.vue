<script setup lang="ts">
/**
 * ProfilePage · 个人资料编辑页（/profile）
 *
 * 布局：左右两栏 · 桌面端并排 / 移动端堆叠
 *   左侧：头像卡片（圆形预览 + 上传 + 清除）
 *   右侧：表单（username 只读 + nickname + email）+ 保存按钮
 *
 * 依赖：
 *   · authStore.updateProfile / uploadAvatar / removeAvatar / resolveAvatarUrl
 *   · 路由守卫已保证 requiresAuth=true 才能进来
 */
import { computed, onMounted, ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { Button, Card, Input, Label } from '@/components/ui'
import { UserCircle2, Camera, X, Check, Loader2 } from 'lucide-vue-next'

const authStore = useAuthStore()

/* ---------- 表单状态 ---------- */
// 用本地 ref 让"取消后不保存"成为可能
const nickname = ref('')
const email = ref<string | null>('')
const avatarPreview = ref<string | null>(null)   // 上传过程中的临时预览
const submitting = ref(false)

/** 从 store 初始化表单（mounted 时 + 每次 fetchProfile 后） */
function syncFromStore() {
  const u = authStore.user
  if (!u) return
  nickname.value = u.nickname ?? ''
  email.value = u.email ?? ''
  avatarPreview.value = authStore.resolveAvatarUrl(u.avatar)
}

/** 首次挂载：如果 store 里还没有 user（刷新页面场景），拉一次 */
onMounted(async () => {
  if (!authStore.user) {
    try {
      await authStore.fetchProfile()
    } catch {
      // 没登录会被路由守卫拦下，走到这里说明 token 过期 → store.logout() 已由 axios 拦截器处理
      return
    }
  }
  syncFromStore()
})

/* ---------- 反馈提示（顶部 toast） ---------- */
type Feedback = { type: 'success' | 'error'; message: string } | null
const feedback = ref<Feedback>(null)
let feedbackTimer: number | undefined
function showFeedback(type: 'success' | 'error', message: string) {
  feedback.value = { type, message }
  if (feedbackTimer) window.clearTimeout(feedbackTimer)
  feedbackTimer = window.setTimeout(() => { feedback.value = null }, 3000)
}

/* ---------- 头像上传 ---------- */
const fileInput = ref<HTMLInputElement | null>(null)

const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const MAX_SIZE = 5 * 1024 * 1024 // 5MB

function triggerUpload() {
  fileInput.value?.click()
}

async function onFileChange(ev: Event) {
  const input = ev.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  input.value = '' // 重置，下次选同一张图也能触发 change

  // 前端预校验（后端也有，双重保险）
  if (!ALLOWED_MIMES.includes(file.type)) {
    showFeedback('error', '仅支持 JPG / PNG / WEBP / GIF 格式')
    return
  }
  if (file.size > MAX_SIZE) {
    showFeedback('error', '头像不能超过 5MB')
    return
  }

  // 先本地预览（立即反馈）
  const localUrl = URL.createObjectURL(file)
  avatarPreview.value = localUrl

  // 上传
  try {
    await authStore.uploadAvatar(file)
    // 上传成功后 authStore.user.avatar 已更新 → 用正式 URL 替换本地 blob URL
    avatarPreview.value = authStore.resolveAvatarUrl(authStore.user?.avatar)
    showFeedback('success', '头像更新成功')
  } catch (err: any) {
    // 失败则回滚预览
    syncFromStore()
    showFeedback('error', err?.message || '上传失败')
  }
}

async function onRemoveAvatar() {
  try {
    await authStore.removeAvatar()
    avatarPreview.value = null
    showFeedback('success', '头像已清除')
  } catch (err: any) {
    showFeedback('error', err?.message || '清除失败')
  }
}

/* ---------- 表单提交 ---------- */
const hasChanges = computed(() => {
  const u = authStore.user
  if (!u) return false
  const emailChanged = (email.value ?? '') !== (u.email ?? '')
  const nickChanged = nickname.value !== (u.nickname ?? u.username)
  return nickChanged || emailChanged
})

async function onSubmit() {
  if (!hasChanges.value || submitting.value) return
  submitting.value = true
  try {
    await authStore.updateProfile({
      nickname: nickname.value.trim(),
      email: email.value === '' ? '' : email.value.trim(),
    })
    showFeedback('success', '资料已保存')
  } catch (err: any) {
    showFeedback('error', err?.message || '保存失败')
  } finally {
    submitting.value = false
  }
}

function onCancel() {
  syncFromStore()
}
</script>

<template>
  <div class="max-w-3xl mx-auto space-y-6">
    <!-- 反馈 Toast -->
    <Transition name="toast-global">
      <div
        v-if="feedback"
        :role="feedback.type === 'error' ? 'alert' : 'status'"
        :class="[
          'fixed top-20 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl border shadow-lg text-sm',
          feedback.type === 'error'
            ? 'border-danger/30 bg-danger/5 text-danger'
            : 'border-success/30 bg-success/5 text-success',
        ]"
      >
        {{ feedback.message }}
      </div>
    </Transition>

    <!-- 标题 -->
    <div>
      <h1 class="text-2xl font-semibold tracking-tight">个人资料</h1>
      <p class="mt-1 text-sm text-text-muted">管理你的账号信息</p>
    </div>

    <!-- 主体 -->
    <div class="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-6">
      <!-- ========= 左栏：头像卡片 ========= -->
      <Card class="p-6 flex flex-col items-center text-center gap-5">
        <!-- 圆形头像 -->
        <div class="relative">
          <!-- 头像占位符 / 图片 -->
          <div
            class="size-36 rounded-full overflow-hidden ring-4 ring-brand/15 bg-surface-muted flex items-center justify-center"
          >
            <img
              v-if="avatarPreview"
              :src="avatarPreview"
              alt="avatar"
              class="size-full object-cover"
              @error="avatarPreview = null"
            />
            <UserCircle2 v-else class="size-20 text-brand/50" :stroke-width="1.5" />
          </div>

          <!-- 上传按钮盖在头像右下角 -->
          <button
            type="button"
            class="absolute -bottom-1 -right-1 size-9 rounded-full bg-brand text-white shadow-md hover:bg-brand/90 transition flex items-center justify-center ring-2 ring-surface"
            @click="triggerUpload"
            title="上传头像"
          >
            <Camera class="size-4" />
          </button>
        </div>

        <!-- 隐藏的 file input -->
        <input
          ref="fileInput"
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          class="hidden"
          @change="onFileChange"
        />

        <!-- 操作按钮 -->
        <div class="w-full space-y-2">
          <Button type="button" class="w-full" variant="outline" @click="triggerUpload">
            <Camera class="size-4" />
            选择头像
          </Button>
          <Button
            v-if="authStore.user?.avatar"
            type="button"
            variant="ghost"
            class="w-full text-danger hover:text-danger hover:bg-danger/10"
            @click="onRemoveAvatar"
          >
            <X class="size-4" />
            清除头像
          </Button>
        </div>

        <!-- 提示 -->
        <p class="text-[11px] text-text-muted/70 leading-relaxed">
          支持 JPG / PNG / WEBP / GIF<br>
          最大 5MB
        </p>
      </Card>

      <!-- ========= 右栏：表单 ========= -->
      <Card class="p-6 space-y-5">
        <!-- Username（只读） -->
        <div class="space-y-1.5">
          <Label class="text-xs font-normal text-text-muted">
            用户名 <span class="text-text-muted/50">· 账号创建后不可修改</span>
          </Label>
          <Input
            :value="authStore.user?.username ?? ''"
            disabled
            class="opacity-60 cursor-not-allowed"
          />
        </div>

        <!-- Nickname -->
        <div class="space-y-1.5">
          <Label class="text-xs font-normal text-text-muted">昵称</Label>
          <Input
            v-model="nickname"
            maxlength="50"
            placeholder="显示名称"
          />
        </div>

        <!-- Email -->
        <div class="space-y-1.5">
          <Label class="text-xs font-normal text-text-muted">
            邮箱 <span class="text-text-muted/50">· 留空则清除</span>
          </Label>
          <Input
            v-model="email"
            type="email"
            maxlength="100"
            placeholder="you@example.com"
          />
        </div>

        <!-- Role（只读 · 漂亮展示） -->
        <div class="space-y-1.5">
          <Label class="text-xs font-normal text-text-muted">角色</Label>
          <div class="flex items-center gap-2">
            <span class="inline-flex items-center gap-1.5 text-sm px-2.5 py-1 rounded-full bg-brand/10 text-brand ring-1 ring-brand/30">
              <Check class="size-3.5" />
              {{ authStore.user?.role === 'admin' ? '管理员' : authStore.user?.role }}
            </span>
          </div>
        </div>

        <!-- 底部按钮 -->
        <div class="flex items-center justify-end gap-2 pt-2 border-t border-border/60">
          <Button
            type="button"
            variant="outline"
            :disabled="!hasChanges || submitting"
            @click="onCancel"
          >
            取消
          </Button>
          <Button
            type="button"
            :disabled="!hasChanges || submitting"
            @click="onSubmit"
          >
            <Loader2 v-if="submitting" class="size-4 animate-spin" />
            保存
          </Button>
        </div>
      </Card>
    </div>
  </div>
</template>

<style scoped>
.toast-global-enter-active,
.toast-global-leave-active {
  transition: opacity 0.2s ease, transform 0.28s cubic-bezier(0.22, 1, 0.36, 1);
}
.toast-global-enter-from,
.toast-global-leave-to {
  opacity: 0;
  transform: translate(-50%, -8px);
}

@media (prefers-reduced-motion: reduce) {
  .toast-global-enter-active,
  .toast-global-leave-active { transition: none; }
  .toast-global-enter-from,
  .toast-global-leave-to { transform: translate(-50%, 0); }
}
</style>
