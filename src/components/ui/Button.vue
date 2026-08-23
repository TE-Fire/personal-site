<script setup lang="ts">
/**
 * Button · 与 shadcn-vue vega 风格 API 对齐。
 * 变体 variant：default | destructive | outline | secondary | ghost | link
 * 尺寸 size：   default | sm | lg | icon
 * 支持透传任何原生 button / router-link / a 的属性（通过 $attrs + component="a"）。
 */
import { computed } from 'vue'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'bg-brand text-brand-on shadow-sm hover:bg-brand/90',
        destructive:
          'bg-danger text-white shadow-sm hover:bg-danger/90 focus-visible:ring-danger',
        outline:
          'border border-border bg-surface-elevated shadow-sm hover:bg-surface-muted hover:text-text',
        secondary:
          'bg-surface-muted text-text shadow-sm hover:bg-surface-muted/80',
        ghost:
          'hover:bg-surface-muted hover:text-text',
        link: 'text-brand underline-offset-4 hover:underline'
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm: 'h-8 rounded-md px-3 text-xs',
        lg: 'h-10 rounded-md px-8',
        icon: 'h-9 w-9'
      }
    },
    defaultVariants: {
      variant: 'default',
      size: 'default'
    }
  }
)

type ButtonVariants = VariantProps<typeof buttonVariants>

interface Props {
  variant?: ButtonVariants['variant']
  size?: ButtonVariants['size']
  as?: 'button' | 'a' | 'div' | 'router-link' | any
  class?: any
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'default',
  size: 'default',
  as: 'button'
})

const classes = computed(() => cn(buttonVariants({ variant: props.variant, size: props.size }), props.class))
</script>

<template>
  <component :is="as" v-bind="$attrs" :class="classes">
    <slot />
  </component>
</template>
