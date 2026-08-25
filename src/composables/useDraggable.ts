/**
 * useDraggable.ts · 通用可拖拽位置管理 composable
 *
 * 功能：
 *   - PointerEvents 统一（鼠标 + 触摸 + 触控笔）
 *   - 位置持久化到 localStorage
 *   - 边界保护（clamp 到视口内，留安全边距）
 *   - 窗口 resize 自动修正 + 保持磁吸状态
 *   - 区分「拖动」和「点击」（DRAG_THRESHOLD）
 *   - 🧲 松手后自动吸附到最近侧边（可选水平/垂直/双向；带平滑过渡）
 *
 * 用法：
 *   const size = { w: 280, h: 360 }
 *   const {
 *     currentX, currentY, isDragging, visible,
 *     onPointerDown, onResize, close, reopen,
 *     isSnapping, attachedEdge        // 用于 UI 上"贴边"高光 / 贴边阴影
 *   } = useDraggable({
 *     storageKey: 'my-widget:state',
 *     width: () => size.w,
 *     height: () => size.h,
 *     defaultAnchor: 'top-left',
 *     edgePadding: 16,
 *     magneticEdges: 'horizontal',    // 'horizontal' | 'vertical' | 'both' | 'none'（默认 none）
 *     snapDuration: 350,              // 磁吸动画时长，默认 320ms
 *     onTap: () => { ... }            // 未拖动抬起时触发（单击）
 *   })
 */
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick, type MaybeRefOrGetter, toValue } from 'vue'

export type AnchorPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
export type MagneticDirection = 'none' | 'horizontal' | 'vertical' | 'both'
export type AttachedEdge = 'left' | 'right' | 'top' | 'bottom' | null

export interface UseDraggableOptions {
  storageKey: string
  /** 返回当前拖拽元素的宽度（px），可能随状态变化，支持响应式 */
  width: MaybeRefOrGetter<number>
  /** 返回当前拖拽元素的高度（px） */
  height: MaybeRefOrGetter<number>
  /** 首次初始化的默认停靠位置 */
  defaultAnchor?: AnchorPosition
  /** 距视口边缘的安全像素，默认 16 */
  edgePadding?: number
  /** 判定为拖动的最小位移像素阈值，默认 4 */
  dragThreshold?: number
  /** 首次初始化时叠加的额外位移（可用于避开 Header/Footer，默认 0） */
  defaultInitialOffsetX?: number
  defaultInitialOffsetY?: number
  /** 松手后吸附到最近的哪几侧：默认 'none'（不吸） */
  magneticEdges?: MagneticDirection
  /** 磁吸动画时长（ms），默认 320 */
  snapDuration?: number
  /** 仅轻点（位移 < 阈值）抬起后触发 */
  onTap?: () => void
  /** 磁吸完成后触发（用于外层"贴边提示"样式） */
  onSnap?: (edge: AttachedEdge) => void
}

export function useDraggable(opts: UseDraggableOptions) {
  const {
    storageKey,
    width,
    height,
    defaultAnchor = 'bottom-right',
    edgePadding = 16,
    dragThreshold = 4,
    defaultInitialOffsetX = 0,
    defaultInitialOffsetY = 0,
    magneticEdges = 'none',
    snapDuration = 320
  } = opts

  const visible = ref(true)
  const isDragging = ref(false)
  const isSnapping = ref(false)

  /* 真实最终位置（松手后 snap 动画的目标值也是写这里） */
  const posX = ref(0)
  const posY = ref(0)
  const dragOffset = ref({ x: 0, y: 0 })
  const dragMoved = ref(false)

  /* 目前贴在哪一边（最近的那个），用于外层 UI 显示贴边高光 */
  const attachedEdge = ref<AttachedEdge>(null)

  const currentX = computed(() => posX.value + dragOffset.value.x)
  const currentY = computed(() => posY.value + dragOffset.value.y)

  function getSize() {
    return { w: toValue(width), h: toValue(height) }
  }

  function clampXY(x: number, y: number) {
    const { w, h } = getSize()
    const vw = window.innerWidth
    const vh = window.innerHeight
    const maxX = vw - w - edgePadding
    const maxY = vh - h - edgePadding
    return {
      x: Math.min(Math.max(edgePadding, x), Math.max(edgePadding, maxX)),
      y: Math.min(Math.max(edgePadding, y), Math.max(edgePadding, maxY))
    }
  }

  function initDefaultPosition() {
    const { w, h } = getSize()
    const vw = window.innerWidth
    const vh = window.innerHeight
    let x = edgePadding + defaultInitialOffsetX
    let y = edgePadding + defaultInitialOffsetY
    switch (defaultAnchor) {
      case 'top-right':
        x = vw - w - edgePadding + defaultInitialOffsetX
        y = edgePadding + defaultInitialOffsetY
        break
      case 'bottom-left':
        x = edgePadding + defaultInitialOffsetX
        y = vh - h - edgePadding + defaultInitialOffsetY
        break
      case 'bottom-right':
        x = vw - w - edgePadding + defaultInitialOffsetX
        y = vh - h - edgePadding + defaultInitialOffsetY
        break
      case 'top-left':
      default:
        break
    }
    posX.value = x
    posY.value = y
    updateAttachedEdge()
  }

  /** 根据当前位置算出最近的边（只在启用的方向里选） */
  function updateAttachedEdge() {
    if (magneticEdges === 'none') {
      attachedEdge.value = null
      return
    }
    const { w, h } = getSize()
    const vw = window.innerWidth
    const vh = window.innerHeight
    const cx = posX.value + w / 2
    const cy = posY.value + h / 2
    const distLeft = cx
    const distRight = vw - cx
    const distTop = cy
    const distBottom = vh - cy

    if (magneticEdges === 'horizontal') {
      attachedEdge.value = distLeft <= distRight ? 'left' : 'right'
      return
    }
    if (magneticEdges === 'vertical') {
      attachedEdge.value = distTop <= distBottom ? 'top' : 'bottom'
      return
    }
    // 'both'：取四向最小
    const m = new Map([
      ['left', distLeft],
      ['right', distRight],
      ['top', distTop],
      ['bottom', distBottom]
    ]) as Map<NonNullable<AttachedEdge>, number>
    let minKey: NonNullable<AttachedEdge> = 'left'
    let minVal = Infinity
    m.forEach((v, k) => {
      if (v < minVal) { minVal = v; minKey = k }
    })
    attachedEdge.value = minKey
  }

  /** 松手后 / 初始化加载后 — 按设置吸到最近的侧边（带动画） */
  function snapToNearestEdge(after?: () => void) {
    if (magneticEdges === 'none') {
      updateAttachedEdge()
      after?.()
      return
    }
    const { w, h } = getSize()
    const vw = window.innerWidth
    const vh = window.innerHeight
    const clamped = clampXY(posX.value, posY.value)
    let targetX = clamped.x
    let targetY = clamped.y

    if (magneticEdges === 'horizontal' || magneticEdges === 'both') {
      const cx = clamped.x + w / 2
      const isLeft = cx <= vw / 2
      targetX = isLeft ? edgePadding : vw - w - edgePadding
    }
    if (magneticEdges === 'vertical' || magneticEdges === 'both') {
      const cy = clamped.y + h / 2
      const isTop = cy <= vh / 2
      targetY = isTop ? edgePadding : vh - h - edgePadding
    }
    // 纵向：顶部保留 Header 安全距离（defaultInitialOffsetY）
    targetY = Math.max(targetY, edgePadding + defaultInitialOffsetY)

    const fromX = posX.value
    const fromY = posY.value
    if (Math.abs(fromX - targetX) < 0.5 && Math.abs(fromY - targetY) < 0.5) {
      updateAttachedEdge()
      saveState()
      after?.()
      return
    }
    isSnapping.value = true
    const startedAt = performance.now()
    const dur = Math.max(120, snapDuration)
    const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3)
    const tick = (now: number) => {
      const p = Math.min(1, (now - startedAt) / dur)
      const e = easeOutCubic(p)
      posX.value = fromX + (targetX - fromX) * e
      posY.value = fromY + (targetY - fromY) * e
      if (p < 1) {
        requestAnimationFrame(tick)
      } else {
        posX.value = targetX
        posY.value = targetY
        isSnapping.value = false
        updateAttachedEdge()
        saveState()
        opts.onSnap?.(attachedEdge.value)
        after?.()
      }
    }
    requestAnimationFrame(tick)
  }

  function loadState(): boolean {
    try {
      const raw = localStorage.getItem(storageKey)
      if (!raw) return false
      const state = JSON.parse(raw)
      if (typeof state.visible === 'boolean') visible.value = state.visible
      if (typeof state.posX === 'number' && typeof state.posY === 'number') {
        const clamped = clampXY(state.posX, state.posY)
        posX.value = clamped.x
        posY.value = clamped.y
        return true
      }
    } catch { /* ignore */ }
    return false
  }

  function saveState() {
    try {
      localStorage.setItem(storageKey, JSON.stringify({
        visible: visible.value,
        posX: posX.value,
        posY: posY.value
      }))
    } catch { /* ignore */ }
  }

  let startX = 0
  let startY = 0
  let savedPosX = 0
  let savedPosY = 0

  function onPointerDown(ev: PointerEvent) {
    if (ev.button !== undefined && ev.button !== 0) return
    isDragging.value = true
    dragMoved.value = false
    startX = ev.clientX
    startY = ev.clientY
    savedPosX = posX.value
    savedPosY = posY.value
    dragOffset.value = { x: 0, y: 0 }
    ;(ev.target as HTMLElement).setPointerCapture?.(ev.pointerId)
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
  }

  function onPointerMove(ev: PointerEvent) {
    if (!isDragging.value) return
    const dx = ev.clientX - startX
    const dy = ev.clientY - startY
    if (!dragMoved.value && Math.sqrt(dx * dx + dy * dy) > dragThreshold) {
      dragMoved.value = true
    }
    const clamped = clampXY(savedPosX + dx, savedPosY + dy)
    posX.value = clamped.x
    posY.value = clamped.y
  }

  function onPointerUp() {
    isDragging.value = false
    dragOffset.value = { x: 0, y: 0 }
    window.removeEventListener('pointermove', onPointerMove)
    window.removeEventListener('pointerup', onPointerUp)
    if (!dragMoved.value) opts.onTap?.()
    snapToNearestEdge()
  }

  function close() {
    visible.value = false
    saveState()
  }

  function reopen() {
    visible.value = true
    // 从"关闭态"重新打开时，如果有磁吸，也贴一下边
    nextTick(() => snapToNearestEdge())
  }

  function onResize() {
    const clamped = clampXY(posX.value, posY.value)
    if (clamped.x !== posX.value || clamped.y !== posY.value) {
      posX.value = clamped.x
      posY.value = clamped.y
    }
    // resize 后重新贴边（窗口变窄时保证仍吸附）
    snapToNearestEdge()
  }

  /** 外部强制对齐一次（尺寸变化后、从球→展开后调用） */
  function reattach(after?: () => void) {
    snapToNearestEdge(after)
  }

  watch([posX, posY, visible], saveState)

  onMounted(() => {
    window.addEventListener('resize', onResize)
    if (!loadState()) {
      initDefaultPosition()
      nextTick(() => snapToNearestEdge(saveState))
    } else {
      // 有持久化位置：在磁吸模式下，也在 mount 时顺势贴一次（保证用户改变窗口习惯后仍漂亮）
      nextTick(() => snapToNearestEdge(saveState))
    }
  })

  onBeforeUnmount(() => {
    window.removeEventListener('resize', onResize)
  })

  return {
    visible,
    isDragging,
    /** 是否正在磁吸动画中（可用于外层禁 hover / 过渡） */
    isSnapping,
    /** 当前吸附到的边缘（非磁吸模式下恒为 null） */
    attachedEdge,
    currentX,
    currentY,
    onPointerDown,
    onResize,
    close,
    reopen,
    /** 外部（尺寸切换/折叠切换完成后）主动触发一次吸附 */
    reattach
  }
}
