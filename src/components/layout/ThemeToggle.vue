<script setup lang="ts">
/**
 * 全局主题切换 · Segmented Switch（shadcn-vue ToggleGroup 风格）。
 *
 * 设计：
 *   · 容器 rounded-full，内部两颗 icon 按钮（☀️ 日间 / 🌙 夜间）
 *   · 选中侧有白色 pill（absolute + transition 平滑滑动）
 *   · mode='system'（跟随系统）时，pill 停在 resolved 实际主题侧，并附带一颗 tiny 小圆点提示"跟随系统"
 *   · 深色模式下：容器底色反相、pill 颜色切到 surface-elevated、图标色保持一致
 */
import { computed } from 'vue'
import { Sun, Moon } from 'lucide-vue-next'
import { useTheme } from '@/composables/useTheme'

const { mode, resolved, setMode } = useTheme()

/**
 * 当前选中的显示侧（用于 pill 定位 + 按钮样式）。
 *   · 若用户手动选了 light/dark → 用 mode
 *   · 若 system → 用 resolved（跟随系统当前实际主题）
 */
const activeSide = computed<'light' | 'dark'>(() => {
  if (mode.value === 'light' || mode.value === 'dark') return mode.value
  return resolved.value
})

const isSystem = computed(() => mode.value === 'system')
</script>

<template>
  <div
    class="relative flex h-9 w-[88px] items-center rounded-full bg-surface-muted/60 p-1 ring-1 ring-border/50 transition-colors"
    role="radiogroup"
    aria-label="切换主题"
  >
    <!-- 选中侧的滑动 pill（浅色白、深色反相） -->
    <span
      aria-hidden
      class="absolute top-1 bottom-1 w-[40px] rounded-full bg-surface shadow-sm ring-1 ring-border/60 transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] dark:bg-surface-elevated"
      :class="activeSide === 'light' ? 'left-1' : 'left-[46px]'"
    />

    <!-- ☀️ 日间 -->
    <button
      type="button"
      role="radio"
      :aria-checked="activeSide === 'light'"
      class="relative z-10 flex h-full flex-1 items-center justify-center rounded-full transition-colors"
      :class="activeSide === 'light' ? 'text-amber-500' : 'text-text-muted hover:text-text'"
      :title="activeSide === 'light' ? '当前：日间模式（点击切夜间）' : '切换到日间模式'"
      @click="setMode('light')"
    >
      <Sun class="size-[16px]" :stroke-width="activeSide === 'light' ? 2.2 : 1.8" />
    </button>

    <!-- 🌙 夜间 -->
    <button
      type="button"
      role="radio"
      :aria-checked="activeSide === 'dark'"
      class="relative z-10 flex h-full flex-1 items-center justify-center rounded-full transition-colors"
      :class="activeSide === 'dark' ? 'text-indigo-500' : 'text-text-muted hover:text-text'"
      :title="activeSide === 'dark' ? '当前：夜间模式（点击切日间）' : '切换到夜间模式'"
      @click="setMode('dark')"
    >
      <Moon class="size-[16px]" :stroke-width="activeSide === 'dark' ? 2.2 : 1.8" />
    </button>

    <!-- 跟随系统提示：system 模式时 pill 旁边亮一颗 tiny 小圆点（浅色=amber / 深色=indigo） -->
    <span
      v-if="isSystem"
      aria-hidden
      class="absolute -bottom-0.5 right-3 size-1.5 rounded-full ring-2 ring-surface"
      :class="resolved === 'light' ? 'bg-amber-400' : 'bg-indigo-500'"
    />
  </div>
</template>
