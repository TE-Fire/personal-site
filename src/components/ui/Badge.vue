<script setup lang="ts">
/**
 * Badge · shadcn-vue vega 风格。
 * 变体：default | secondary | destructive | outline
 */
import { computed } from 'vue'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-full border border-border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 focus:ring-offset-surface',
  {
    variants: {
      variant: {
        default:
          'border-transparent bg-brand text-brand-on hover:bg-brand/80',
        secondary:
          'border-transparent bg-surface-muted text-text hover:bg-surface-muted/80',
        destructive:
          'border-transparent bg-danger text-white hover:bg-danger/80 focus:ring-danger',
        outline: 'text-text'
      }
    },
    defaultVariants: {
      variant: 'default'
    }
  }
)

type BadgeVariants = VariantProps<typeof badgeVariants>

interface Props {
  variant?: BadgeVariants['variant']
  class?: any
}

const props = withDefaults(defineProps<Props>(), { variant: 'default' })
const classes = computed(() => cn(badgeVariants({ variant: props.variant }), props.class))
</script>

<template>
  <div :class="classes" v-bind="$attrs">
    <slot />
  </div>
</template>
