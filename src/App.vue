<script setup lang="ts">
// T01 占位：脚手架验证页。T02-T04 会替换为真正的全局布局 + 路由。
</script>

<template>
  <main class="min-h-screen flex items-center justify-center p-8">
    <section class="text-center space-y-6 max-w-xl">
      <div class="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium">
        <span class="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
        脚手架初始化成功
      </div>
      <h1 class="text-2xl font-semibold tracking-tight">
        Vue 3 + Vite + TypeScript + Tailwind CSS
      </h1>
      <p class="text-sm leading-relaxed opacity-80">
        若能看到这段文字且页面背景、字体颜色随深浅色主题切换，说明 T01 基础配置全部生效。
        后续 Todo（T02→）会逐步替换为真正的设计系统、全局布局、路由与页面。
      </p>
      <dl class="grid grid-cols-2 gap-3 text-left text-xs">
        <div class="rounded-lg border p-3">
          <dt class="opacity-60">Vue</dt>
          <dd class="font-mono mt-1">3.5.x</dd>
        </div>
        <div class="rounded-lg border p-3">
          <dt class="opacity-60">Vite</dt>
          <dd class="font-mono mt-1">5.4.x</dd>
        </div>
        <div class="rounded-lg border p-3">
          <dt class="opacity-60">TypeScript</dt>
          <dd class="font-mono mt-1">5.6.x</dd>
        </div>
        <div class="rounded-lg border p-3">
          <dt class="opacity-60">Tailwind</dt>
          <dd class="font-mono mt-1">3.4.x</dd>
        </div>
      </dl>
    </section>
  </main>
</template>
