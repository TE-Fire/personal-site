<script setup lang="ts">
/**
 * 登录页 LoginPage（v2 · 纯登录内容）
 *
 * 布局：
 *   · 桌面：左右分栏 grid-cols-12 (5+7 比例)
 *     - 左 5 格：LoginHero 动画区（角色+光点+鼠标跟随）
 *     - 右 7 格：登录表单（居中）
 *   · 移动端（<md）：单列，先表单再动画（或隐藏动画）
 *
 * 登录流程：
 *   1. 用户填写用户名 + 密码
 *   2. 点"登录"按钮
 *   3. 弹出 CaptchaModal 滑块验证码
 *   4. 验证码通过 → 自动提交账号密码到后端
 *   5. 登录成功 → 跳转 redirect 或 首页
 *   6. 登录失败 → 提示错误 + 下次再点登录时弹窗会刷新验证码
 *
 * 与 LoginHero 交互：
 *   · focusField prop：告诉 hero 当前聚焦的输入框
 *   · passwordLen prop：密码长度变化 → hero 遮眼强度变化
 */
import { ref, computed } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { User, Lock, Eye, EyeOff, Loader2, AlertCircle, ArrowLeft, Sparkles } from 'lucide-vue-next';
import { useAuthStore } from '@/stores/auth';
import LoginHero from '@/components/LoginHero.vue';
import CaptchaModal from '@/components/CaptchaModal.vue';
import Button from '@/components/ui/Button.vue';
import Input from '@/components/ui/Input.vue';

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();

/* ---------- 表单状态 ---------- */
const username = ref('');
const password = ref('');
const showPassword = ref(false);
const loading = ref(false);
const errorMsg = ref('');

/* ---------- 与 Hero 交互的状态 ---------- */
const focusField = ref<'username' | 'password' | null>(null);
const passwordLen = computed(() => password.value.length);

/* ---------- 验证码弹窗 ---------- */
const captchaOpen = ref(false);
const captchaData = ref<{ captchaId: string; slideX: number } | null>(null);
interface CaptchaModalInstance {
  resetForRetry: () => void;
}
const captchaModalRef = ref<CaptchaModalInstance | null>(null);

/* ---------- 登录按钮点击 → 先弹验证码 ---------- */
function handleLoginBtnClick() {
  // 基础校验
  if (!username.value.trim()) {
    errorMsg.value = '请输入用户名';
    return;
  }
  if (!password.value) {
    errorMsg.value = '请输入密码';
    return;
  }
  errorMsg.value = '';
  captchaData.value = null;
  captchaOpen.value = true;
}

/* ---------- 验证码通过 → 实际提交登录 ---------- */
async function onCaptchaVerified(data: { captchaId: string; slideX: number }) {
  captchaData.value = data;

  loading.value = true;
  errorMsg.value = '';

  try {
    await authStore.login({
      username: username.value.trim(),
      password: password.value,
      captchaId: data.captchaId,
      slideX: data.slideX,
    });

    // 登录成功 → 跳转
    const redirect = (route.query.redirect as string) || '/';
    router.replace(redirect);
  } catch (e: any) {
    errorMsg.value = e?.message || '登录失败';
    // 登录失败：下次点登录，弹窗验证码会自动刷新
    captchaModalRef.value?.resetForRetry();
  } finally {
    loading.value = false;
  }
}

/** 验证码弹窗取消（用户点 ESC/遮罩/关闭） */
function onCaptchaCancelled() {
  // 不做特殊处理，用户可以再点登录
}
</script>

<template>
  <div class="min-h-screen w-full overflow-hidden bg-white dark:bg-slate-950">
    <div class="grid grid-cols-1 md:grid-cols-12 min-h-screen">
      <!-- ============ 左侧：LoginHero 动画区（md 以上显示） ============ -->
      <div class="hidden md:col-span-5 md:block">
        <div class="h-screen w-full">
          <LoginHero
            :focus-field="focusField"
            :password-len="passwordLen"
          />
        </div>
      </div>

      <!-- ============ 右侧：登录表单 ============ -->
      <div class="col-span-1 md:col-span-7 flex items-center justify-center px-5 py-10">
        <div class="w-full max-w-md">
          <!-- 移动端顶部 LOGO（只有 <md 时看得到） -->
          <div class="mb-8 flex items-center justify-center gap-3 md:hidden">
            <div class="flex size-10 items-center justify-center rounded-xl bg-brand shadow-lg shadow-brand/25 text-white">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 2l2.39 7.36H22l-6.2 4.5L18.18 22 12 17.27 5.82 22l2.38-8.14L2 9.36h7.61z"/>
              </svg>
            </div>
            <div class="text-lg font-bold tracking-tight text-text">Trae · 作品集</div>
          </div>

          <!-- 登录卡片 -->
          <div class="rounded-3xl border border-border/40 bg-surface/60 p-8 shadow-xl shadow-slate-200/50 backdrop-blur-xl dark:shadow-black/30">
            <!-- 标题 -->
            <div class="mb-7 text-center">
              <div class="mx-auto mb-3 flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand to-purple-600 shadow-lg shadow-brand/30 text-white">
                <Sparkles class="size-7" />
              </div>
              <h1 class="text-2xl font-bold tracking-tight text-text">
                欢迎回来
              </h1>
              <p class="mt-1.5 text-sm text-text-muted">
                请登录以管理你的内容，创作美好的故事
              </p>
            </div>

            <!-- 表单 -->
            <form class="space-y-5" @submit.prevent="handleLoginBtnClick">
              <!-- 用户名 -->
              <div class="space-y-2">
                <label class="text-sm font-medium text-text">用户名</label>
                <div class="relative">
                  <User class="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted" />
                  <Input
                    v-model="username"
                    type="text"
                    placeholder="admin"
                    class="pl-9"
                    autocomplete="username"
                    @focus="focusField = 'username'"
                    @blur="focusField = null"
                  />
                </div>
              </div>

              <!-- 密码 -->
              <div class="space-y-2">
                <label class="text-sm font-medium text-text">密码</label>
                <div class="relative">
                  <Lock class="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted" />
                  <Input
                    v-model="password"
                    :type="showPassword ? 'text' : 'password'"
                    placeholder="••••••"
                    class="px-9"
                    autocomplete="current-password"
                    @focus="focusField = 'password'"
                    @blur="focusField = null"
                  />
                  <button
                    type="button"
                    class="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted transition hover:text-text"
                    @click="showPassword = !showPassword"
                    :aria-label="showPassword ? '隐藏密码' : '显示密码'"
                  >
                    <Eye v-if="showPassword" class="size-4" />
                    <EyeOff v-else class="size-4" />
                  </button>
                </div>
              </div>

              <!-- 错误提示 -->
              <Transition name="err">
                <div
                  v-if="errorMsg"
                  class="flex items-center gap-2 rounded-xl bg-danger/10 px-3 py-2.5 text-sm text-danger"
                >
                  <AlertCircle class="size-4 shrink-0" />
                  <span>{{ errorMsg }}</span>
                </div>
              </Transition>

              <!-- 登录按钮（始终可点击，点击后弹出验证码） -->
              <Button
                type="submit"
                class="h-11 w-full rounded-xl text-sm font-medium shadow-lg shadow-brand/25 transition active:scale-[0.99]"
                :disabled="loading"
              >
                <Loader2 v-if="loading" class="mr-2 size-4 animate-spin" />
                <span>{{ loading ? '登录中…' : '登 录' }}</span>
              </Button>
            </form>

            <!-- 分割线 -->
            <div class="my-6 flex items-center gap-3">
              <div class="h-px flex-1 bg-border/60" />
              <span class="text-xs text-text-muted">·</span>
              <div class="h-px flex-1 bg-border/60" />
            </div>

            <!-- 返回首页 -->
            <div class="flex items-center justify-center">
              <router-link
                to="/"
                class="group inline-flex items-center gap-1 text-xs text-text-muted transition hover:text-brand"
              >
                <ArrowLeft class="size-3.5 transition-transform group-hover:-translate-x-0.5" />
                <span>返回首页</span>
              </router-link>
            </div>
          </div>

          <!-- 版权（桌面端右侧底部） -->
          <div class="mt-8 text-center text-xs text-text-muted/70 md:hidden">
            © 2026 TE-Fire · Made with love
          </div>
        </div>
      </div>
    </div>

    <!-- 验证码弹窗（点登录后弹出） -->
    <CaptchaModal
      ref="captchaModalRef"
      v-model:open="captchaOpen"
      @verified="onCaptchaVerified"
      @cancelled="onCaptchaCancelled"
    />
  </div>
</template>

<style scoped>
.err-enter-active,
.err-leave-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
}
.err-enter-from,
.err-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
