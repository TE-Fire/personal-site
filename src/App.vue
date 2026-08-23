<script setup lang="ts">
import { useTheme } from '@/composables/useTheme'

const { mode, resolved, toggle, setMode } = useTheme()
</script>

<template>
  <main class="min-h-screen flex items-center justify-center px-24 py-24">
    <section class="w-full max-w-content space-y-12">
      <!-- 顶部：状态 + 主题切换（T02 验收点） -->
      <header class="flex flex-wrap items-center justify-between gap-16">
        <div class="inline-flex items-center gap-8 rounded-full border border-border px-12 py-4 text-caption">
          <span class="h-8 w-8 rounded-full bg-success animate-pulse"></span>
          <span>设计系统已落地（紫色风 + 双主题 + Inter/JetBrains Mono）</span>
        </div>
        <div class="flex items-center gap-8">
          <div class="flex items-center gap-4 rounded-lg border border-border p-2 text-sm">
            <button
              class="rounded-md px-8 py-4 transition"
              :class="mode === 'light' ? 'bg-brand text-brand-on' : 'text-text-muted hover:bg-surface-muted'"
              @click="setMode('light')"
            >浅色</button>
            <button
              class="rounded-md px-8 py-4 transition"
              :class="mode === 'system' ? 'bg-brand text-brand-on' : 'text-text-muted hover:bg-surface-muted'"
              @click="setMode('system')"
            >跟随</button>
            <button
              class="rounded-md px-8 py-4 transition"
              :class="mode === 'dark' ? 'bg-brand text-brand-on' : 'text-text-muted hover:bg-surface-muted'"
              @click="setMode('dark')"
            >深色</button>
          </div>
          <button class="btn btn-outline" @click="toggle">
            ⇆ 切换（当前 {{ resolved }}）
          </button>
        </div>
      </header>

      <!-- Hero 标题 + 副标题（验证排版层级 clamp） -->
      <div class="space-y-8">
        <h1 class="hero-title text-text">
          个人网站 · 设计系统
          <span class="text-brand">预览页</span>
        </h1>
        <p class="hero-subtitle max-w-content-narrow">
          此页面仅用于 T02 验收：颜色 token、字体层级、深浅色切换、卡片/chip 组件样式。
          切换上方主题按钮，观察颜色/对比度/玻璃拟态面板是否即时响应，
          切换后刷新页面仍保持选择（localStorage），首次访问跟随系统。
        </p>
      </div>

      <!-- 颜色 token 色板展示 -->
      <div class="card p-16 space-y-12">
        <h2 class="text-title font-medium">色板（14 档品牌色 + 语义色）</h2>
        <div class="grid grid-cols-9 gap-4">
          <div
            v-for="lvl in ([50,100,200,300,400,500,'DEFAULT',700,800,900] as const)"
            :key="String(lvl)"
            class="space-y-2"
          >
            <div
              class="h-32 rounded border border-border"
              :style="{ background: lvl === 'DEFAULT' ? 'var(--brand)' : `var(--brand-${lvl})` }"
            ></div>
            <div class="flex items-baseline justify-between">
              <span class="text-code font-medium">
                {{ lvl === 'DEFAULT' ? '600(主)' : lvl }}
              </span>
            </div>
          </div>
        </div>
        <div class="grid grid-cols-4 gap-8 pt-8">
          <div class="flex items-center gap-8">
            <span class="h-24 w-24 rounded bg-accent"></span>
            <span class="text-code">accent</span>
          </div>
          <div class="flex items-center gap-8">
            <span class="h-24 w-24 rounded bg-success"></span>
            <span class="text-code">success</span>
          </div>
          <div class="flex items-center gap-8">
            <span class="h-24 w-24 rounded bg-warning"></span>
            <span class="text-code">warning</span>
          </div>
          <div class="flex items-center gap-8">
            <span class="h-24 w-24 rounded bg-danger"></span>
            <span class="text-code">danger</span>
          </div>
        </div>
      </div>

      <!-- 三卡片：字体展示 + 代码样式 + CTA 按钮 -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-12">
        <!-- 字体层级卡 -->
        <div class="card p-16 space-y-10">
          <h3 class="text-title font-medium">字体层级</h3>
          <p class="caption">.hero-title · 24~40px clamp</p>
          <p class="hero-title">Aa 你好</p>
          <p class="caption">.text-title · 16px</p>
          <p class="text-title font-medium">敏捷的棕色狐狸</p>
          <p class="caption">.text-body · 14px</p>
          <p class="text-body">The quick brown fox jumps over the lazy dog. 1234567890</p>
          <p class="caption">.text-code · 13px JetBrains Mono</p>
          <p class="text-code tabular">const PI = 3.1415926535;</p>
          <p class="caption">.caption · 12px</p>
          <p class="caption">辅助说明 / 标签 / 图例文本</p>
        </div>

        <!-- 玻璃拟态终端卡（Hero 风格预览） -->
        <div class="glass-panel p-0 overflow-hidden">
          <div class="flex items-center gap-6 px-12 py-8 border-b border-border bg-surface-muted/60">
            <span class="h-10 w-10 rounded-full bg-danger/80"></span>
            <span class="h-10 w-10 rounded-full bg-warning/80"></span>
            <span class="h-10 w-10 rounded-full bg-success/80"></span>
            <span class="ml-8 text-caption tabular">~ / zsh — vite preview</span>
          </div>
          <pre class="p-12 text-code leading-relaxed overflow-x-auto no-scrollbar text-text"><code><span class="text-accent-text">$</span> whoami
<span class="text-brand-700 dark:text-brand-300">全栈开发者 · 技术爱好者</span>

<span class="text-accent-text">$</span> cat stack.txt
Vue 3 · Vite · TS · Tailwind · Java · Spring

<span class="text-accent-text">$</span> ls ./projects
personal-site  distributed-id  note-svc

<span class="text-accent-text">$</span> <span class="inline-block h-[1em] w-[0.5em] align-[-2px] bg-brand animate-pulse"></span></code></pre>
        </div>

        <!-- 交互组件：Chip + 按钮 + focus ring -->
        <div class="card p-16 space-y-16">
          <div class="space-y-8">
            <h3 class="text-title font-medium">Chip 标签</h3>
            <div class="flex flex-wrap gap-6">
              <span class="chip">Vue 3</span>
              <span class="chip">Vite</span>
              <span class="chip">TypeScript</span>
              <span class="chip">Tailwind</span>
              <span class="chip">GSAP</span>
              <span class="chip">Vanta.js</span>
              <span class="chip">shadcn-vue</span>
            </div>
          </div>

          <div class="space-y-8">
            <h3 class="text-title font-medium">按钮</h3>
            <div class="flex flex-wrap gap-8">
              <button class="btn btn-primary">主要操作</button>
              <button class="btn btn-outline">次要描边</button>
              <button class="btn btn-ghost">幽灵按钮</button>
            </div>
          </div>

          <div class="space-y-8">
            <h3 class="text-title font-medium">内联代码</h3>
            <p class="text-body">
              用 <code class="inline-code">@apply</code> 语法写组件层，
              颜色一律走 <code class="inline-code">var(--brand)</code>，
              不用死色值。
            </p>
          </div>
        </div>
      </div>

      <!-- 底部：版本矩阵 -->
      <footer class="pt-8">
        <dl class="grid grid-cols-2 md:grid-cols-5 gap-8 text-caption">
          <div class="card p-10">
            <dt class="text-text-subtle">Vue</dt>
            <dd class="text-code mt-4 tabular">3.5.x</dd>
          </div>
          <div class="card p-10">
            <dt class="text-text-subtle">Vite</dt>
            <dd class="text-code mt-4 tabular">5.4.x</dd>
          </div>
          <div class="card p-10">
            <dt class="text-text-subtle">TypeScript</dt>
            <dd class="text-code mt-4 tabular">5.6.x</dd>
          </div>
          <div class="card p-10">
            <dt class="text-text-subtle">Tailwind</dt>
            <dd class="text-code mt-4 tabular">3.4.x</dd>
          </div>
          <div class="card p-10">
            <dt class="text-text-subtle">主题模式</dt>
            <dd class="text-code mt-4 tabular">{{ mode }} / {{ resolved }}</dd>
          </div>
        </dl>
      </footer>
    </section>
  </main>
</template>
