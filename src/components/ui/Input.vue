<script setup lang="ts">
import { computed } from 'vue'
import { cn } from '@/lib/utils'

/**
 * Input · shadcn-vue 风格。支持所有原生 input 属性透传（v-model, type, disabled 等）。
 * 额外：type=file 时自动隐藏默认边框内边距冲突。
 */
const props = defineProps<{
  modelValue?: string | number
  class?: any
  type?: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()

const classes = computed(() =>
  cn(
    'flex h-9 w-full rounded-md border border-border bg-surface-elevated px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:cursor-not-allowed disabled:opacity-50',
    props.type === 'file'
      ? 'h-auto py-2 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-text'
      : '',
    props.class
  )
)

function onInput(e: Event) {
  const target = e.target as HTMLInputElement
  emit('update:modelValue', target.value)
}
</script>

<template>
  <input
    :value="modelValue"
    :type="type"
    :class="classes"
    @input="onInput"
    v-bind="$attrs"
  />
</template>
