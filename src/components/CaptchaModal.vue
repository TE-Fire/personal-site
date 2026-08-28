<script setup lang="ts">
/**
 * 滑块验证码弹窗
 *
 * 使用场景：
 *   · 登录页：用户填完账号密码 → 点登录 → 弹出此弹窗
 *   · 用户拖动滑块 → 校验通过 → 自动关闭弹窗并 emit('verified', data)
 *   · 父组件收到 verified 事件后，提交登录请求
 *
 * 支持：
 *   · v-model:open 双向绑定显示状态
 *   · ESC / 点击遮罩 关闭（关闭时滑块状态重置）
 *   · 每次打开自动刷新验证码
 */
import { ref, watch, onMounted, onUnmounted } from 'vue';
import { X, Loader2, ShieldCheck } from 'lucide-vue-next';
import SlideCaptcha from '@/components/SlideCaptcha.vue';

const props = defineProps<{
  /** 弹窗是否打开（v-model:open） */
  open: boolean;
}>();

const emit = defineEmits<{
  'update:open': [v: boolean];
  /** 验证通过：父组件用 captchaId + slideX 去提交业务请求 */
  verified: [data: { captchaId: string; slideX: number }];
  /** 用户取消（点遮罩/ESC/关闭按钮） */
  cancelled: [];
}>();

/* ---------- 状态 ---------- */
interface CaptchaInstance {
  markSuccess: () => void;
  markFail: () => Promise<void>;
  refresh: () => Promise<void>;
}
const captchaRef = ref<CaptchaInstance | null>(null);
const verifying = ref(false); // 预留：如果需要等待后端校验，可用此状态

/* ---------- 显隐控制 ---------- */

/** 打开弹窗时自动刷新验证码 */
watch(
  () => props.open,
  (v) => {
    if (v) {
      verifying.value = false;
      // 打开后下一帧再 refresh，确保组件已挂载
      setTimeout(() => captchaRef.value?.refresh(), 50);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
  },
);

/** ESC 关闭 */
function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape' && props.open) close();
}
onMounted(() => window.addEventListener('keydown', onKey));
onUnmounted(() => {
  window.removeEventListener('keydown', onKey);
  document.body.style.overflow = '';
});

function close() {
  emit('update:open', false);
  emit('cancelled');
  document.body.style.overflow = '';
}

/* ---------- 验证回调 ---------- */

/** 滑块拖动完成，父（LoginPage）把 captchaId/slideX 带走提交登录 */
function onCaptchaSuccess(payload: { captchaId: string; slideX: number }) {
  captchaRef.value?.markSuccess();
  verifying.value = true;

  // 给一点视觉反馈时间，再关闭
  setTimeout(() => {
    emit('verified', payload);
    emit('update:open', false);
    document.body.style.overflow = '';
  }, 350);
}

function onCaptchaFail() {
  captchaRef.value?.markFail();
}

/* ---------- 暴露给父组件：登录失败时调用，让滑块刷新归位 ---------- */
/**
 * 登录失败后调用：弹窗已关闭的情况下只清除旧状态，
 * 下次打开会自动 refresh。
 */
function resetForRetry() {
  verifying.value = false;
}
defineExpose({ resetForRetry });
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="open"
        class="fixed inset-0 z-[9999] flex items-center justify-center p-4"
        role="dialog"
        aria-modal="true"
        aria-label="安全验证"
      >
        <!-- 遮罩 -->
        <div
          class="absolute inset-0 bg-black/50 backdrop-blur-sm"
          @click="close"
        />

        <!-- 弹窗卡片 -->
        <div
          class="relative w-full max-w-md rounded-2xl border border-border/60 bg-surface p-6 shadow-2xl"
        >
          <!-- 顶部：标题 + 关闭 -->
          <div class="mb-4 flex items-center justify-between">
            <div class="flex items-center gap-2">
              <div class="flex size-9 items-center justify-center rounded-xl bg-brand/10 text-brand">
                <ShieldCheck class="size-5" />
              </div>
              <div>
                <h3 class="text-base font-semibold text-text">安全验证</h3>
                <p class="text-xs text-text-muted">拖动滑块完成拼图，防止恶意请求</p>
              </div>
            </div>
            <button
              type="button"
              class="flex size-8 items-center justify-center rounded-lg text-text-muted transition hover:bg-surface-muted/60 hover:text-text"
              @click="close"
              aria-label="关闭"
            >
              <X class="size-4" />
            </button>
          </div>

          <!-- 验证码组件 -->
          <div class="flex justify-center py-2">
            <SlideCaptcha
              ref="captchaRef"
              @success="onCaptchaSuccess"
              @fail="onCaptchaFail"
            />
          </div>

          <!-- 校验中指示 -->
          <div v-if="verifying" class="mt-2 flex items-center justify-center gap-2 text-xs text-green-600">
            <Loader2 class="size-3.5 animate-spin" />
            <span>验证通过，正在登录…</span>
          </div>

          <!-- 底部提示 -->
          <div class="mt-4 border-t border-border/40 pt-3 text-center text-xs text-text-muted">
            无法完成验证？请检查网络或点击右上角
            <span class="text-brand">&nbsp;刷新&nbsp;</span>
            重试
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
/* 弹窗动画 */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}
.modal-enter-active > div:last-child,
.modal-leave-active > div:last-child {
  transition: transform 0.25s cubic-bezier(0.22, 1, 0.36, 1),
    opacity 0.25s ease;
}
.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
.modal-enter-from > div:last-child,
.modal-leave-to > div:last-child {
  transform: translateY(16px) scale(0.96);
  opacity: 0;
}
</style>
