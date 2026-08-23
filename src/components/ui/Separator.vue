<script setup lang="ts">
import { computed } from 'vue'
import { cn } from '@/lib/utils'

/**
 * Separator · shadcn-vue vega 风格。
 * orientation: horizontal（默认水平分隔一条线） | vertical（垂直分隔一条线）
 */
const props = withDefaults(
  defineProps<{
    orientation?: 'horizontal' | 'vertical'
    decorative?: boolean
    class?: any
  }>(),
  {
    orientation: 'horizontal',
    decorative: true
  }
)

const classes = computed(() =>
  cn(
    'shrink-0 bg-border',
    props.orientation === 'horizontal' ? 'h-px w-full' : 'h-full w-px',
    props.class
  )
)

const role = props.decorative ? 'separator' : undefined
const ariaOrientation = !props.decorative ? props.orientation : undefined
</script>

<template>
  <div
    :role="role"
    :aria-orientation="ariaOrientation"
    :data-orientation="orientation"
    :class="classes"
    v-bind="$attrs"
  />
</template>
