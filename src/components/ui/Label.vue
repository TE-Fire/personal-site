<script setup lang="ts">
import { computed } from 'vue'
import { cn } from '@/lib/utils'

/**
 * Label · shadcn-vue 风格。
 * 可选 peer-disabled:opacity-70 用于与表单控件关联（通过 native for 属性）。
 */
const props = defineProps<{ class?: any; htmlFor?: string }>()

const classes = computed(() =>
  cn(
    'text-sm font-medium leading-none text-text select-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
    props.class
  )
)
</script>

<template>
  <label :for="htmlFor" :class="classes" v-bind="$attrs">
    <slot />
  </label>
</template>
