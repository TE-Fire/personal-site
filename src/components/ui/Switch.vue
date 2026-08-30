<script setup lang="ts">
/**
 * Switch · shadcn-vue 风格（基于 Radix-Vue Switch）
 *
 * 用法：
 *   <Switch v-model:checked="value" />
 *   <Switch v-model:checked="value" size="sm" />
 *   <Switch v-model:checked="value" variant="success" />
 *
 * 比自己手写 role="switch" 的优势：
 *   · 完整无障碍（Radix 处理 role/aria-checked/键盘 Space/Enter）
 *   · 原生聚焦环 & disabled 状态
 *   · 深色模式自动反相
 *   · size + variant 变体（跟项目 Button/Badge 体系对齐）
 */
import { computed } from 'vue'
import { SwitchRoot, SwitchThumb } from 'radix-vue'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const switchVariants = cva(
  'peer inline-flex shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:cursor-not-allowed disabled:opacity-50',
  {
    variants: {
      size: {
        sm: 'h-5 w-9',
        default: 'h-6 w-11',
        lg: 'h-7 w-12',
      },
      variant: {
        default: 'bg-surface-muted data-[state=checked]:bg-brand',
        success: 'bg-surface-muted data-[state=checked]:bg-emerald-500',
        danger: 'bg-surface-muted data-[state=checked]:bg-danger',
      },
    },
    defaultVariants: {
      size: 'default',
      variant: 'default',
    },
  },
)

const thumbVariants = cva(
  'pointer-events-none rounded-full bg-white shadow-md ring-0 transition-transform data-[state=checked]:translate-x-full',
  {
    variants: {
      size: {
        sm: 'size-4',
        default: 'size-5',
        lg: 'size-6',
      },
    },
    defaultVariants: { size: 'default' },
  },
)

type SwitchVariants = VariantProps<typeof switchVariants>

interface Props {
  checked?: boolean
  size?: SwitchVariants['size']
  variant?: SwitchVariants['variant']
  disabled?: boolean
  class?: any
  /** 自定义 thumb 动画距离：default 自动按 size 计算 */
  thumbTranslateX?: string
}

const props = withDefaults(defineProps<Props>(), {
  checked: false,
  size: 'default',
  variant: 'default',
  disabled: false,
})

const emit = defineEmits<{
  (e: 'update:checked', v: boolean): void
}>()

const rootClasses = computed(() =>
  cn(switchVariants({ size: props.size, variant: props.variant }), props.class),
)

const thumbClasses = computed(() => thumbVariants({ size: props.size }))

function onCheckedChange(v: boolean) {
  emit('update:checked', v)
}
</script>

<template>
  <SwitchRoot
    :default-checked="checked"
    :disabled="disabled"
    :class="rootClasses"
    @update:checked="onCheckedChange"
  >
    <SwitchThumb :class="thumbClasses" />
  </SwitchRoot>
</template>
