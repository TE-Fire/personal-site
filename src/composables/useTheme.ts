import { ref, watch } from 'vue'
// T03 才安装 @vueuse/core；此处提前实现不依赖它的降级版 useTheme，
// 保证 T02 独立通过 typecheck / build。T03 后可按需替换为 useStorage + usePreferredDark 简化代码。

export type ThemeMode = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'

const STORAGE_KEY = 'site.theme-mode' as const
const mode = ref<ThemeMode>('system')
const resolved = ref<ResolvedTheme>('light')

// --- 降级版 localStorage 封装（当 @vueuse/core 不可用时） ---
function storageGet<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (raw === null) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}
function storageSet<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* ignore quota / SSR */
  }
}

function applyResolvedToHtml(next: ResolvedTheme): void {
  const root = document.documentElement
  if (next === 'dark') {
    root.classList.add('dark')
    root.setAttribute('data-theme', 'dark')
  } else {
    root.classList.remove('dark')
    root.setAttribute('data-theme', 'light')
  }
  // 同时暴露给 CSS tokens.css 用于「未手动选择时跟随系统」分支
  if (mode.value === 'system') {
    root.removeAttribute('data-theme-mode')
  } else {
    root.setAttribute('data-theme-mode', mode.value)
  }
}

function computeResolved(): ResolvedTheme {
  if (mode.value !== 'system') return mode.value
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

/**
 * 响应式主题管理。
 * - 手动选择模式存储在 localStorage
 * - 跟随系统时使用 matchMedia 实时监听系统主题变化
 * - 切换后立即应用到 <html class="dark"> 并写入 data-theme 属性
 */
export function useTheme() {
  let media: MediaQueryList | null = null
  const onMediaChange = () => {
    if (mode.value === 'system') {
      resolved.value = computeResolved()
      applyResolvedToHtml(resolved.value)
    }
  }

  const setMode = (next: ThemeMode) => {
    mode.value = next
    storageSet(STORAGE_KEY, next)
    resolved.value = computeResolved()
    applyResolvedToHtml(resolved.value)
  }

  const toggle = () => {
    // 用户直接点切换按钮时，在 light/dark 之间切（不再走 system）
    setMode(resolved.value === 'dark' ? 'light' : 'dark')
  }

  const init = () => {
    // 1) 读取用户之前的选择；没有则为 system
    const saved = storageGet<ThemeMode>(STORAGE_KEY, 'system')
    mode.value = ['light', 'dark', 'system'].includes(saved) ? saved : 'system'

    // 2) 计算并立即应用（避免页面首屏闪白/闪黑 —— 若后续做 SSR，此逻辑需前推到 index.html inline script）
    resolved.value = computeResolved()
    applyResolvedToHtml(resolved.value)

    // 3) 监听系统变化（仅在浏览器环境）
    try {
      media = window.matchMedia('(prefers-color-scheme: dark)')
      // 兼容性：Safari < 14 不支持 addEventListener
      if (typeof media.addEventListener === 'function') {
        media.addEventListener('change', onMediaChange)
      } else if ('addListener' in media) {
        // Safari < 14 旧版 API（直接类型断言规避 TS 报告不存在的属性）
        ;(media as unknown as { addListener: (l: () => void) => void }).addListener(onMediaChange)
      }
    } catch {
      /* ignore */
    }
  }

  // 自动挂载（用于单例模式）
  if (typeof document !== 'undefined' && !document.documentElement.dataset.themeInited) {
    document.documentElement.dataset.themeInited = '1'
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init, { once: true })
    } else {
      init()
    }
  }

  // 同步 watch 模式值变化（例如组件里直接改 mode.value）
  watch(mode, () => {
    resolved.value = computeResolved()
    applyResolvedToHtml(resolved.value)
  })

  return {
    mode,
    resolved,
    setMode,
    toggle
  }
}
