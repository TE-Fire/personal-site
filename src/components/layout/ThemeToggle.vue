<script setup lang="ts">
/**
 * 全局主题切换按钮（三段式：浅色 / 深色 / 跟随系统）。
 * 尺寸 size=icon；变体 variant=ghost（匹配 Header 的玻璃感 + 不抢视觉重心）
 * 点击一下循环切换：light → dark → system → light ...
 */
import { Sun, Moon, Monitor } from 'lucide-vue-next'
import { useTheme } from '@/composables/useTheme'
import { Button } from '@/components/ui'
import { computed } from 'vue'

const { mode, toggle } = useTheme()

/** 与当前 mode 对应的显示 SVG（让按钮有反馈） */
const Icon = computed(() => {
  if (mode.value === 'light') return Sun
  if (mode.value === 'dark') return Moon
  return Monitor
})

const title = computed(() => {
  if (mode.value === 'light') return '浅色模式（点击切换到深色）'
  if (mode.value === 'dark') return '深色模式（点击跟随系统）'
  return '跟随系统（点击切换到浅色）'
})
</script>

<template>
  <div class="relative flex items-center">
    <Button
      variant="outline"
      size="icon"
      :title="title"
      aria-label="切换主题"
      @click="toggle"
      class="!rounded-full !bg-surface-elevated/60 hover:!bg-brand/10 hover:!text-brand hover:!border-brand/40 transition-all"
    >
      <component :is="Icon" class="size-[18px]" />
    </Button>
    <span
      class="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-surface"
      :class="{
        'bg-amber-400': mode === 'light',
        'bg-indigo-500': mode === 'dark',
        'bg-emerald-500': mode === 'system'
      }"
      :aria-hidden="true"
    />
  </div>
</template>
