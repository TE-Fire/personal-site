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
            <!--
              路由级转场：mode="out-in" 串行（先退后进）
              为什么不用并行？并行要求每页 absolute + 父容器相对定位，
              而博客详情页/标签页高度不定，absolute 会让容器高度塌陷，
              造成两页在文档流里上下堆叠 → 视觉错乱 / 卡死。
              串行通过一个内联骨架遮罩 (.buffer) 填满空窗 225ms，
              视觉上依然"连贯不断档"，同时 100% 稳定不卡。
            -->
            <div class="transition-buffer relative">
              <Transition name="page" mode="out-in">
                <component :is="Component" :key="r.fullPath" />
              </Transition>
            </div>
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
      <main class="flex-1 w-full relative">
        <RouterView v-slot="{ Component, route: r }">
          <div class="transition-buffer">
            <!-- 登录页轻过渡：只做 opacity，避免与左右分栏/全屏布局冲突 -->
            <Transition name="page-login" mode="out-in">
              <component :is="Component" :key="r.fullPath" />
            </Transition>
          </div>
        </RouterView>
      </main>
    </template>
  </div>
</template>

<!--
  ⚠️ 过渡类（.page-* / .page-login-*）定义在 src/styles/index.css 的 @layer base 中。
     不能写在 <style scoped> 内（scoped 会追加 [data-v-hash]，而 <Transition> 在子组件
     根 DOM 上直接加类、不带 hash → scoped 规则匹配失败 → 动画完全不生效）。
-->
