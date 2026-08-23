<script setup lang="ts">
/**
 * AppLayout · 全局布局壳。
 * 职责：
 *   1) 套 Header + <RouterView> + Footer，固定页面骨架
 *   2) 提供外层 Vanta.js 3D 背景挂载点（id="vanta-bg"，T07 再注入实例）
 *   3) 统一的容器最大宽、内边距、内容区最小高度，让 Footer 永远被顶到底（min-h-[calc(100vh-?px)] + flex-col 布局）
 *
 * 背景分层（由下至上）：
 *   • z-0  3D 背景（Vanta）挂载点
 *   • z-0  页面内容（relative，建立层叠上下文但不盖背景）
 *   • z-40 Header（已在子组件 sticky）
 */
import { ref } from 'vue'
import Header from './Header.vue'
import Footer from './Footer.vue'
import DraggableCharacter from '@/components/DraggableCharacter.vue'
import { useVantaBackground } from '@/composables/useVantaBackground'
const vantaBgRef = ref<HTMLElement | null>(null)
useVantaBackground(vantaBgRef, { fixed: true })
</script>

<template>
  <div class="relative min-h-screen flex flex-col text-text bg-transparent">
    <!-- Vanta.js 3D 背景（持久层，所有页面共享，切换不会闪） -->
    <div
      ref="vantaBgRef"
      aria-hidden
      class="pointer-events-none fixed inset-0 z-0"
    />

    <Header class="relative z-20" />

    <!-- 主内容区：flex-1 + min-h-0 保证整体 footer 贴底 -->
    <main class="flex-1 w-full relative z-10 bg-surface/80 backdrop-blur-md">
      <div class="mx-auto w-full max-w-6xl px-6 md:px-10 lg:px-14 py-8 md:py-12">
        <RouterView v-slot="{ Component, route }">
          <Transition name="page" mode="out-in">
            <component :is="Component" :key="route.fullPath" />
          </Transition>
        </RouterView>
      </div>
    </main>

    <Footer />

    <!-- 右下角可拖动的虚拟形象（全局，所有页面可见） -->
    <DraggableCharacter />
  </div>
</template>

<style scoped>
/* 页面切换：平滑淡入淡出 + 纵向位移，过渡更柔和（prefers-reduced-motion 自动关） */
.page-enter-active,
.page-leave-active {
  transition: opacity 0.45s ease, transform 0.45s cubic-bezier(0.22, 1, 0.36, 1);
}
.page-enter-from {
  opacity: 0;
  transform: translateY(16px);
}
.page-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}
@media (prefers-reduced-motion: reduce) {
  .page-enter-active,
  .page-leave-active {
    transition: none;
  }
  .page-enter-from,
  .page-leave-to {
    transform: none;
  }
}
</style>
