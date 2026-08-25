/**
 * useIdleTimer.ts · 闲置计时器 composable
 *
 * 监听全局 pointer / wheel / key / touch / scroll 等用户活动事件，
 * 连续 timeout ms 没有活动 → isIdle 变为 true；任何活动 → 重置为 false。
 *
 * 额外支持：
 *   - isHoveringRef / isFocusedRef：widget 正被 hover / 正有焦点（用户可能在操作按钮或写字）
 *     → 即使到了 timeout，也延后收起，等退出交互区再开始新的计时
 *   - setPaused(true/false)：外层临时暂停（比如展开切换动画进行中）不触发 idle
 *   - manualTouch()：外部主动触发一次"用户活动"（比如 hover enter 不希望立刻收起时可显式调用）
 */
import { onBeforeUnmount, onMounted, ref, type Ref } from 'vue'

export interface UseIdleTimerOptions {
  /** 闲置判定时间（ms），默认 6000 */
  timeout?: number
  /** 事件绑定的 target，默认 window */
  target?: Window | HTMLElement
  /** 在这些事件上重置计时 */
  events?: string[]
  /** 外部可传入的「正交互中」refs（true 时禁止进入 idle，退出后重算） */
  interactionGuards?: Array<Ref<boolean> | { value: boolean }>
  /** 进入 idle 时回调 */
  onIdle?: () => void
  /** 从 idle 恢复活动时回调 */
  onActive?: () => void
}

export function useIdleTimer(opts: UseIdleTimerOptions = {}) {
  const {
    timeout = 6000,
    target = typeof window !== 'undefined' ? window : undefined,
    events = ['pointerdown', 'pointermove', 'wheel', 'keydown', 'touchstart', 'scroll'],
    interactionGuards = [],
    onIdle,
    onActive
  } = opts

  const isIdle = ref(false)
  const isPaused = ref(false)
  let timerId: ReturnType<typeof setTimeout> | null = null
  let delayedDeferredUntilIdle = false

  function clearTimer() {
    if (timerId) {
      clearTimeout(timerId)
      timerId = null
    }
  }

  function anyGuardActive(): boolean {
    return interactionGuards.some((g) => g.value)
  }

  function fireIdleIfReady() {
    if (isPaused.value) return
    if (anyGuardActive()) {
      // 正交互中：不立刻 idle，等 guard 解除后再启动一次短延时
      delayedDeferredUntilIdle = true
      return
    }
    clearTimer()
    if (!isIdle.value) {
      isIdle.value = true
      onIdle?.()
    }
  }

  function startTimer() {
    clearTimer()
    if (isPaused.value) return
    timerId = setTimeout(fireIdleIfReady, timeout)
  }

  function touchActivity() {
    delayedDeferredUntilIdle = false
    if (isIdle.value) {
      isIdle.value = false
      onActive?.()
    }
    startTimer()
  }

  /* ---------- 暂停 / 恢复 ---------- */
  function setPaused(v: boolean) {
    isPaused.value = v
    if (v) {
      clearTimer()
    } else {
      // 恢复时，只要现在不是 idle，就重新开始计时
      if (isIdle.value) {
        isIdle.value = false
        onActive?.()
      }
      startTimer()
    }
  }

  /* ---------- 监听 guards：解除时启动一次新计时 ---------- */
  // 用原生 setInterval 轮询 guards 变化（因为 guards 可能是普通 reactive ref）
  let prevGuardsActive = interactionGuards.some((g) => g.value)
  let pollId: ReturnType<typeof setInterval> | null = setInterval(() => {
    const active = anyGuardActive()
    if (prevGuardsActive && !active) {
      // 刚从"交互中"退出 → 如果有 deferred，则启动 idle 计时
      if (delayedDeferredUntilIdle) {
        delayedDeferredUntilIdle = false
        touchActivity()
        // touchActivity 会把 idle=false，但我们只是"等待进入 idle"的条件解除了；
        // 所以这里要的是「重新开始计时」，而 touchActivity 恰好就是做"有活动→启动一次计时"的事
      }
    }
    prevGuardsActive = active
  }, 120)

  const onEvent = (_ev: Event) => {
    // 窗口失焦/后台的 blur 事件这里也会进 pointermove（pointer=1? 实际并没有），无所谓：touchActivity 是幂等的
    touchActivity()
  }

  onMounted(() => {
    if (!target) return
    events.forEach((e) => target.addEventListener(e as any, onEvent as any, { passive: true, capture: true }))
    startTimer()
  })

  onBeforeUnmount(() => {
    clearTimer()
    if (pollId) {
      clearInterval(pollId)
      pollId = null
    }
    if (!target) return
    events.forEach((e) => target.removeEventListener(e as any, onEvent as any, { capture: true } as any))
  })

  return {
    isIdle,
    isPaused,
    /** 外部触发一次"用户活动"（重置计时、结束 idle 态） */
    touchActivity,
    setPaused
  }
}
