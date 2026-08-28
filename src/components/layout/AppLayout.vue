<script setup lang="ts">
/**
 * AppLayout · 全局布局壳。
 * 职责：
 *   1) 默认：套 Header + <RouterView>(带 max-w 容器) + Footer
 *   2) 登录页（/login）：去掉 Header / Footer / 两个全局悬浮组件，
 *      RouterView 直接全屏渲染（登录页自带左右分栏布局 + 容器）
 *   3) 提供外层 2D 渐变背景
 */
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import Header from './Header.vue'
import Footer from './Footer.vue'
import DraggableCharacter from '@/components/DraggableCharacter.vue'
import DraggableStatsWidget from '@/components/DraggableStatsWidget.vue'

const route = useRoute()

/** 是否是登录页：登录页独占全屏，不套全局 Header/Footer/悬浮窗/容器 */
const isLoginPage = computed(() => route.path === '/login')
</script>

<template>
  <div class="relative min-h-screen flex flex-col text-text">
    <!-- 全站 2D 渐变背景（深浅色自适应） -->
    <div
      aria-hidden
      class="pointer-events-none fixed inset-0 -z-10 site-bg"
    />

    <!-- ========= 非登录页：Header + 带最大宽容器的 main + Footer ========= -->
    <template v-if="!isLoginPage">
      <Header class="relative z-20" />

      <main class="flex-1 w-full relative z-10">
        <div class="mx-auto w-full max-w-6xl px-6 md:px-10 lg:px-14 py-8 md:py-12">
          <RouterView v-slot="{ Component, route: r }">
            <Transition name="page" mode="out-in">
              <component :is="Component" :key="r.fullPath" />
            </Transition>
          </RouterView>
        </div>
      </main>

      <Footer />

      <!-- 右下角可拖动的虚拟形象 -->
      <DraggableCharacter />
      <!-- 左上角可拖动的博客数据面板 -->
      <DraggableStatsWidget />
    </template>

    <!-- ========= 登录页：直接渲染 RouterView，独占全屏 ========= -->
    <template v-else>
      <main class="flex-1 w-full">
        <RouterView v-slot="{ Component, route: r }">
          <Transition name="page" mode="out-in">
            <component :is="Component" :key="r.fullPath" />
          </Transition>
        </RouterView>
      </main>
    </template>
  </div>
</template>

<style scoped>
/* 页面切换：平滑淡入淡出 + 纵向位移 */
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
