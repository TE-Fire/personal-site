<script setup lang="ts">
/**
 * Dialog · 基于 Radix-Vue Dialog 的模态对话框根组件
 *
 * 配合命名导出的子组件使用：
 *   import Dialog, { DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose }
 *     from '@/components/ui/Dialog.vue'
 *
 *   <Dialog v-model:open="open">
 *     <DialogTrigger as-child>
 *       <Button>打开</Button>
 *     </DialogTrigger>
 *     <DialogContent>
 *       <DialogHeader>
 *         <DialogTitle>标题</DialogTitle>
 *         <DialogDescription>说明</DialogDescription>
 *       </DialogHeader>
 *       <div>内容</div>
 *       <DialogFooter>底部操作</DialogFooter>
 *     </DialogContent>
 *   </Dialog>
 */
import { DialogRoot } from 'radix-vue'

const props = defineProps<{
  open?: boolean
  defaultOpen?: boolean
}>()
const emit = defineEmits<{
  (e: 'update:open', v: boolean): void
}>()
</script>

<template>
  <DialogRoot
    :open="props.open"
    :default-open="props.defaultOpen"
    @update:open="emit('update:open', $event)"
  >
    <slot />
  </DialogRoot>
</template>

<script lang="ts">
import { defineComponent, h, computed } from 'vue'
import {
  DialogTrigger,
  DialogPortal,
  DialogOverlay,
  DialogContent as RadixDialogContent,
  DialogTitle as RadixDialogTitle,
  DialogDescription as RadixDialogDescription,
  DialogClose,
} from 'radix-vue'
import { X } from 'lucide-vue-next'
import { cn } from '@/lib/utils'

export { DialogTrigger }

export const DialogContent = defineComponent({
  name: 'DialogContent',
  props: {
    class: { type: null as any, default: undefined },
  },
  setup(props, { slots }) {
    const classes = computed(() =>
      cn(
        'fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2',
        'rounded-2xl border border-border bg-surface p-6 shadow-xl',
        props.class,
      ),
    )
    return () =>
      h(DialogPortal, () =>
        h(DialogOverlay, {
          class:
            'fixed inset-0 z-50 bg-black/40 backdrop-blur-sm',
        }, () =>
          h(RadixDialogContent, { class: classes.value }, () => [
            slots.default?.(),
            h(
              DialogClose,
              {
                class:
                  'absolute right-4 top-4 rounded-sm opacity-70 ring-offset-surface transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 disabled:pointer-events-none',
              },
              () => h(X, { class: 'size-4 text-text-muted' }),
            ),
          ]),
        ),
      )
  },
})

export const DialogHeader = defineComponent({
  name: 'DialogHeader',
  props: { class: { type: null as any, default: undefined } },
  setup(props, { slots }) {
    return () =>
      h(
        'div',
        { class: cn('flex flex-col gap-1.5 text-center sm:text-left', props.class) },
        slots.default?.(),
      )
  },
})

export const DialogFooter = defineComponent({
  name: 'DialogFooter',
  props: { class: { type: null as any, default: undefined } },
  setup(props, { slots }) {
    return () =>
      h(
        'div',
        { class: cn('flex flex-col-reverse sm:flex-row sm:justify-end sm:gap-2 mt-6', props.class) },
        slots.default?.(),
      )
  },
})

export const DialogTitle = defineComponent({
  name: 'DialogTitle',
  props: { class: { type: null as any, default: undefined } },
  setup(props, { slots }) {
    return () =>
      h(
        RadixDialogTitle,
        { class: cn('text-lg font-semibold leading-none tracking-tight text-text', props.class) },
        slots.default?.(),
      )
  },
})

export const DialogDescription = defineComponent({
  name: 'DialogDescription',
  props: { class: { type: null as any, default: undefined } },
  setup(props, { slots }) {
    return () =>
      h(
        RadixDialogDescription,
        { class: cn('text-sm text-text-muted', props.class) },
        slots.default?.(),
      )
  },
})

export { DialogClose }
</script>
