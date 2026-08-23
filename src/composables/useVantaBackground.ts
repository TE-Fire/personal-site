/**
 * useVantaBackground.ts · Vanta.js NET 3D 背景 + 降级 2D fallback。
 *
 * 使用：
 *   const heroBgRef = ref<HTMLElement | null>(null)
 *   const { mode, error } = useVantaBackground(heroBgRef)
 *   // 模式：'vanta'（真实 WebGL） | 'fallback'（2D 渐变+点阵） | 'disabled'（SSR 等）
 *
 * 参数：
 *   target        — 挂载 Vanta 的 DOM 元素 ref
 *   opts.fixed    — true 时使用全屏固定样式（AppLayout 持久层），
 *                   false 时使用内嵌 absolute 样式（首页 Hero 区）
 *
 * 降级策略（命中任一立即走 fallback）：
 *   · prefers-reduced-motion
 *   · hardwareConcurrency <= 2 / deviceMemory <= 2
 *   · 视口宽度 < 768（移动端/平板竖屏）
 *   · WebGL1/2 context 创建失败
 *   · Vanta init 抛异常（catch 后 fallback）
 */
import { onBeforeUnmount, onMounted, ref, shallowRef, unref, watch, type MaybeRef } from 'vue'
import { useTheme } from './useTheme'

export type VantaBackgroundMode = 'vanta' | 'fallback' | 'disabled'

type VantaLike = {
  setOptions: (opts: Record<string, unknown>) => void
  destroy: () => void
}

/**
 * 十六进制 brand / accent / 背景常量 —— 与设计系统 tokens 对齐：
 * brand=紫罗兰 #8B5CF6，accent=品红 #EC4899，dark bg=#0B0716，light bg=#FBFAFF
 */
const COLOR_HEX = {
  brand: 0x8b5cf6,
  accent: 0xec4899,
  bgDark: 0x0b0716,
  bgLight: 0xfbfaff,
  highlight: 0xa78bfa
}

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

function isMobileViewport(): boolean {
  try {
    return window.matchMedia('(max-width: 767px)').matches
  } catch {
    return false
  }
}

function isLowPower(): boolean {
  if (typeof navigator === 'undefined') return true
  const nav = navigator as Navigator & { deviceMemory?: number; hardwareConcurrency?: number }
  if (typeof nav.hardwareConcurrency === 'number' && nav.hardwareConcurrency <= 2) return true
  if (typeof nav.deviceMemory === 'number' && nav.deviceMemory <= 2) return true
  return false
}

function hasWebGLSupport(): boolean {
  try {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('webgl2') ?? canvas.getContext('webgl')
    return !!ctx
  } catch {
    return false
  }
}

function shouldUseFallback(): boolean {
  if (typeof window === 'undefined') return true
  if (prefersReducedMotion()) return true
  if (isMobileViewport()) return true
  if (isLowPower()) return true
  if (!hasWebGLSupport()) return true
  return false
}

/** 给 target 容器切换 fallback 视觉样式 class（2D 渐变+点阵） */
function applyFallback(target: HTMLElement, theme: 'light' | 'dark', fixed = false) {
  const cls = fixed ? 'hero-bg-fallback-fixed' : 'hero-bg-fallback'
  const removeCls = fixed ? 'hero-bg-fallback' : 'hero-bg-fallback-fixed'
  target.classList.add(cls)
  target.classList.remove(removeCls, 'hero-bg-vanta', 'hero-bg-vanta-fixed')
  target.classList.toggle('theme-dark', theme === 'dark')
  target.classList.toggle('theme-light', theme === 'light')
}

/** 给 target 容器切换 vanta 样式 class（移除 fallback 的渐变+点阵） */
function applyVantaClass(target: HTMLElement, theme: 'light' | 'dark', fixed = false) {
  const cls = fixed ? 'hero-bg-vanta-fixed' : 'hero-bg-vanta'
  const removeCls = fixed ? 'hero-bg-vanta' : 'hero-bg-vanta-fixed'
  target.classList.remove('hero-bg-fallback', 'hero-bg-fallback-fixed', removeCls)
  target.classList.add(cls)
  target.classList.toggle('theme-dark', theme === 'dark')
  target.classList.toggle('theme-light', theme === 'light')
}

export function useVantaBackground(
  target: MaybeRef<HTMLElement | null>,
  opts: { fixed?: boolean } = {}
) {
  const isFixed = opts.fixed ?? false
  const mode = ref<VantaBackgroundMode>('disabled')
  const error = ref<string | null>(null)
  const vantaEffect = shallowRef<VantaLike | null>(null)
  const { resolved } = useTheme()

  /* ---------- Vanta NET 选项（按当前主题区分背景色）---------- */

  function buildOptions(theme: 'light' | 'dark') {
    return {
      el: null as HTMLElement | null, // 实际调用时赋值
      THREE: null as unknown,
      mouseControls: false,
      touchControls: false,
      gyroControls: false,
      minHeight: 200,
      minWidth: 200,
      scale: 1.0,
      scaleMobile: 1.0,
      color: COLOR_HEX.brand,
      backgroundColor: theme === 'dark' ? COLOR_HEX.bgDark : COLOR_HEX.bgLight,
      points: 10,
      maxDistance: 22,
      spacing: 18
    }
  }

  /* ---------- 初始化 ---------- */

  async function mount() {
    const el = unref(target)
    if (!el) return
    error.value = null

    const theme = resolved.value ?? 'dark'

    // 命中降级：直接 2D fallback
    if (shouldUseFallback()) {
      applyFallback(el, theme, isFixed)
      mode.value = 'fallback'
      return
    }

    // 尝试动态 import Vanta + THREE
    try {
      const threeMod = await import('three')
      const vantaMod = await import('vanta/dist/vanta.net.min.js')
      // Vanta 的 UMD 包通常挂 default；有的版本挂命名导出兜底
      const VantaFactory: (opts: Record<string, unknown>) => VantaLike =
        (vantaMod as any)?.default ?? (vantaMod as any)?.NET ?? (vantaMod as any)
      if (typeof VantaFactory !== 'function') {
        throw new Error('vanta.net.min.js 未导出可调用工厂函数')
      }
      const options = buildOptions(theme)
      options.el = el
      options.THREE = (threeMod as any).default ?? threeMod

      const effect = VantaFactory(options as Record<string, unknown>)
      if (!effect || typeof effect.destroy !== 'function') {
        throw new Error('Vanta returned invalid effect (no destroy)')
      }
      vantaEffect.value = effect
      applyVantaClass(el, theme, isFixed)
      mode.value = 'vanta'
    } catch (err) {
      // 任何异常：清理 + 降级
      try {
        destroyEffect()
      } catch {
        // ignore
      }
      error.value = err instanceof Error ? err.message : String(err)
      applyFallback(el, theme, isFixed)
      mode.value = 'fallback'
    }
  }

  function destroyEffect() {
    if (vantaEffect.value) {
      try {
        vantaEffect.value.destroy()
      } catch {
        // Vanta destroy 有时在已手动移走 canvas 时会抛错，忽略
      }
      vantaEffect.value = null
    }
    const el = unref(target)
    if (el) {
      el.classList.remove('hero-bg-vanta', 'hero-bg-vanta-fixed', 'hero-bg-fallback', 'hero-bg-fallback-fixed')
    }
  }

  /* ---------- 主题切换 → 背景色同步（只在 vanta 模式下）---------- */

  watch(
    resolved,
    (next) => {
      if (!next) return
      const el = unref(target)
      if (!el) return
      if (mode.value === 'fallback') {
        // fallback 由 CSS 变量控制，只需切换 class theme-dark/light
        el.classList.toggle('theme-dark', next === 'dark')
        el.classList.toggle('theme-light', next === 'light')
        if (isFixed) {
          el.classList.toggle('hero-bg-fallback-fixed', true)
          el.classList.remove('hero-bg-fallback')
        } else {
          el.classList.toggle('hero-bg-fallback', true)
          el.classList.remove('hero-bg-fallback-fixed')
        }
        return
      }
      if (mode.value === 'vanta' && vantaEffect.value) {
        vantaEffect.value.setOptions({
          backgroundColor: next === 'dark' ? COLOR_HEX.bgDark : COLOR_HEX.bgLight
        })
      }
    },
    { flush: 'post' }
  )

  /* ---------- 生命周期 ---------- */

  onMounted(() => {
    void mount()
  })

  onBeforeUnmount(() => {
    destroyEffect()
    mode.value = 'disabled'
  })

  // 若外部 ref 晚于 mounted 赋值（少见），watch 一下再补 mount
  watch(
    () => unref(target),
    (nextEl) => {
      if (nextEl && mode.value === 'disabled') {
        void mount()
      }
    },
    { flush: 'post' }
  )

  return {
    mode,
    error,
    /** 手动销毁（极少用，onBeforeUnmount 已经处理） */
    destroyEffect,
    /** 手动重建：destroy 后走 mount（如强制从 fallback 切到 vanta 测试） */
    remount: () => {
      destroyEffect()
      void mount()
    }
  }
}
