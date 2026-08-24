<script setup lang="ts">
/**
 * LoadingDemoPage · 加载动画演示页。
 * 展示项目选型建议的 4 种加载动画 + 常见 11 种参考。
 * 所有动画实时运行，可直观对比。
 */
import { ref } from 'vue'
import LoadingOverlay from '@/components/LoadingOverlay.vue'
import BlogSkeleton from '@/components/BlogSkeleton.vue'
import OrbitLoader from '@/components/OrbitLoader.vue'
import { useScrollReveal } from '@/composables/useScrollReveal'

const rootRef = ref<HTMLElement | null>(null)
useScrollReveal(rootRef)

/* 演示控制 */
const showOverlay = ref(false)
const showOrbit = ref(false)
const showSkeleton = ref(false)

function flashOverlay() {
  showOverlay.value = true
  setTimeout(() => { showOverlay.value = false }, 2500)
}
function flashOrbit() {
  showOrbit.value = true
  setTimeout(() => { showOrbit.value = false }, 3000)
}
function flashSkeleton() {
  showSkeleton.value = true
  setTimeout(() => { showSkeleton.value = false }, 2500)
}
</script>

<template>
  <article ref="rootRef" class="max-w-5xl mx-auto space-y-12 pb-20">

    <!-- 全屏遮罩（演示触发） -->
    <LoadingOverlay :visible="showOverlay" text="正在加载页面..." />
    <OrbitLoader :visible="showOrbit" text="初始化 3D 星链..." />

    <!-- 页头 -->
    <header class="space-y-5" data-reveal>
      <p class="m-0 text-xs font-mono text-brand uppercase tracking-wider">/ demo / loading</p>
      <h1 class="m-0 text-3xl md:text-4xl font-bold tracking-tight leading-tight">
        加载动画<span class="text-brand">演示场</span>
      </h1>
      <p class="m-0 text-base text-text-muted leading-relaxed max-w-2xl">
        项目选型 4 种 + 常见参考 11 种，全部实时运行。点击按钮可触发真实组件效果。
      </p>
    </header>

    <!-- ====== 项目选型 4 种 ====== -->
    <section class="space-y-5" data-reveal="0.04">
      <div class="flex items-center gap-2">
        <span class="text-base">🎯</span>
        <h2 class="m-0 text-lg font-semibold tracking-tight">项目选型（可交互触发）</h2>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">

        <!-- 1. 渐变环 - 全屏加载 -->
        <div class="demo-card group rounded-xl border border-border/60 bg-surface p-6 space-y-4 hover:border-brand/30 transition-colors">
          <div class="flex items-center justify-between">
            <div>
              <p class="m-0 text-sm font-semibold text-text">渐变环 · 全屏加载</p>
              <p class="m-0 text-xs text-text-muted mt-0.5">路由切换 / 首屏加载</p>
            </div>
            <div class="gradient-ring-demo" />
          </div>
          <p class="m-0 text-xs text-text-muted font-mono">conic-gradient + mask 镂空</p>
          <button
            class="px-4 py-2 rounded-lg text-xs font-medium bg-brand text-white hover:opacity-90 transition"
            @click="flashOverlay"
          >触发全屏遮罩</button>
        </div>

        <!-- 2. 骨架屏 - 列表加载 -->
        <div class="demo-card group rounded-xl border border-border/60 bg-surface p-6 space-y-4 hover:border-brand/30 transition-colors">
          <div class="flex items-center justify-between">
            <div>
              <p class="m-0 text-sm font-semibold text-text">骨架屏 · 列表加载</p>
              <p class="m-0 text-xs text-text-muted mt-0.5">博客列表 / 卡片网格</p>
            </div>
            <div class="skel-demo" />
          </div>
          <p class="m-0 text-xs text-text-muted font-mono">shimmer 光扫过效果</p>
          <button
            class="px-4 py-2 rounded-lg text-xs font-medium bg-brand text-white hover:opacity-90 transition"
            @click="flashSkeleton"
          >触发骨架屏</button>
          <!-- 骨架屏弹出层 -->
          <Transition name="skel-pop">
            <div v-if="showSkeleton" class="absolute inset-0 bg-surface/90 backdrop-blur-sm rounded-xl p-4 overflow-hidden">
              <BlogSkeleton :count="3" />
            </div>
          </Transition>
        </div>

        <!-- 3. 轨道环绕 - 3D 初始化 -->
        <div class="demo-card group relative rounded-xl border border-border/60 bg-surface p-6 space-y-4 hover:border-brand/30 transition-colors">
          <div class="flex items-center justify-between">
            <div>
              <p class="m-0 text-sm font-semibold text-text">轨道环绕 · 3D 初始化</p>
              <p class="m-0 text-xs text-text-muted mt-0.5">星链加载 / 重计算场景</p>
            </div>
            <div class="orbit-demo">
              <div class="orbit-c" /><div class="orbit-d" />
            </div>
          </div>
          <p class="m-0 text-xs text-text-muted font-mono">双轨道 + 反向旋转</p>
          <button
            class="px-4 py-2 rounded-lg text-xs font-medium bg-brand text-white hover:opacity-90 transition"
            @click="flashOrbit"
          >触发轨道加载</button>
        </div>

        <!-- 4. 文字打字光标 - 终端 -->
        <div class="demo-card group rounded-xl border border-border/60 bg-surface p-6 space-y-4 hover:border-brand/30 transition-colors">
          <div class="flex items-center justify-between">
            <div>
              <p class="m-0 text-sm font-semibold text-text">文字打字光标 · 终端</p>
              <p class="m-0 text-xs text-text-muted mt-0.5">Hero 区 / AI 回答中</p>
            </div>
            <div class="typing-demo">
              <span class="cursor-blink">▊</span>
            </div>
          </div>
          <p class="m-0 text-xs text-text-muted font-mono">steps(2) 闪烁光标</p>
          <a
            href="/#/"
            class="inline-block px-4 py-2 rounded-lg text-xs font-medium bg-brand text-white hover:opacity-90 transition no-underline"
          >前往首页查看</a>
        </div>
      </div>
    </section>

    <!-- ====== 常见参考 11 种 ====== -->
    <section class="space-y-5" data-reveal="0.08">
      <div class="flex items-center gap-2">
        <span class="text-base">📚</span>
        <h2 class="m-0 text-lg font-semibold tracking-tight">常见参考（纯展示）</h2>
      </div>
      <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">

        <div class="ref-card rounded-lg border border-border/50 bg-surface p-4 flex flex-col items-center gap-3">
          <div class="h-12 flex items-center justify-center">
            <div class="ref-spinner" />
          </div>
          <div class="text-center">
            <p class="m-0 text-xs font-semibold text-text">圆环旋转</p>
            <p class="m-0 text-[10px] text-text-muted font-mono mt-0.5">Spinner</p>
          </div>
        </div>

        <div class="ref-card rounded-lg border border-border/50 bg-surface p-4 flex flex-col items-center gap-3">
          <div class="h-12 flex items-center justify-center">
            <div class="ref-dual-ring" />
          </div>
          <div class="text-center">
            <p class="m-0 text-xs font-semibold text-text">双圈反转</p>
            <p class="m-0 text-[10px] text-text-muted font-mono mt-0.5">Dual Ring</p>
          </div>
        </div>

        <div class="ref-card rounded-lg border border-border/50 bg-surface p-4 flex flex-col items-center gap-3">
          <div class="h-12 flex items-center justify-center">
            <div class="ref-dots-bounce"><span></span><span></span><span></span></div>
          </div>
          <div class="text-center">
            <p class="m-0 text-xs font-semibold text-text">点跳动</p>
            <p class="m-0 text-[10px] text-text-muted font-mono mt-0.5">Bounce Dots</p>
          </div>
        </div>

        <div class="ref-card rounded-lg border border-border/50 bg-surface p-4 flex flex-col items-center gap-3">
          <div class="h-12 flex items-center justify-center">
            <div class="ref-dots-pulse"><span></span><span></span><span></span></div>
          </div>
          <div class="text-center">
            <p class="m-0 text-xs font-semibold text-text">点脉冲</p>
            <p class="m-0 text-[10px] text-text-muted font-mono mt-0.5">Pulse Dots</p>
          </div>
        </div>

        <div class="ref-card rounded-lg border border-border/50 bg-surface p-4 flex flex-col items-center gap-3">
          <div class="h-12 flex items-center justify-center">
            <div class="ref-bar-track"><div class="ref-bar-fill" /></div>
          </div>
          <div class="text-center">
            <p class="m-0 text-xs font-semibold text-text">不定进度条</p>
            <p class="m-0 text-[10px] text-text-muted font-mono mt-0.5">Indeterminate</p>
          </div>
        </div>

        <div class="ref-card rounded-lg border border-border/50 bg-surface p-4 flex flex-col items-center gap-3">
          <div class="h-12 flex items-center justify-center">
            <div class="ref-wave"><span></span><span></span><span></span><span></span><span></span></div>
          </div>
          <div class="text-center">
            <p class="m-0 text-xs font-semibold text-text">波浪音柱</p>
            <p class="m-0 text-[10px] text-text-muted font-mono mt-0.5">Wave Bars</p>
          </div>
        </div>

        <div class="ref-card rounded-lg border border-border/50 bg-surface p-4 flex flex-col items-center gap-3">
          <div class="h-12 flex items-center justify-center">
            <div class="ref-heartbeat" />
          </div>
          <div class="text-center">
            <p class="m-0 text-xs font-semibold text-text">心跳脉冲</p>
            <p class="m-0 text-[10px] text-text-muted font-mono mt-0.5">Heartbeat</p>
          </div>
        </div>

        <div class="ref-card rounded-lg border border-border/50 bg-surface p-4 flex flex-col items-center gap-3">
          <div class="h-12 flex items-center justify-center">
            <div class="ref-cube" />
          </div>
          <div class="text-center">
            <p class="m-0 text-xs font-semibold text-text">方块翻转</p>
            <p class="m-0 text-[10px] text-text-muted font-mono mt-0.5">Flip Cube</p>
          </div>
        </div>

        <div class="ref-card rounded-lg border border-border/50 bg-surface p-4 flex flex-col items-center gap-3">
          <div class="h-12 flex items-center justify-center">
            <div class="ref-skel-row">
              <div class="ref-skel" /><div class="ref-skel w-3/4" /><div class="ref-skel w-1/2" />
            </div>
          </div>
          <div class="text-center">
            <p class="m-0 text-xs font-semibold text-text">骨架屏</p>
            <p class="m-0 text-[10px] text-text-muted font-mono mt-0.5">Skeleton</p>
          </div>
        </div>

        <div class="ref-card rounded-lg border border-border/50 bg-surface p-4 flex flex-col items-center gap-3">
          <div class="h-12 flex items-center justify-center">
            <span class="ref-blink-cursor">▊</span>
          </div>
          <div class="text-center">
            <p class="m-0 text-xs font-semibold text-text">光标闪烁</p>
            <p class="m-0 text-[10px] text-text-muted font-mono mt-0.5">Blink Cursor</p>
          </div>
        </div>

        <div class="ref-card rounded-lg border border-border/50 bg-surface p-4 flex flex-col items-center gap-3">
          <div class="h-12 flex items-center justify-center">
            <div class="ref-butterfly"><span></span><span></span></div>
          </div>
          <div class="text-center">
            <p class="m-0 text-xs font-semibold text-text">蝴蝶振翅</p>
            <p class="m-0 text-[10px] text-text-muted font-mono mt-0.5">Butterfly</p>
          </div>
        </div>
      </div>
    </section>

  </article>
</template>

<style scoped>
/* ====== 项目选型 · 渐变环演示 ====== */
.gradient-ring-demo {
  width: 32px; height: 32px;
  border-radius: 50%;
  background: conic-gradient(var(--brand), var(--accent), var(--chart-series-4, #22A5F7), var(--brand));
  -webkit-mask: radial-gradient(circle, transparent 56%, black 57%);
  mask: radial-gradient(circle, transparent 56%, black 57%);
  animation: spin 0.9s linear infinite;
}

/* ====== 骨架屏演示迷你版 ====== */
.skel-demo {
  width: 32px; height: 10px;
  border-radius: 4px;
  background: var(--surface-muted);
  position: relative; overflow: hidden;
}
.skel-demo::after {
  content: '';
  position: absolute; inset: 0;
  background: linear-gradient(90deg, transparent, var(--surface-elevated, var(--surface)), transparent);
  animation: shimmer 1.5s infinite;
}
.skel-pop-enter-active, .skel-pop-leave-active {
  transition: opacity 0.25s ease;
}
.skel-pop-enter-from, .skel-pop-leave-to { opacity: 0; }

/* ====== 轨道环绕演示迷你版 ====== */
.orbit-demo {
  position: relative;
  width: 32px; height: 32px;
}
.orbit-c {
  position: absolute; top: 50%; left: 50%;
  width: 8px; height: 8px;
  margin: -4px 0 0 -4px;
  border-radius: 50%;
  background: var(--brand);
}
.orbit-d {
  position: absolute; top: 0; left: 50%;
  width: 5px; height: 5px;
  margin-left: -2.5px;
  border-radius: 50%;
  background: var(--accent);
  transform-origin: 2.5px 16px;
  animation: spin 1.2s linear infinite;
}

/* ====== 打字光标演示 ====== */
.typing-demo { font-family: var(--font-mono); font-size: 16px; color: var(--brand); }
.cursor-blink { animation: blink-cursor 0.8s steps(2) infinite; }

@keyframes spin { to { transform: rotate(360deg); } }
@keyframes shimmer { 100% { transform: translateX(100%); } }
@keyframes blink-cursor { 50% { opacity: 0; } }

/* ====== 常见参考动画 ====== */
.ref-spinner {
  width: 28px; height: 28px;
  border: 3px solid var(--surface-muted);
  border-top-color: var(--brand);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
.ref-dual-ring {
  width: 30px; height: 30px;
  border-radius: 50%;
  border: 3px solid transparent;
  border-top-color: var(--brand);
  border-right-color: var(--brand);
  animation: spin 0.7s linear infinite;
  position: relative;
}
.ref-dual-ring::after {
  content: '';
  position: absolute; inset: 4px;
  border: 3px solid transparent;
  border-bottom-color: var(--accent);
  border-left-color: var(--accent);
  border-radius: 50%;
  animation: spin 1.1s linear infinite reverse;
}
.ref-dots-bounce { display: flex; gap: 4px; }
.ref-dots-bounce span {
  width: 8px; height: 8px; border-radius: 50%;
  background: var(--brand);
  animation: ref-bounce 0.6s ease-in-out infinite alternate;
}
.ref-dots-bounce span:nth-child(2) { animation-delay: 0.2s; background: var(--accent); }
.ref-dots-bounce span:nth-child(3) { animation-delay: 0.4s; }
@keyframes ref-bounce { to { transform: translateY(-8px); opacity: 0.4; } }

.ref-dots-pulse { display: flex; gap: 5px; }
.ref-dots-pulse span {
  width: 9px; height: 9px; border-radius: 50%;
  background: var(--brand);
  animation: ref-pulse 1.2s ease-in-out infinite;
}
.ref-dots-pulse span:nth-child(2) { animation-delay: 0.2s; }
.ref-dots-pulse span:nth-child(3) { animation-delay: 0.4s; }
@keyframes ref-pulse {
  0%, 80%, 100% { transform: scale(0.5); opacity: 0.3; }
  40% { transform: scale(1.1); opacity: 1; }
}

.ref-bar-track {
  width: 80px; height: 5px;
  background: var(--surface-muted);
  border-radius: 3px; overflow: hidden;
}
.ref-bar-fill {
  width: 35%; height: 100%;
  background: linear-gradient(90deg, var(--brand), var(--accent));
  border-radius: 3px;
  animation: ref-bar-slide 1.4s ease-in-out infinite;
}
@keyframes ref-bar-slide {
  0% { margin-left: -40%; }
  100% { margin-left: 100%; }
}

.ref-wave { display: flex; gap: 2px; align-items: center; height: 28px; }
.ref-wave span {
  width: 3px; height: 12px;
  background: var(--brand);
  border-radius: 2px;
  animation: ref-wave 1s ease-in-out infinite;
}
.ref-wave span:nth-child(1) { animation-delay: 0s; }
.ref-wave span:nth-child(2) { animation-delay: 0.1s; }
.ref-wave span:nth-child(3) { animation-delay: 0.2s; }
.ref-wave span:nth-child(4) { animation-delay: 0.3s; }
.ref-wave span:nth-child(5) { animation-delay: 0.4s; }
@keyframes ref-wave {
  0%, 100% { height: 6px; }
  50% { height: 22px; }
}

.ref-heartbeat {
  width: 24px; height: 24px;
  border-radius: 50%;
  background: var(--brand);
  animation: ref-heartbeat 1.2s ease-in-out infinite;
}
@keyframes ref-heartbeat {
  0%, 100% { transform: scale(0.7); opacity: 0.4; }
  50% { transform: scale(1); opacity: 1; }
}

.ref-cube {
  width: 20px; height: 20px;
  background: var(--brand);
  border-radius: 4px;
  animation: ref-cube 1s ease-in-out infinite;
}
@keyframes ref-cube {
  0% { transform: rotate(0deg); }
  50% { transform: rotate(180deg) scale(0.8); background: var(--accent); }
  100% { transform: rotate(360deg); }
}

.ref-skel-row { display: flex; flex-direction: column; gap: 4px; width: 80px; }
.ref-skel {
  height: 6px; width: 100%;
  border-radius: 3px;
  background: var(--surface-muted);
  position: relative; overflow: hidden;
}
.ref-skel::after {
  content: '';
  position: absolute; inset: 0;
  background: linear-gradient(90deg, transparent, var(--surface-elevated, var(--surface)), transparent);
  animation: shimmer 1.5s infinite;
}

.ref-blink-cursor {
  font-family: var(--font-mono);
  font-size: 20px;
  color: var(--brand);
  animation: blink-cursor 0.8s steps(2) infinite;
}

.ref-butterfly { display: flex; gap: 2px; }
.ref-butterfly span {
  width: 9px; height: 20px;
  background: var(--brand);
  border-radius: 50% 50% 50% 0;
}
.ref-butterfly span:first-child {
  animation: ref-flap-l 0.6s ease-in-out infinite;
  transform-origin: bottom right;
}
.ref-butterfly span:last-child {
  animation: ref-flap-r 0.6s ease-in-out infinite;
  transform-origin: bottom left;
  border-radius: 50% 50% 0 50%;
  background: var(--accent);
}
@keyframes ref-flap-l { 50% { transform: rotateY(70deg); } }
@keyframes ref-flap-r { 50% { transform: rotateY(-70deg); } }
</style>
