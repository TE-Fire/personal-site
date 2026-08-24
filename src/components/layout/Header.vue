<script setup lang="ts">
/**
 * Header · 全局顶部导航。
 * 功能：
 *   • 桌面端（≥md）：LOGO + 水平导航 5 项 + 主题切换按钮
 *   • 移动端（<md）：LOGO + 主题切换按钮 + 汉堡按钮（展开/收起侧边菜单）
 *   • Sticky 贴顶，滚动 y>24 时加玻璃毛玻璃 + 下边框 + 轻阴影（用 @vueuse/useWindowScroll）
 */
import { ref, computed } from 'vue'
import { useWindowScroll } from '@vueuse/core'
import { Menu, X, Sparkles } from 'lucide-vue-next'
import { RouterLink, useRoute } from 'vue-router'
import ThemeToggle from './ThemeToggle.vue'

const route = useRoute()
const { y } = useWindowScroll({ behavior: 'smooth' })
const scrolled = computed(() => y.value > 24)

const navItems = [
  { name: 'About' as const, label: '关于我', href: '/about' },
  { name: 'Portfolio' as const, label: '作品集', href: '/portfolio' },
  { name: 'Blog' as const, label: '博客', href: '/blog' },
  { name: 'Life' as const, label: '生活', href: '/life' },
  { name: 'Timeline' as const, label: '经历', href: '/timeline' },
  { name: 'Contact' as const, label: '联系我', href: '/contact' }
]

const menuOpen = ref(false)
function toggleMenu() { menuOpen.value = !menuOpen.value }
function closeMenu() { menuOpen.value = false }

/** 点击移动端菜单外部关闭（简化实现）：菜单打开状态下点击 <AppLayout> 内容区会冒泡到 body → 监听 body 非菜单点击 */
</script>

<template>
  <header
    class="sticky top-0 z-50 w-full transition-all duration-200 isolation: isolate"
    :class="[
      scrolled
        ? 'backdrop-blur-xl bg-surface/85 border-b border-border/60 shadow-sm'
        : 'backdrop-blur-md bg-surface/70 border-b border-border/40'
    ]"
  >
    <div class="mx-auto h-[68px] w-full max-w-screen-2xl px-4 md:px-8 flex items-center justify-between gap-4">
      <!-- LOGO 区 -->
      <RouterLink
        to="/"
        class="flex items-center gap-2.5 select-none group no-underline"
        aria-label="返回首页"
      >
        <span
          class="inline-flex size-10 items-center justify-center rounded-lg bg-brand/10 text-brand ring-1 ring-brand/30 transition-transform group-hover:scale-105"
        >
          <Sparkles class="size-5" :stroke-width="2" />
        </span>
        <span class="font-semibold tracking-tight text-[17px] leading-none">
          <span class="text-brand text-[18px]">T</span>
          <span class="text-text">rae</span>
          <span class="text-text-muted text-[13px] font-normal ml-1.5">/ portfolio</span>
        </span>
      </RouterLink>

      <!-- 桌面端导航（md 以上显示） -->
      <nav class="hidden md:flex items-center gap-1">
        <RouterLink
          v-for="link in navItems"
          :key="link.name"
          :to="link.href"
          class="relative px-3.5 py-2.5 rounded-lg text-[15px] font-medium no-underline transition-colors"
          :class="[
            route.path === link.href
              ? 'text-text bg-surface-muted/60'
              : 'text-text-muted hover:text-text hover:bg-surface-muted/30'
          ]"
        >
          {{ link.label }}
          <span
            v-if="route.path === link.href"
            class="pointer-events-none absolute -bottom-[1px] left-3 right-3 h-0.5 rounded-full bg-brand/80"
            aria-hidden
          />
        </RouterLink>
      </nav>

      <!-- 右侧动作区 -->
      <div class="flex items-center gap-2">
        <ThemeToggle />
        <!-- 移动端汉堡按钮（md 以下显示） -->
        <button
          type="button"
          class="md:hidden inline-flex items-center justify-center size-10 rounded-full text-text-muted hover:text-text hover:bg-surface-muted/40 transition"
          aria-label="切换导航菜单"
          :aria-expanded="menuOpen"
          @click="toggleMenu"
        >
          <Menu v-if="!menuOpen" class="size-5" />
          <X v-else class="size-5" />
        </button>
      </div>
    </div>

    <!-- 移动端下拉菜单（打开时滑下） -->
    <Transition name="mobile-menu">
      <div
        v-if="menuOpen"
        class="md:hidden border-b border-border/60 bg-surface/95 backdrop-blur-xl"
      >
        <nav class="mx-auto w-full max-w-screen-2xl px-4 py-3 flex flex-col gap-0.5">
          <RouterLink
            v-for="link in navItems"
            :key="link.name"
            :to="link.href"
            class="px-4 py-3 rounded-lg text-[15px] font-medium no-underline"
            :class="[
              route.path === link.href
                ? 'text-brand bg-brand/5'
                : 'text-text-muted hover:text-text hover:bg-surface-muted/50'
            ]"
            @click="closeMenu"
          >
            {{ link.label }}
          </RouterLink>
        </nav>
      </div>
    </Transition>
  </header>
</template>

<style scoped>
/* 移动端菜单展开的简易 fade-slide 过渡（避免未启用 GSAP 也有基础动效） */
.mobile-menu-enter-active,
.mobile-menu-leave-active {
  transition: opacity 0.18s ease, transform 0.2s ease;
}
.mobile-menu-enter-from,
.mobile-menu-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>
