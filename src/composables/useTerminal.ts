/**
 * useTerminal.ts · 终端模拟器（纯展示）脚本步进器。
 *
 * 模型：
 *   一条「脚本」 = 若干 Step 序列（prompt + command + output + pause）
 *   输出 = lines[]（已追加到终端的可见行）+ status（typing / done）
 *
 * 用法：
 *   const { lines, status, restart, skipToEnd } = useTerminal(script, { autoStart: true })
 *   // 监听 status == 'done' 时 fade-in 外部 CTA 按钮组
 */
import { computed, onBeforeUnmount, onMounted, ref, unref, watch, type MaybeRef } from 'vue'

/* ---------- 类型 ---------- */

export type TerminalLine = {
  id: number
  type: 'cmd' | 'output' | 'info'
  /** 已显示出来的部分（打字中时 != full） */
  visible: string
  /** 该行完整内容 */
  full: string
  /** 该行是否已完全显示 */
  done: boolean
}

export type TerminalStep =
  /** 显示提示符 + 打字输入一条命令，完成后光标停在 cmd 行尾 */
  | {
      type: 'command'
      text: string
      /** 每个字符之间的打字时长（ms），默认 42 */
      charMs?: number
      /** 命令行打字完成后的停顿（ms），默认 280 */
      pauseMs?: number
    }
  /** 立即追加若干条输出行（无打字），可设置每行的步进速度 */
  | {
      type: 'output'
      lines: string[]
      /** 每条输出行之间的间隔（ms），默认 50；设 0 表示立即全显 */
      lineMs?: number
      /** 输出完成后停顿（ms），默认 200 */
      pauseMs?: number
      /** 若为 true，这些行走 info 类型（低对比色），否则 output 正常色 */
      muted?: boolean
    }
  /** 空行（语义上是一组 output 结束后留白） */
  | { type: 'blank'; count?: number; pauseMs?: number }
  /** 停顿 */
  | { type: 'pause'; ms: number }

/* ---------- 默认参数 ---------- */

const DEFAULTS = {
  commandCharMs: 42,
  commandPauseMs: 280,
  outputLineMs: 50,
  outputPauseMs: 200,
  blankPauseMs: 60
}

/* ---------- 辅助：判断 prefers-reduced-motion ---------- */

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

/* ---------- 主 composable ---------- */

export function useTerminal(
  scriptInput: MaybeRef<TerminalStep[]>,
  options: {
    /** 挂载后是否自动启动，默认 true */
    autoStart?: boolean
  } = {}
) {
  const { autoStart = true } = options

  /** 解包 MaybeRef，允许外部直接传数组或 computed/ref */
  const scriptRef = computed<TerminalStep[]>(() => unref(scriptInput))

  const lines = ref<TerminalLine[]>([])
  const status = ref<'idle' | 'typing' | 'done'>('idle')

  let nextLineId = 1
  /** setTimeout id，用于 unmount / restart / skip 时取消 */
  let pendingTimer: ReturnType<typeof setTimeout> | null = null
  /** 正在驱动动画的异步协程取消开关 */
  let cancelled = false

  const isTyping = computed(() => status.value === 'typing')
  const isDone = computed(() => status.value === 'done')

  /* ---------- 底层追加行 ---------- */

  function appendLine(type: TerminalLine['type'], full = ''): number {
    const id = nextLineId++
    lines.value.push({ id, type, visible: '', full, done: full === '' })
    return id
  }

  function setLineFullByIndex(index: number) {
    const ln = lines.value[index]
    if (ln) {
      ln.visible = ln.full
      ln.done = true
    }
  }

  function clearTimer() {
    if (pendingTimer !== null) {
      clearTimeout(pendingTimer)
      pendingTimer = null
    }
  }

  function wait(ms: number): Promise<void> {
    return new Promise((resolve) => {
      pendingTimer = setTimeout(() => {
        pendingTimer = null
        resolve()
      }, ms)
    })
  }

  /* ---------- 单步：command（逐字输入）---------- */

  async function runCommandStep(step: Extract<TerminalStep, { type: 'command' }>) {
    if (cancelled) return
    const { text, charMs = DEFAULTS.commandCharMs, pauseMs = DEFAULTS.commandPauseMs } = step

    const lineIndex = lines.value.length
    appendLine('cmd', text)
    const line = lines.value[lineIndex]!

    // prefers-reduced-motion 或 skip 模式：瞬时全显
    if (prefersReducedMotion()) {
      line.visible = text
      line.done = true
      if (pauseMs > 0) await wait(pauseMs)
      return
    }

    let i = 0
    while (i < text.length && !cancelled) {
      // 轻微随机化：避免视觉呆板
      const jitter = Math.random() * 0.6 + 0.7 // 0.7 ~ 1.3
      await wait(Math.max(8, Math.round(charMs * jitter)))
      if (cancelled) return
      i++
      line.visible = text.slice(0, i)
    }
    line.done = true
    if (pauseMs > 0 && !cancelled) await wait(pauseMs)
  }

  /* ---------- 单步：output（逐行显示）---------- */

  async function runOutputStep(step: Extract<TerminalStep, { type: 'output' }>) {
    if (cancelled) return
    const { lines: rawLines, lineMs = DEFAULTS.outputLineMs, pauseMs = DEFAULTS.outputPauseMs, muted = false } = step

    const lineType: TerminalLine['type'] = muted ? 'info' : 'output'
    const isReduce = prefersReducedMotion()

    for (let i = 0; i < rawLines.length; i++) {
      if (cancelled) return
      const text = rawLines[i]!
      appendLine(lineType, text)
      setLineFullByIndex(lines.value.length - 1)
      if (!isReduce && lineMs > 0 && i < rawLines.length - 1) await wait(lineMs)
    }
    if (pauseMs > 0 && !cancelled) await wait(pauseMs)
  }

  /* ---------- 单步：blank（空行）---------- */

  async function runBlankStep(step: Extract<TerminalStep, { type: 'blank' }>) {
    if (cancelled) return
    const { count = 1, pauseMs = DEFAULTS.blankPauseMs } = step
    for (let i = 0; i < count; i++) appendLine('output', '')
    if (pauseMs > 0 && !cancelled) await wait(pauseMs)
  }

  /* ---------- 单步分发 ---------- */

  async function runStep(step: TerminalStep) {
    switch (step.type) {
      case 'command':
        await runCommandStep(step)
        break
      case 'output':
        await runOutputStep(step)
        break
      case 'blank':
        await runBlankStep(step)
        break
      case 'pause':
        if (!cancelled) await wait(step.ms)
        break
    }
  }

  /* ---------- 主循环 ---------- */

  async function runLoop() {
    status.value = 'typing'
    cancelled = false
    const currentScript = scriptRef.value
    for (const step of currentScript) {
      if (cancelled) break
      await runStep(step)
    }
    if (!cancelled) status.value = 'done'
  }

  /* ---------- 跳过：直接把所有行一次展开 ---------- */

  function skipToEnd() {
    cancelled = true
    clearTimer()

    const currentScript = scriptRef.value
    const result: TerminalLine[] = []
    let id = 1
    for (const step of currentScript) {
      if (step.type === 'command') {
        result.push({ id: id++, type: 'cmd', visible: step.text, full: step.text, done: true })
      } else if (step.type === 'output') {
        const lineType: TerminalLine['type'] = step.muted ? 'info' : 'output'
        for (const l of step.lines) {
          result.push({ id: id++, type: lineType, visible: l, full: l, done: true })
        }
      } else if (step.type === 'blank') {
        const n = step.count ?? 1
        for (let i = 0; i < n; i++) {
          result.push({ id: id++, type: 'output', visible: '', full: '', done: true })
        }
      }
    }
    lines.value = result
    nextLineId = id
    status.value = 'done'
  }

  /* ---------- 重启 ---------- */

  function restart() {
    cancelled = true
    clearTimer()
    lines.value = []
    nextLineId = 1
    status.value = 'idle'
    // microtask 后启动，避免 runLoop 内部立即 cancelled
    queueMicrotask(() => {
      cancelled = false
      void runLoop()
    })
  }

  /* ---------- 生命周期 ---------- */

  onMounted(() => {
    if (autoStart) {
      // prefers-reduced-motion：直接到结果，避免多余动画
      if (prefersReducedMotion()) skipToEnd()
      else void runLoop()
    }
  })

  onBeforeUnmount(() => {
    cancelled = true
    clearTimer()
  })

  // 脚本变化后（如外部传入的 computed 数据变了）自动 restart
  watch(
    scriptRef,
    () => {
      if (status.value === 'idle') return
      restart()
    },
    { deep: false }
  )

  return {
    lines,
    status,
    isTyping,
    isDone,
    restart,
    skipToEnd
  }
}
