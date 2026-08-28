<script setup lang="ts">
/**
 * 滑块验证码组件（v2 · 修复版）
 *
 * 修复内容：
 *   1. mousemove/mouseup 绑定到 window，避免鼠标快速移动丢帧
 *   2. 拼图块 top 使用后端返回的 puzzleY，和缺口保持同一水平线
 *   3. onUnmounted 清理全局事件监听，防止内存泄漏
 *
 * 功能：
 *   · 从后端获取验证码图片（背景图 + 拼图块）
 *   · 用户拖动底部滑轨的滑块 → 拼图块同步水平移动
 *   · 松开时 emit('success', { captchaId, slideX })，父组件提交后端校验
 *   · 父组件调用 markSuccess() / markFail() 反馈校验结果
 */
import { ref, onMounted, onUnmounted } from 'vue';
import { RefreshCw } from 'lucide-vue-next';
import { request } from '@/lib/axios';
import type { CaptchaResponse } from '@/lib/api-types';

const emit = defineEmits<{
  /** 验证码拖拽完成，等待父组件提交给后端校验 */
  (e: 'success', payload: { captchaId: string; slideX: number }): void;
  /** 验证码加载失败或用户取消（父组件无需额外处理，预留） */
  (e: 'fail'): void;
}>();

/* ---------- 状态 ---------- */
const loading = ref(true);
const error = ref('');
const captcha = ref<CaptchaResponse | null>(null);

// 滑块拖拽状态
const isDragging = ref(false);
const sliderLeft = ref(0);       // 滑块（和拼图块）当前 x 位置（px）
const startClientX = ref(0);     // mousedown 时鼠标的 clientX
const startSliderLeft = ref(0);  // mousedown 时滑块已有的偏移量
const maxSlide = ref(0);         // 最大可拖动距离 = 画布宽 - 拼图块尺寸

// 容器尺寸
const canvasW = ref(300);
const canvasH = ref(180);
const puzzleSize = ref(48);
const puzzleY = ref(0);          // 拼图块 Y 坐标（来自后端，对齐缺口）

// 状态文字
const statusText = ref('拖动滑块完成验证');
const statusColor = ref<'default' | 'success' | 'error'>('default');

/* ---------- 生命周期 ---------- */
onMounted(async () => {
  // 全局事件绑定：只有 mousedown 时才激活 move/up
  window.addEventListener('mousemove', onWindowMouseMove);
  window.addEventListener('mouseup', onWindowMouseUp);
  window.addEventListener('touchmove', onWindowTouchMove, { passive: false });
  window.addEventListener('touchend', onWindowTouchEnd);
  await refresh();
});

onUnmounted(() => {
  window.removeEventListener('mousemove', onWindowMouseMove);
  window.removeEventListener('mouseup', onWindowMouseUp);
  window.removeEventListener('touchmove', onWindowTouchMove);
  window.removeEventListener('touchend', onWindowTouchEnd);
});

/* ---------- 方法 ---------- */

/** 从后端获取验证码 */
async function refresh() {
  loading.value = true;
  error.value = '';
  statusText.value = '拖动滑块完成验证';
  statusColor.value = 'default';
  sliderLeft.value = 0;

  try {
    const data = await request<CaptchaResponse>({
      method: 'GET',
      url: '/auth/captcha',
    });
    captcha.value = data;
    canvasW.value = data.canvasWidth;
    canvasH.value = data.canvasHeight;
    puzzleSize.value = data.puzzleSize;
    puzzleY.value = data.puzzleY;
    // 滑轨宽 ≈ 画布宽，滑块 size-8=32px → maxSlide = 画布宽 - 滑块宽
    // 但拼图块要移动的距离其实是 canvasW - puzzleSize
    // 两者都用 canvasW - puzzleSize，确保 1:1 对应
    maxSlide.value = canvasW.value - puzzleSize.value;
  } catch (e: any) {
    error.value = e?.message || '验证码加载失败';
  } finally {
    loading.value = false;
  }
}

/* ===== 拖动事件（全局绑定，避免鼠标丢帧） ===== */

/** 鼠标/触摸按下（绑在滑块按钮上） */
function onDragStart(e: MouseEvent | TouchEvent) {
  if (loading.value || statusColor.value === 'success') return;
  e.preventDefault?.();
  isDragging.value = true;
  startClientX.value = 'touches' in e ? e.touches[0].clientX : e.clientX;
  startSliderLeft.value = sliderLeft.value;
  statusText.value = '拖动中…';
  statusColor.value = 'default';
}

/** 全局 mousemove */
function onWindowMouseMove(e: MouseEvent) {
  if (!isDragging.value) return;
  applyDragDelta(e.clientX);
}

/** 全局 touchmove */
function onWindowTouchMove(e: TouchEvent) {
  if (!isDragging.value) return;
  e.preventDefault?.();
  applyDragDelta(e.touches[0].clientX);
}

/** 计算偏移并更新滑块位置 */
function applyDragDelta(currentClientX: number) {
  const delta = currentClientX - startClientX.value;
  // 叠加 mousedown 时已有偏移，防止中途松手再按会重置
  const next = startSliderLeft.value + delta;
  sliderLeft.value = Math.max(0, Math.min(next, maxSlide.value));
}

/** 全局 mouseup */
function onWindowMouseUp() {
  finishDrag();
}

/** 全局 touchend */
function onWindowTouchEnd() {
  finishDrag();
}

/** 松开收尾 */
function finishDrag() {
  if (!isDragging.value) return;
  isDragging.value = false;

  if (!captcha.value) return;

  // 没拖够距离 → 归位
  if (sliderLeft.value < 10) {
    statusText.value = '请拖动滑块完成验证';
    sliderLeft.value = 0;
    return;
  }

  // 通知父组件提交校验
  emit('success', {
    captchaId: captcha.value.captchaId,
    slideX: Math.round(sliderLeft.value),
  });

  statusText.value = '校验中…';
}

/* ===== 父组件调用的反馈方法 ===== */

/** 校验成功 */
function markSuccess() {
  statusText.value = '✓ 验证通过';
  statusColor.value = 'success';
}

/** 校验失败 → 归位 + 刷新 */
async function markFail() {
  statusText.value = '✗ 验证失败，请重试';
  statusColor.value = 'error';
  setTimeout(async () => {
    sliderLeft.value = 0;
    statusText.value = '拖动滑块完成验证';
    statusColor.value = 'default';
    await refresh();
  }, 800);
}

defineExpose({ markSuccess, markFail, refresh });
</script>

<template>
  <div
    class="w-full select-none"
    :style="{ maxWidth: `${canvasW}px` }"
  >
    <!-- 加载中 -->
    <div
      v-if="loading"
      class="flex items-center justify-center rounded-lg bg-surface-muted/40"
      :style="{ width: `${canvasW}px`, height: `${canvasH + 48}px` }"
    >
      <div class="size-6 animate-spin rounded-full border-2 border-brand border-t-transparent" />
    </div>

    <!-- 加载失败 -->
    <div
      v-else-if="error"
      class="flex flex-col items-center justify-center gap-2 rounded-lg bg-danger/10"
      :style="{ width: `${canvasW}px`, height: `${canvasH + 48}px` }"
    >
      <span class="text-sm text-danger">{{ error }}</span>
      <button
        class="rounded-md bg-brand/10 px-3 py-1 text-xs text-brand hover:bg-brand/20"
        @click="refresh"
      >
        重试
      </button>
    </div>

    <!-- 验证码区域 -->
    <div v-else-if="captcha" class="relative">
      <!-- 背景图（带缺口阴影） -->
      <div class="relative overflow-hidden rounded-lg border border-border/60 shadow-sm">
        <img
          :src="captcha.bgImage"
          :width="canvasW"
          :height="canvasH"
          class="block"
          alt="captcha background"
          draggable="false"
        />
        <!-- 拼图块：从左边缘出发，top 对齐缺口的 puzzleY，translateX 跟随滑块 -->
        <img
          :src="captcha.puzzleImage"
          :width="puzzleSize"
          :height="puzzleSize"
          class="absolute left-0 drop-shadow-[0_0_4px_rgba(0,0,0,0.5)]"
          :style="{
            top: `${puzzleY}px`,
            transform: `translateX(${sliderLeft}px)`,
          }"
          alt="puzzle"
          draggable="false"
        />
      </div>

      <!-- 滑轨（宽 = 画布宽） -->
      <div
        class="relative mt-2 flex h-10 items-center overflow-hidden rounded-lg border border-border/60 bg-surface-muted/30"
        :style="{ width: `${canvasW}px` }"
      >
        <!-- 已滑过的进度条 -->
        <div
          class="pointer-events-none absolute inset-y-0 left-0 rounded-l-lg transition-colors"
          :class="{
            'bg-brand/15': statusColor === 'default',
            'bg-green-500/20': statusColor === 'success',
            'bg-danger/20': statusColor === 'error',
          }"
          :style="{ width: `${sliderLeft + 32}px` }"
        />

        <!-- 状态文字 -->
        <span
          class="pointer-events-none absolute left-1/2 -translate-x-1/2 text-xs font-medium"
          :class="{
            'text-text-muted': statusColor === 'default',
            'text-green-600': statusColor === 'success',
            'text-danger': statusColor === 'error',
          }"
        >
          {{ statusText }}
        </span>

        <!-- 滑块按钮（点击 + 拖动） -->
        <div
          class="absolute left-0 top-1 flex size-8 cursor-grab items-center justify-center rounded-md shadow-md transition-colors active:cursor-grabbing"
          :class="{
            'bg-brand text-white': statusColor === 'default',
            'bg-green-500 text-white': statusColor === 'success',
            'bg-danger text-white': statusColor === 'error',
          }"
          :style="{ transform: `translateX(${sliderLeft}px)` }"
          @mousedown="onDragStart"
          @touchstart.prevent="onDragStart"
        >
          <span class="text-sm tracking-tight">⋮⋮</span>
        </div>
      </div>

      <!-- 刷新按钮 -->
      <button
        class="absolute -top-2 -right-2 flex size-7 items-center justify-center rounded-full bg-surface/95 text-text-muted shadow-md ring-1 ring-border/40 hover:text-brand"
        @click="refresh"
        aria-label="刷新验证码"
      >
        <RefreshCw class="size-4" />
      </button>
    </div>
  </div>
</template>
