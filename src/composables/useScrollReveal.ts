/**
 * useScrollReveal.ts · 基于 GSAP + ScrollTrigger 的滚动进入淡入动画。
 *
 * 使用：
 *   const rootRef = ref<HTMLElement | null>(null)
 *   useScrollReveal(rootRef)
 *   // 在页面里给 section 或卡片加 `data-reveal` 或 `data-reveal="0.3"`（延迟）
 *
 * 规则：
 *   · prefers-reduced-motion 命中：直接 return，完全无动画
 *   · 每个带 data-reveal 的元素：从 opacity: 0 + y: 24px + blur(4px) 过渡到正常，
 *     时长 0.55s，power2.out，scrollStart='top 88%'（元素顶部距离视口 88% 位置触发）
 *   · data-reveal 属性值若可解析为数字，则作为该元素的延迟（秒），用于同一 section
 *     内多个元素错落进入（如 `data-reveal="0.12"`）
 *   · 动画结束后 `clearProps: 'opacity,transform,filter'` 移除内联样式，避免
 *     后续影响悬停 / 响应式的类样式覆盖
 */
import { nextTick, onBeforeUnmount, onMounted, unref, type MaybeRef } from 'vue'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

let registered = false
function ensureRegistered() {
  if (registered) return
  gsap.registerPlugin(ScrollTrigger)
  registered = true
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

export function useScrollReveal(root: MaybeRef<HTMLElement | null>) {
  const createdTriggers: ScrollTrigger[] = []

  function apply() {
    const el = unref(root)
    if (!el) return
    ensureRegistered()

    if (prefersReducedMotion()) return

    const nodes = Array.from(el.querySelectorAll<HTMLElement>('[data-reveal]'))
    if (!nodes.length) return

    nodes.forEach((node) => {
      const raw = node.getAttribute('data-reveal') ?? '0'
      const delay = Number.isFinite(Number(raw)) ? Math.max(0, Number(raw)) : 0

      const tween = gsap.from(node, {
        opacity: 0,
        y: 24,
        filter: 'blur(4px)',
        duration: 0.55,
        ease: 'power2.out',
        delay,
        clearProps: 'opacity,transform,filter',
        scrollTrigger: {
          trigger: node,
          start: 'top 88%',
          toggleActions: 'play none none reverse',
          // 路由切走时不会因为 resize 再触发
          fastScrollEnd: true
        }
      })
      // 收集 ScrollTrigger（每个 tween 可能 0-1 个）
      const associated = ScrollTrigger.getById((tween as any)._scrollTriggerId)
      // getById 取不到（可能 GSAP 没给这个 tween 赋 id），退而用最近一次创建的
      if (associated) createdTriggers.push(associated)
    })
  }

  onMounted(() => {
    // 等下一 tick，确保 Vue 子组件（slot/v-if）的 [data-reveal] 元素已挂载
    void nextTick().then(() => apply())
  })

  onBeforeUnmount(() => {
    // 精确 kill 我们创建的；fallback 再遍历 ScrollTrigger.getAll() 清理 root 下的
    createdTriggers.splice(0).forEach((st) => {
      try {
        st.kill(true)
      } catch {
        // ignore
      }
    })
    const el = unref(root)
    try {
      ScrollTrigger.getAll().forEach((st) => {
        const trigger = st.trigger as unknown as Node | null
        if (trigger && el && el.contains(trigger)) {
          st.kill(true)
        }
      })
    } catch {
      // ignore
    }
  })

  /** 手动触发重新扫描并 apply（如果后续 root 内追加了 data-reveal） */
  function refresh() {
    apply()
    // 让 ScrollTrigger 刷新位置缓存（DOM 高度变化后）
    try {
      ScrollTrigger.refresh()
    } catch {
      // ignore
    }
  }

  return { refresh }
}
