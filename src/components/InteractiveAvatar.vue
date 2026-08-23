<script setup lang="ts">
/**
 * InteractiveAvatar · 可交互虚拟形象
 * SVG 卡通头像 + 眼睛跟随鼠标 + 点击弹跳动画
 * - 鼠标移入：眼球跟随光标移动（瞳孔在眼眶内按角度偏移）
 * - 鼠标移出：眼球回归居中
 * - 点击 / 触摸：整头像做弹跳 + 眨眼反馈
 */
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'

const avatarRef = ref<HTMLElement | null>(null)
const leftEyeRef = ref<SVGGElement | null>(null)
const rightEyeRef = ref<SVGGElement | null>(null)

/** 瞳孔偏移范围（px）——决定眼球活动幅度 */
const PUPIL_RANGE = 4

/** 眼球位置状态（相对眼眶中心的偏移 x/y） */
const pupilOffset = ref({ x: 0, y: 0 })
const isHovering = ref(false)
const isBouncing = ref(false)
const isBlinking = ref(false)
const mouthState = ref<'smile' | 'neutral' | 'excited'>('smile')

/** 计算瞳孔在眼眶内的位置 */
const pupilTransform = computed(() => {
  const { x, y } = pupilOffset.value
  return `translate(${x.toFixed(2)}, ${y.toFixed(2)})`
})

/** 鼠标移动 → 计算眼球偏移（限制在圆形眼眶范围内） */
function handleMouseMove(ev: MouseEvent) {
  if (!avatarRef.value) return
  const rect = avatarRef.value.getBoundingClientRect()
  const cx = rect.left + rect.width / 2
  const cy = rect.top + rect.height * 0.42
  const dx = ev.clientX - cx
  const dy = ev.clientY - cy
  const dist = Math.sqrt(dx * dx + dy * dy) || 1
  const maxDist = Math.min(rect.width, rect.height) * 0.22
  const scale = Math.min(1, maxDist / dist) * (PUPIL_RANGE / maxDist) * (rect.width / 100)
  pupilOffset.value = { x: dx * scale, y: dy * scale }
}

function handleMouseEnter() {
  isHovering.value = true
  window.addEventListener('mousemove', handleMouseMove)
}

function handleMouseLeave() {
  isHovering.value = false
  pupilOffset.value = { x: 0, y: 0 }
  window.removeEventListener('mousemove', handleMouseMove)
}

/** 点击弹跳 + 眨眼 */
function triggerBounce() {
  if (isBouncing.value) return
  isBouncing.value = true
  isBlinking.value = true
  mouthState.value = 'excited'
  setTimeout(() => { isBlinking.value = false }, 150)
  setTimeout(() => { mouthState.value = 'smile' }, 600)
  setTimeout(() => { isBouncing.value = false }, 450)
}

/** 自动眨眼（每 3~5 秒随机一次，模拟活人感） */
let blinkTimer: ReturnType<typeof setTimeout> | null = null
function scheduleBlink() {
  const delay = 3000 + Math.random() * 2000
  blinkTimer = setTimeout(() => {
    isBlinking.value = true
    setTimeout(() => { isBlinking.value = false }, 120)
    scheduleBlink()
  }, delay)
}

onMounted(() => { scheduleBlink() })
onBeforeUnmount(() => {
  if (blinkTimer) clearTimeout(blinkTimer)
  window.removeEventListener('mousemove', handleMouseMove)
})
</script>

<template>
  <div
    ref="avatarRef"
    class="interactive-avatar relative size-24 md:size-28 shrink-0 cursor-pointer select-none"
    :class="{ 'avatar-bounce': isBouncing }"
    @mouseenter="handleMouseEnter"
    @mouseleave="handleMouseLeave"
    @click="triggerBounce"
    role="button"
    tabindex="0"
    aria-label="可交互虚拟形象，点击试试"
  >
    <svg
      viewBox="0 0 200 200"
      class="w-full h-full"
      :class="{ 'avatar-idle': !isHovering && !isBouncing, 'avatar-hover': isHovering }"
    >
      <defs>
        <linearGradient id="avatar-bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="hsl(var(--brand))" />
          <stop offset="60%" stop-color="hsl(var(--accent))" />
          <stop offset="100%" stop-color="hsl(var(--chart-2))" />
        </linearGradient>
        <linearGradient id="face-grad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="hsl(var(--surface-elevated))" />
          <stop offset="100%" stop-color="hsl(var(--surface-muted))" />
        </linearGradient>
        <filter id="avatar-shadow" x="-10%" y="-5%" width="120%" height="120%">
          <feDropShadow dx="0" dy="6" stdDeviation="8" flood-opacity="0.2" />
        </filter>
      </defs>

      <!-- 背景圆 -->
      <circle cx="100" cy="100" r="96" fill="url(#avatar-bg)" filter="url(#avatar-shadow)" />

      <!-- 高光装饰 -->
      <ellipse cx="72" cy="52" rx="18" ry="10" fill="white" opacity="0.18" transform="rotate(-25 72 52)" />

      <!-- 头部（脸型） -->
      <g class="head-group">
        <ellipse cx="100" cy="108" rx="48" ry="52" fill="url(#face-grad)" stroke="hsl(var(--border))" stroke-width="1.5" />

        <!-- 头发（顶部刘海） -->
        <path
          d="M58 82 Q62 52 100 48 Q138 52 142 82 Q132 68 100 64 Q68 68 58 82Z"
          fill="hsl(var(--brand))"
          opacity="0.85"
        />
        <!-- 左侧头发束 -->
        <path d="M52 96 Q46 84 54 72 Q50 82 52 96Z" fill="hsl(var(--brand))" opacity="0.75" />
        <!-- 右侧头发束 -->
        <path d="M148 96 Q154 84 146 72 Q150 82 148 96Z" fill="hsl(var(--brand))" opacity="0.75" />

        <!-- 左眼（眼眶） -->
        <g ref="leftEyeRef">
          <ellipse cx="80" cy="105" rx="11" ry="isBlinking ? 1 : 12" fill="white" stroke="hsl(var(--border))" stroke-width="1" />
          <!-- 瞳孔（跟随鼠标） -->
          <g :transform="pupilTransform" style="transition: transform 0.08s ease-out">
            <circle cx="80" cy="105" r="6" fill="hsl(var(--text))" />
            <circle cx="78" cy="103" r="2.5" fill="white" />
          </g>
        </g>

        <!-- 右眼（眼眶） -->
        <g ref="rightEyeRef">
          <ellipse cx="120" cy="105" rx="11" ry="isBlinking ? 1 : 12" fill="white" stroke="hsl(var(--border))" stroke-width="1" />
          <!-- 瞳孔（跟随鼠标） -->
          <g :transform="pupilTransform" style="transition: transform 0.08s ease-out">
            <circle cx="120" cy="105" r="6" fill="hsl(var(--text))" />
            <circle cx="118" cy="103" r="2.5" fill="white" />
          </g>
        </g>

        <!-- 腮红 -->
        <ellipse cx="66" cy="128" rx="8" ry="5" fill="hsl(var(--brand))" opacity="0.2" />
        <ellipse cx="134" cy="128" rx="8" ry="5" fill="hsl(var(--brand))" opacity="0.2" />

        <!-- 嘴巴（根据状态切换形状） -->
        <g class="mouth-group">
          <!-- 默认微笑 -->
          <path
            v-if="mouthState === 'smile'"
            d="M88 132 Q100 144 112 132"
            fill="none"
            stroke="hsl(var(--text))"
            stroke-width="2.5"
            stroke-linecap="round"
            class="mouth-path"
          />
          <!-- 兴奋张嘴 -->
          <path
            v-else
            d="M88 130 Q100 150 112 130 Q100 140 88 130Z"
            fill="hsl(var(--text))"
            stroke="hsl(var(--text))"
            stroke-width="1.5"
            stroke-linecap="round"
            class="mouth-path"
          />
        </g>
      </g>

      <!-- 星星装饰（hover 时闪烁） -->
      <g :class="{ 'opacity-0': !isHovering, 'opacity-100': isHovering }" style="transition: opacity 0.3s 0.2s">
        <path d="M160 54 l3 6 l6 1 l-4 4 l1 6 l-6 -3 l-6 3 l1 -6 l-4 -4 l6 -1 z" fill="hsl(var(--brand))" />
        <path d="M40 66 l2 4 l4 0.5 l-2.5 2.5 l0.5 4 l-4 -2 l-4 2 l0.5 -4 l-2.5 -2.5 l4 -0.5 z" fill="hsl(var(--accent))" />
      </g>
    </svg>
  </div>
</template>

<style scoped>
/* 呼吸待机动画：持续轻微的上下浮动 */
.avatar-idle {
  animation: avatar-breath 3.5s ease-in-out infinite;
}
@keyframes avatar-breath {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-3px); }
}

/* hover 微放大 */
.avatar-hover {
  animation: avatar-hover 0.4s ease-out;
}
@keyframes avatar-hover {
  0% { transform: scale(1); }
  100% { transform: scale(1.04); }
}

/* 点击弹跳 */
.avatar-bounce {
  animation: avatar-bounce 0.45s cubic-bezier(0.34, 1.56, 0.64, 1);
}
@keyframes avatar-bounce {
  0% { transform: scale(1); }
  30% { transform: scale(1.18, 0.82); }
  60% { transform: scale(0.92, 1.08); }
  100% { transform: scale(1); }
}

/* 头像整体过渡 */
.interactive-avatar {
  transition: filter 0.3s ease;
}
.interactive-avatar:hover {
  filter: brightness(1.08);
}

/* 嘴巴过渡 */
.mouth-path {
  transition: d 0.3s ease;
}

/* 尊重减弱动效偏好 */
@media (prefers-reduced-motion: reduce) {
  .avatar-idle,
  .avatar-hover,
  .avatar-bounce {
    animation: none;
  }
}
</style>
