<script setup lang="ts">
/**
 * DraggableCharacter · 右下角可拖动的动漫虚拟形象
 * 功能：
 *   - 默认停靠在右下角，可鼠标/触摸拖动到屏幕任意位置
 *   - 双击：弹跳 + 对话气泡互动
 *   - 悬停：显示招呼气泡（可自定义文案）
 *   - 关闭按钮：临时收起（localStorage 记住状态）
 *   - 位置持久化：刷新后保持上次位置
 *   - 尊重 prefers-reduced-motion
 */
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'

const props = withDefaults(defineProps<{
  /** 角色图片 URL（动漫角色 PNG，建议透明背景） */
  image?: string
  /** 角色尺寸（像素） */
  size?: number
  /** 默认招呼文案 */
  greeting?: string
  /** 双击互动文案 */
  interactionText?: string
}>(), {
  image: '',
  size: 96,
  greeting: '嗨！把我拖到你喜欢的位置～',
  interactionText: '嘿，被你发现啦！✨'
})

const STORAGE_KEY = 'draggable-character:state'
const EDGE_PADDING = 16
const DRAG_THRESHOLD = 4

const visible = ref(true)
const isDragging = ref(false)
const isHovered = ref(false)
const isBouncing = ref(false)
const showBubble = ref(false)
const bubbleText = ref('')

/** 位置状态（单位：像素，相对视口左上角） */
const posX = ref(0)
const posY = ref(0)

/** 拖拽过程中的位移偏移 */
const dragOffset = ref({ x: 0, y: 0 })
const dragMoved = ref(false)

/** 当前角色实际位置（含拖拽偏移量） */
const currentX = computed(() => posX.value + dragOffset.value.x)
const currentY = computed(() => posY.value + dragOffset.value.y)

/** 是否显示招呼气泡（hover 或 interaction 时） */
const showHoverBubble = computed(() => isHovered.value && !isDragging.value && !showBubble.value)

/** 初始化位置：右下角 */
function initDefaultPosition() {
  const w = window.innerWidth
  const h = window.innerHeight
  posX.value = w - props.size - EDGE_PADDING * 2
  posY.value = h - props.size - EDGE_PADDING * 2
}

/** 读取持久化状态 */
function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return false
    const state = JSON.parse(raw)
    if (typeof state.visible === 'boolean') visible.value = state.visible
    if (typeof state.posX === 'number' && typeof state.posY === 'number') {
      const w = window.innerWidth
      const h = window.innerHeight
      const maxX = w - props.size - EDGE_PADDING
      const maxY = h - props.size - EDGE_PADDING
      posX.value = Math.min(Math.max(EDGE_PADDING, state.posX), Math.max(EDGE_PADDING, maxX))
      posY.value = Math.min(Math.max(EDGE_PADDING, state.posY), Math.max(EDGE_PADDING, maxY))
      return true
    }
  } catch { /* ignore */ }
  return false
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      visible: visible.value,
      posX: posX.value,
      posY: posY.value
    }))
  } catch { /* ignore */ }
}

/** 拖拽开始 */
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
  ;(ev.target as HTMLElement).setPointerCapture?.(ev.pointerId)
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', onPointerUp)
}

function onPointerMove(ev: PointerEvent) {
  if (!isDragging.value) return
  const dx = ev.clientX - startX
  const dy = ev.clientY - startY
  if (!dragMoved.value && Math.sqrt(dx * dx + dy * dy) > DRAG_THRESHOLD) {
    dragMoved.value = true
  }
  const w = window.innerWidth
  const h = window.innerHeight
  const maxX = w - props.size - EDGE_PADDING
  const maxY = h - props.size - EDGE_PADDING
  posX.value = Math.min(Math.max(EDGE_PADDING, savedPosX + dx), Math.max(EDGE_PADDING, maxX))
  posY.value = Math.min(Math.max(EDGE_PADDING, savedPosY + dy), Math.max(EDGE_PADDING, maxY))
}

function onPointerUp() {
  isDragging.value = false
  dragOffset.value = { x: 0, y: 0 }
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', onPointerUp)
  if (!dragMoved.value) {
    onTap()
  }
  saveState()
}

/** 点击 / 双击交互 */
let clickTimer: ReturnType<typeof setTimeout> | null = null
let clickCount = 0

function onTap() {
  clickCount++
  if (clickCount === 1) {
    clickTimer = setTimeout(() => { clickCount = 0 }, 300)
    bubbleText.value = props.greeting
    showBubble.value = true
    setTimeout(() => { if (!isBouncing.value) showBubble.value = false }, 2400)
  } else if (clickCount === 2) {
    if (clickTimer) clearTimeout(clickTimer)
    clickCount = 0
    triggerInteraction()
  }
}

function triggerInteraction() {
  if (isBouncing.value) return
  isBouncing.value = true
  bubbleText.value = props.interactionText
  showBubble.value = true
  setTimeout(() => { showBubble.value = false }, 2000)
  setTimeout(() => { isBouncing.value = false }, 600)
}

function onMouseEnter() {
  isHovered.value = true
}
function onMouseLeave() {
  isHovered.value = false
}

function close() {
  visible.value = false
  saveState()
}

function reopen() {
  visible.value = true
  saveState()
}

/** 窗口 resize 时修正位置 */
function onResize() {
  const w = window.innerWidth
  const h = window.innerHeight
  const maxX = w - props.size - EDGE_PADDING
  const maxY = h - props.size - EDGE_PADDING
  posX.value = Math.min(Math.max(EDGE_PADDING, posX.value), Math.max(EDGE_PADDING, maxX))
  posY.value = Math.min(Math.max(EDGE_PADDING, posY.value), Math.max(EDGE_PADDING, maxY))
  saveState()
}

watch([posX, posY, visible], saveState)

onMounted(() => {
  window.addEventListener('resize', onResize)
  if (!loadState()) {
    initDefaultPosition()
    nextTick(saveState)
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize)
})

defineExpose({ reopen })
</script>

<template>
  <Teleport to="body">
    <!-- 收起状态：小按钮固定在右下角 -->
    <Transition name="char-fade">
      <button
        v-if="!visible"
        type="button"
        class="fixed z-[9999] bottom-4 right-4 inline-flex items-center gap-1.5 rounded-full bg-brand text-brand-on shadow-lg px-3.5 py-2 text-sm font-medium hover:bg-brand/90 transition-all"
        @click="reopen"
      >
        <svg viewBox="0 0 24 24" class="size-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10" />
          <path d="M8 14s1.5 2 4 2 4-2 4-2" />
          <line x1="9" y1="9" x2="9.01" y2="9" />
          <line x1="15" y1="9" x2="15.01" y2="9" />
        </svg>
        <span>唤醒</span>
      </button>
    </Transition>

    <!-- 虚拟形象本体 -->
    <Transition name="char-fade">
      <div
        v-if="visible"
        class="fixed z-[9999] select-none"
        :class="{
          'cursor-grab': !isDragging,
          'cursor-grabbing': isDragging,
          'char-bounce': isBouncing,
          'char-dragging': isDragging
        }"
        :style="{
          width: `${size}px`,
          height: `${size}px`,
          left: `${currentX}px`,
          top: `${currentY}px`,
          touchAction: 'none'
        }"
        @pointerdown="onPointerDown"
        @mouseenter="onMouseEnter"
        @mouseleave="onMouseLeave"
      >
        <!-- 角色图片或默认占位 SVG -->
        <img
          v-if="image"
          :src="image"
          alt="虚拟形象"
          draggable="false"
          class="w-full h-full object-contain pointer-events-none drop-shadow-[0_8px_24px_rgba(0,0,0,0.25)]"
        />
        <!-- 默认占位：一只可爱的小熊 -->
        <svg
          v-else
          viewBox="0 0 120 120"
          draggable="false"
          class="w-full h-full pointer-events-none drop-shadow-[0_8px_24px_rgba(0,0,0,0.25)]"
        >
          <defs>
            <radialGradient id="char-body" cx="50%" cy="45%" r="55%">
              <stop offset="0%" stop-color="hsl(var(--accent))" />
              <stop offset="100%" stop-color="hsl(var(--brand))" />
            </radialGradient>
          </defs>
          <!-- 身体 -->
          <circle cx="60" cy="68" r="38" fill="url(#char-body)" />
          <!-- 左耳 -->
          <circle cx="34" cy="36" r="12" fill="hsl(var(--brand))" />
          <circle cx="34" cy="36" r="6" fill="hsl(var(--accent))" opacity="0.6" />
          <!-- 右耳 -->
          <circle cx="86" cy="36" r="12" fill="hsl(var(--brand))" />
          <circle cx="86" cy="36" r="6" fill="hsl(var(--accent))" opacity="0.6" />
          <!-- 眼白 -->
          <circle cx="48" cy="58" r="9" fill="white" />
          <circle cx="72" cy="58" r="9" fill="white" />
          <!-- 瞳孔 -->
          <circle cx="49" cy="59" r="4.5" fill="hsl(var(--text))" />
          <circle cx="73" cy="59" r="4.5" fill="hsl(var(--text))" />
          <!-- 高光 -->
          <circle cx="47" cy="57" r="1.8" fill="white" />
          <circle cx="71" cy="57" r="1.8" fill="white" />
          <!-- 鼻子 -->
          <ellipse cx="60" cy="72" rx="4" ry="3" fill="hsl(var(--text))" />
          <!-- 嘴巴 -->
          <path d="M52 78 Q60 86 68 78" fill="none" stroke="hsl(var(--text))" stroke-width="2.5" stroke-linecap="round" />
          <!-- 腮红 -->
          <circle cx="40" cy="72" r="4" fill="hsl(var(--brand))" opacity="0.25" />
          <circle cx="80" cy="72" r="4" fill="hsl(var(--brand))" opacity="0.25" />
        </svg>

        <!-- 对话气泡 -->
        <Transition name="bubble" appear>
          <div
            v-if="showBubble || showHoverBubble"
            class="absolute -top-12 left-1/2 -translate-x-1/2 whitespace-nowrap"
            :class="{ 'bubble-pop': showBubble }"
          >
            <div class="relative rounded-xl bg-surface-elevated border border-border/60 shadow-lg px-3 py-2 text-sm font-medium text-text">
              {{ showBubble ? bubbleText : greeting }}
              <span class="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rotate-45 bg-surface-elevated border-r border-b border-border/60" />
            </div>
          </div>
        </Transition>

        <!-- 关闭按钮 -->
        <button
          type="button"
          class="absolute -top-2 -right-2 size-6 rounded-full bg-surface-elevated border border-border/60 shadow-md text-text-muted hover:text-danger hover:border-danger/50 flex items-center justify-center transition"
          aria-label="收起虚拟形象"
          @click.stop="close"
        >
          <svg viewBox="0 0 24 24" class="size-3.5" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>

        <!-- 拖拽提示（仅第一次短暂显示） -->
        <Transition name="bubble" appear>
          <div
            v-if="isDragging"
            class="absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap text-xs text-text-muted bg-surface-elevated/90 rounded-full px-2 py-1 shadow-sm border border-border/40"
          >
            拖我到任意位置
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
/* 弹入弹出 */
.char-fade-enter-active,
.char-fade-leave-active {
  transition: opacity 0.3s ease, transform 0.3s cubic-bezier(0.22, 1, 0.36, 1);
}
.char-fade-enter-from,
.char-fade-leave-to {
  opacity: 0;
  transform: scale(0.6);
}

/* 对话气泡动画 */
.bubble-enter-active,
.bubble-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.bubble-enter-from,
.bubble-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(4px) scale(0.9);
}

/* 点击弹跳 */
.char-bounce {
  animation: char-bounce 0.55s cubic-bezier(0.34, 1.56, 0.64, 1);
}
@keyframes char-bounce {
  0%   { transform: scale(1) rotate(0deg); }
  25%  { transform: scale(1.2, 0.85) rotate(-5deg); }
  50%  { transform: scale(0.9, 1.12) rotate(3deg); }
  75%  { transform: scale(1.05, 0.95) rotate(-1deg); }
  100% { transform: scale(1) rotate(0deg); }
}

/* 拖拽中的微缩放 */
.char-dragging {
  transform: scale(1.06);
  transition: transform 0.15s ease;
}

/* 气泡 pop 效果 */
.bubble-pop {
  animation: bubble-pop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}
@keyframes bubble-pop {
  0%   { transform: translateX(-50%) scale(0.6); }
  60%  { transform: translateX(-50%) scale(1.08); }
  100% { transform: translateX(-50%) scale(1); }
}

/* 减弱动效 */
@media (prefers-reduced-motion: reduce) {
  .char-fade-enter-active,
  .char-fade-leave-active,
  .bubble-enter-active,
  .bubble-leave-active,
  .char-bounce,
  .bubble-pop {
    transition: none;
    animation: none;
  }
}
</style>
