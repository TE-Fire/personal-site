<script setup lang="ts">
/**
 * Card 根组件（默认导出）。
 * 配套具名导出 CardHeader / CardTitle / CardDescription / CardContent / CardFooter
 * 在下方第二个 <script> 块中定义。
 * 注意：cn 函数在下方 <script> 中统一 import（Vue SFC 合并 script 作用域）。
 */

const props = defineProps<{ class?: any }>()
</script>

<template>
  <div
    :class="cn('rounded-lg border border-border bg-surface-elevated text-text shadow-sm', props.class)"
    v-bind="$attrs"
  >
    <slot />
  </div>
</template>

<script lang="ts">
/**
 * 配套的子组件，采用与 shadcn-vue 完全一致的具名导出模式。
 * 消费端写法：
 *   import Card, { CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/Card.vue'
 */
import { defineComponent, h, type PropType } from 'vue'
import { cn } from '@/lib/utils'

export const CardHeader = defineComponent({
  name: 'CardHeader',
  props: {
    class: { type: [String, Object, Array] as PropType<any>, default: '' },
    as: { type: [String, Object] as PropType<any>, default: 'div' }
  },
  setup(props, { slots, attrs }) {
    return () =>
      h(props.as, { ...attrs, class: cn('flex flex-col space-y-1.5 p-6', props.class) }, slots.default?.())
  }
})

export const CardTitle = defineComponent({
  name: 'CardTitle',
  props: {
    class: { type: [String, Object, Array] as PropType<any>, default: '' },
    as: { type: [String, Object] as PropType<any>, default: 'h3' }
  },
  setup(props, { slots, attrs }) {
    return () =>
      h(
        props.as,
        { ...attrs, class: cn('font-semibold leading-none tracking-tight text-[15px]', props.class) },
        slots.default?.()
      )
  }
})

export const CardDescription = defineComponent({
  name: 'CardDescription',
  props: {
    class: { type: [String, Object, Array] as PropType<any>, default: '' },
    as: { type: [String, Object] as PropType<any>, default: 'p' }
  },
  setup(props, { slots, attrs }) {
    return () =>
      h(
        props.as,
        { ...attrs, class: cn('text-sm text-text-muted', props.class) },
        slots.default?.()
      )
  }
})

export const CardContent = defineComponent({
  name: 'CardContent',
  props: {
    class: { type: [String, Object, Array] as PropType<any>, default: '' },
    as: { type: [String, Object] as PropType<any>, default: 'div' }
  },
  setup(props, { slots, attrs }) {
    return () =>
      h(props.as, { ...attrs, class: cn('p-6 pt-0', props.class) }, slots.default?.())
  }
})

export const CardFooter = defineComponent({
  name: 'CardFooter',
  props: {
    class: { type: [String, Object, Array] as PropType<any>, default: '' },
    as: { type: [String, Object] as PropType<any>, default: 'div' }
  },
  setup(props, { slots, attrs }) {
    return () =>
      h(props.as, { ...attrs, class: cn('flex items-center p-6 pt-0', props.class) }, slots.default?.())
  }
})
</script>
