<script setup lang="ts">
/**
 * AppToaster —— 页面正上方居中的全局 Toast/Snackbar 渲染层。
 * 用法：在 AppLayout.vue 顶部挂一次即可。
 * （和 useToast() composable 配套，reactive 单例驱动）
 */
import { TOAST_ICON, TOAST_CLOSE_ICON, __getToastsRaw, remove as toastRemove, type ToastItem } from '@/composables/useToast';

const toasts = __getToastsRaw();

function variantClass(t: ToastItem): string {
  return `toast--${t.variant}`;
}
</script>

<template>
  <div class="toast-root" aria-live="polite" aria-atomic="true">
    <TransitionGroup name="toast-list" tag="div" style="display:flex; flex-direction:column; gap:8px;">
      <div
        v-for="t in toasts"
        :key="t.id"
        class="toast"
        :class="[variantClass(t), { 'is-leaving': t.leaving }]"
        :role="t.variant === 'danger' || t.variant === 'warn' ? 'alert' : 'status'"
      >
        <component :is="TOAST_ICON[t.variant]" class="toast__icon" aria-hidden="true" />
        <div class="toast__body">
          <div class="toast__title">{{ t.title }}</div>
          <div v-if="t.description" class="toast__msg">{{ t.description }}</div>
        </div>
        <button
          type="button"
          class="toast__close"
          @click="toastRemove(t.id)"
          aria-label="关闭提示"
        >
          <component :is="TOAST_CLOSE_ICON" :size="15" aria-hidden="true" />
        </button>
      </div>
    </TransitionGroup>
  </div>
</template>
