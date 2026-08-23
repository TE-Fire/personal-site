<script setup lang="ts">
/**
 * NotFoundPage · 404 兜底页。
 * 提供：大号 404 文案 + 说明 + 返回首页 CTA + 返回上一页。
 */
import { Button } from '@/components/ui'
import { useRouter } from 'vue-router'
import { Home, ArrowLeft } from 'lucide-vue-next'

const router = useRouter()
function goBack() {
  if (window.history.length > 1) router.back()
  else router.replace('/')
}
</script>

<template>
  <section class="min-h-[60vh] flex flex-col items-center justify-center text-center py-16 gap-6">
    <p class="m-0 font-mono text-7xl md:text-9xl font-bold tracking-tighter leading-none bg-gradient-to-br from-brand via-accent to-text bg-clip-text text-transparent">
      404
    </p>
    <div class="space-y-2 max-w-md">
      <h1 class="m-0 text-xl md:text-2xl font-semibold tracking-tight">
        抱歉，这里没有你要找的页面
      </h1>
      <p class="m-0 text-sm md:text-base text-text-muted leading-relaxed">
        链接可能失效了，或者被移动到了别的路径。如果你是从外部链接点进来的，欢迎告诉 TA 修复一下～
      </p>
    </div>
    <div class="flex flex-wrap items-center justify-center gap-3">
      <Button as="router-link" :to="'/'">
        <Home class="size-4" />
        <span>返回首页</span>
      </Button>
      <Button variant="outline" @click="goBack">
        <ArrowLeft class="size-4" />
        <span>回到上一页</span>
      </Button>
    </div>
  </section>
</template>
