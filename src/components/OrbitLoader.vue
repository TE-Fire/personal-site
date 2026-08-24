<script setup lang="ts">
/**
 * OrbitLoader · 轨道环绕加载动画。
 * 用于 3D 星链初始化等重计算场景。
 */
defineProps<{
  /** 是否显示 */
  visible: boolean
  /** 提示文字 */
  text?: string
}>()
</script>

<template>
  <Transition name="orbit-fade">
    <div
      v-if="visible"
      class="absolute inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-surface/40 backdrop-blur-sm"
    >
      <div class="orbit-container">
        <div class="orbit-center" />
        <div class="orbit-dot" />
        <div class="orbit-dot orbit-dot-2" />
      </div>
      <p v-if="text" class="m-0 text-xs font-mono text-text-muted animate-pulse">
        {{ text }}
      </p>
    </div>
  </Transition>
</template>

<style scoped>
.orbit-container {
  position: relative;
  width: 48px;
  height: 48px;
}

.orbit-center {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 10px;
  height: 10px;
  margin: -5px 0 0 -5px;
  border-radius: 50%;
  background: var(--brand);
  box-shadow: 0 0 8px var(--brand);
}

.orbit-dot {
  position: absolute;
  top: 0;
  left: 50%;
  width: 7px;
  height: 7px;
  margin-left: -3.5px;
  border-radius: 50%;
  background: var(--accent);
  transform-origin: 3.5px 24px;
  animation: orbit-spin 1.2s linear infinite;
}

.orbit-dot-2 {
  background: var(--chart-series-4, #22A5F7);
  animation-duration: 1.8s;
  animation-direction: reverse;
  transform-origin: 3.5px 24px;
}

@keyframes orbit-spin {
  to { transform: rotate(360deg); }
}

.orbit-fade-enter-active,
.orbit-fade-leave-active {
  transition: opacity 0.3s ease;
}
.orbit-fade-enter-from,
.orbit-fade-leave-to {
  opacity: 0;
}
</style>
