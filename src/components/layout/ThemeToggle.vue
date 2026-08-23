<script setup lang="ts">
/**
 * 全局主题切换按钮（两段式：浅色 ☀️ / 深色 🌙）。
 * 点击一下循环切换：light ⇄ dark（不暴露"跟随系统"选项，视觉更直觉）
 */
import { Sun, Moon } from 'lucide-vue-next'
import { useTheme } from '@/composables/useTheme'
import { Button } from '@/components/ui'
import { computed } from 'vue'

const { mode, resolved, toggle } = useTheme()

/** 太阳/月亮图标按"当前解析出的实际主题"切换（跟随系统时，会显示系统实际对应的图标） */
const Icon = computed(() => resolved.value === 'light' ? Sun : Moon)

const title = computed(() => {
  if (mode.value === 'light') return '切换到深色模式'
  if (mode.value === 'dark') return '切换到浅色模式'
  return resolved.value === 'light' ? '切换到深色模式' : '切换到浅色模式'
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
        'bg-amber-400': resolved === 'light',
        'bg-indigo-500': resolved === 'dark'
      }"
      :aria-hidden="true"
    />
  </div>
</template>
