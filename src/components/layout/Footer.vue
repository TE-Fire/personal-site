<script setup lang="ts">
/**
 * Footer · 全局底部。
 * 结构：
 *   左：版权信息 + 当前年份（动态 new Date()）
 *   中：留白 / （T05 可补底部二级链接列）
 *   右：社交 Icon 占位（6 个常用：GitHub / Email / 掘金 / 微信 占位 / RSS / 返回顶部）
 */
import { computed } from 'vue'
import { ArrowUp, Github, Mail, Rss } from 'lucide-vue-next'

const year = computed(() => new Date().getFullYear())

const socials = [
  {
    name: 'GitHub',
    href: 'https://github.com/TE-Fire',
    Icon: Github
  },
  {
    name: '邮件联系',
    href: 'mailto:hello@example.com',
    Icon: Mail
  },
  {
    name: 'RSS 订阅',
    href: '/feed.xml',
    Icon: Rss
  }
] as const

/** 返回顶部（非锚点，避免 URL 上带 hash） */
function scrollTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' })
}
</script>

<template>
  <footer class="mt-24 border-t border-border/60 bg-surface/70 backdrop-blur-md relative z-10">
    <div class="mx-auto w-full max-w-screen-2xl px-4 md:px-8 py-10 flex flex-col gap-6 md:gap-4 md:flex-row md:items-center md:justify-between">
      <!-- 版权 -->
      <div class="flex flex-col gap-1 text-sm text-text-muted">
        <p class="m-0">
          © {{ year }}
          <span class="text-text font-medium ml-1">Trae</span>
          <span class="mx-1.5 opacity-50">·</span>
          <span>Built with Vue 3 + Vite + Tailwind CSS</span>
        </p>
        <p class="m-0 text-xs opacity-75">
          设计与内容全部原创 · 代码按仓库 License 开源
        </p>
      </div>

      <!-- 社交图标 + 返回顶部 -->
      <div class="flex items-center gap-1">
        <a
          v-for="s in socials"
          :key="s.name"
          :href="s.href"
          :aria-label="s.name"
          target="_blank"
          rel="noopener noreferrer"
          class="inline-flex size-9 items-center justify-center rounded-full text-text-muted hover:text-text hover:bg-surface-muted/60 transition"
        >
          <component :is="s.Icon" class="size-[18px]" />
        </a>
        <span class="mx-2 h-5 w-px bg-border/70" aria-hidden />
        <button
          type="button"
          class="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs text-text-muted hover:text-text hover:bg-surface-muted/60 transition"
          @click="scrollTop"
        >
          <ArrowUp class="size-4" />
          <span>返回顶部</span>
        </button>
      </div>
    </div>
  </footer>
</template>
