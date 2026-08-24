<script setup lang="ts">
/**
 * LoadingOverlay · 全屏加载遮罩（渐变环）。
 * 用于路由切换、首屏加载等场景。
 */
defineProps<{
  /** 是否显示 */
  visible: boolean
  /** 加载提示文字 */
  text?: string
}>()
</script>

<template>
  <Transition name="overlay-fade">
    <div
      v-if="visible"
      class="loading-overlay fixed inset-0 z-[9999] flex flex-col items-center justify-center gap-5 bg-surface/80 backdrop-blur-md"
    >
      <!-- 渐变环 -->
      <div class="gradient-ring" />
      <!-- 文字 -->
      <p v-if="text" class="m-0 text-sm font-mono text-text-muted animate-pulse">
        {{ text }}
      </p>
    </div>
  </Transition>
</template>

<style scoped>
/* 渐变环：conic-gradient + mask 镂空 */
.gradient-ring {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: conic-gradient(var(--brand), var(--accent), var(--chart-series-4, #22A5F7), var(--brand));
  -webkit-mask: radial-gradient(circle, transparent 56%, black 57%);
  mask: radial-gradient(circle, transparent 56%, black 57%);
  animation: spin 0.9s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* 进入/离开过渡 */
.overlay-fade-enter-active,
.overlay-fade-leave-active {
  transition: opacity 0.3s ease;
}
.overlay-fade-enter-from,
.overlay-fade-leave-to {
  opacity: 0;
}
</style>
