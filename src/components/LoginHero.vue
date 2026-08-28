<script setup lang="ts">
/**
 * 登录页左侧动画 Hero 区
 *
 * 交互说明（通过 props/事件 与 LoginPage 联动）：
 *   · props.focusField: 'username' | 'password' | null  → 控制角色遮眼/看输入框
 *   · props.passwordLen: number                         → 密码长度变化时增强遮眼效果
 *   · mouseover hero 区域 → 角色轻微浮动
 *   · 鼠标在 hero 区移动 → 所有瞳孔跟踪鼠标
 *   · 入场 → GSAP stagger 角色进场
 */
import { ref, onMounted, onUnmounted, computed, watch } from 'vue';
import gsap from 'gsap';

const props = defineProps<{
  /** 当前聚焦的输入框（null=无焦点） */
  focusField?: 'username' | 'password' | null;
  /** 密码长度（触发不同强度遮眼效果） */
  passwordLen?: number;
}>();

/* ---------- Refs ---------- */
const heroRef = ref<HTMLElement | null>(null);

// 4 个角色（从后到前、从左到右排列）
const rolePurple = ref<HTMLElement | null>(null);   // 后排左：紫色方块
const roleDark = ref<HTMLElement | null>(null);     // 后排右：深灰长条
const roleYellow = ref<HTMLElement | null>(null);   // 前排右：黄色胶囊
const roleOrange = ref<HTMLElement | null>(null);   // 最前：橙色半圆（主角，会遮眼）

// 每个角色的瞳孔
const pupils = ref<HTMLElement[]>([]);
function registerPupil(el: HTMLElement | null) {
  if (el && !pupils.value.includes(el)) pupils.value.push(el);
}

// 主角的手（遮眼用）
const handLeft = ref<HTMLElement | null>(null);
const handRight = ref<HTMLElement | null>(null);

// 光点背景
const dots = ref<HTMLElement[]>([]);
function registerDot(el: HTMLElement | null) {
  if (el) dots.value.push(el);
}

/* ---------- 计算属性 ---------- */

/** 是否遮眼：聚焦密码框 且 密码长度>=1 → 遮眼更紧；只有聚焦 → 轻遮 */
const shouldCoverEyes = computed(() => {
  if (props.focusField !== 'password') return false;
  return true;
});
const coverIntensity = computed(() => {
  if (!shouldCoverEyes.value) return 0;
  const len = props.passwordLen ?? 0;
  if (len === 0) return 0.5; // 只聚焦没输入：半遮
  return Math.min(1, 0.6 + len * 0.05); // 输入越多，遮得越紧（最多1）
});

/* ---------- GSAP 生命周期 ---------- */

let mouseMoveCleanup: (() => void) | null = null;
let enterCleanup: (() => void) | null = null;
let leaveCleanup: (() => void) | null = null;

onMounted(() => {
  /* ===== 入场：stagger 弹跳 ===== */
  const roles = [
    rolePurple.value,
    roleDark.value,
    roleYellow.value,
    roleOrange.value,
  ].filter(Boolean) as HTMLElement[];
  gsap.fromTo(
    roles,
    { y: 60, opacity: 0, scale: 0.85 },
    {
      y: 0,
      opacity: 1,
      scale: 1,
      duration: 0.9,
      stagger: 0.12,
      ease: 'back.out(1.6)',
    },
  );

  // 先初始化瞳孔的原始 transform
  pupils.value.forEach((p) => {
    gsap.set(p, { x: 0, y: 0 });
  });

  /* ===== 光点持续浮动 ===== */
  dots.value.forEach((d, i) => {
    gsap.to(d, {
      y: 'random(-20, 20)',
      x: 'random(-10, 10)',
      opacity: 'random(0.2, 0.6)',
      duration: `random(3, 6)`,
      repeat: -1,
      yoyo: true,
      ease: 'sine.inOut',
      delay: i * 0.2,
    });
  });

  /* ===== 角色持续呼吸（轻微上下浮动） ===== */
  [roleOrange.value, roleYellow.value, rolePurple.value, roleDark.value].forEach(
    (el, i) => {
      if (!el) return;
      gsap.to(el, {
        y: i % 2 === 0 ? '-=6' : '+=6',
        duration: 2.2 + i * 0.3,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut',
        delay: i * 0.15,
      });
    },
  );

  /* ===== 鼠标进入 hero 区 → 角色轻微倾斜欢迎 ===== */
  const onEnter = () => {
    roles.forEach((el, i) => {
      gsap.to(el, {
        rotate: i % 2 === 0 ? -1.5 : 1.5,
        scale: 1.02,
        duration: 0.4,
        ease: 'power2.out',
      });
    });
  };
  const onLeave = () => {
    roles.forEach((el) => {
      gsap.to(el, {
        rotate: 0,
        scale: 1,
        duration: 0.5,
        ease: 'elastic.out(1, 0.5)',
      });
    });
  };
  heroRef.value?.addEventListener('mouseenter', onEnter);
  heroRef.value?.addEventListener('mouseleave', onLeave);
  enterCleanup = () => heroRef.value?.removeEventListener('mouseenter', onEnter);
  leaveCleanup = () => heroRef.value?.removeEventListener('mouseleave', onLeave);

  /* ===== 瞳孔跟随鼠标 ===== */
  const onMouse = (e: MouseEvent) => {
    const rect = heroRef.value?.getBoundingClientRect();
    if (!rect) return;

    // 归一化 -1 ~ 1
    const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const ny = ((e.clientY - rect.top) / rect.height) * 2 - 1;
    // 瞳孔最大偏移 px
    const max = 4;
    pupils.value.forEach((p) => {
      gsap.to(p, {
        x: nx * max,
        y: ny * max,
        duration: 0.18,
        ease: 'power1.out',
        overwrite: true,
      });
    });
  };
  window.addEventListener('mousemove', onMouse);
  mouseMoveCleanup = () => window.removeEventListener('mousemove', onMouse);
});

onUnmounted(() => {
  mouseMoveCleanup?.();
  enterCleanup?.();
  leaveCleanup?.();
  // 清所有 GSAP 动画
  [rolePurple.value, roleDark.value, roleYellow.value, roleOrange.value].forEach(
    (el) => el && gsap.killTweensOf(el),
  );
  pupils.value.forEach((el) => gsap.killTweensOf(el));
  dots.value.forEach((el) => gsap.killTweensOf(el));
  if (handLeft.value) gsap.killTweensOf(handLeft.value);
  if (handRight.value) gsap.killTweensOf(handRight.value);
});

/* ---------- 监听遮眼 ---------- */
watch(coverIntensity, (v) => {
  // 手从下方（原始位置）抬到眼睛高度
  // y 轴：0 = 放下；负数 = 抬起来遮挡
  // v=0 → y=80（放下）；v=1 → y=-20（完全遮住）
  const yL = 80 - v * 100;
  const yR = 80 - v * 100;
  const rotateL = -v * 15;
  const rotateR = v * 15;
  if (handLeft.value) {
    gsap.to(handLeft.value, {
      y: yL,
      rotate: rotateL,
      duration: 0.45,
      ease: 'power2.out',
    });
  }
  if (handRight.value) {
    gsap.to(handRight.value, {
      y: yR,
      rotate: rotateR,
      duration: 0.45,
      ease: 'power2.out',
    });
  }
}, { immediate: true });

/* ---------- 用户名聚焦时：黄色胶囊角色跳一下表示"在听" ---------- */
watch(
  () => props.focusField,
  (f) => {
    if (f === 'username') {
      if (roleYellow.value) {
        gsap.to(roleYellow.value, {
          y: '-=14',
          duration: 0.22,
          ease: 'power2.out',
          yoyo: true,
          repeat: 2,
        });
      }
    }
  },
);
</script>

<template>
  <div
    ref="heroRef"
    class="relative flex h-full w-full items-end justify-center overflow-hidden"
  >
    <!-- 渐变背景 -->
    <div class="absolute inset-0 bg-gradient-to-br from-purple-50 via-violet-50 to-indigo-50 dark:from-indigo-950 dark:via-purple-950 dark:to-slate-950" />

    <!-- 装饰光斑 -->
    <div class="pointer-events-none absolute -left-16 -top-16 size-72 rounded-full bg-purple-300/40 blur-3xl dark:bg-purple-700/30" />
    <div class="pointer-events-none absolute -bottom-16 right-0 size-80 rounded-full bg-indigo-300/30 blur-3xl dark:bg-indigo-800/30" />
    <div class="pointer-events-none absolute left-1/2 top-1/3 size-56 -translate-x-1/2 rounded-full bg-violet-300/25 blur-3xl dark:bg-violet-700/20" />

    <!-- 浮动光点 -->
    <div
      v-for="i in 18"
      :key="i"
      :ref="registerDot"
      class="pointer-events-none absolute size-2 rounded-full bg-purple-400/70 dark:bg-purple-300/60"
      :style="{
        left: `${(i * 53) % 100}%`,
        top: `${(i * 37) % 100}%`,
        opacity: 0.3 + (i % 3) * 0.15,
        transform: `scale(${0.7 + (i % 4) * 0.25})`,
      }"
    />

    <!-- 顶部 LOGO / 品牌文字 -->
    <div class="absolute left-10 top-10 flex items-center gap-3">
      <div class="flex size-11 items-center justify-center rounded-2xl bg-brand shadow-lg shadow-brand/30 text-white">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 2l2.39 7.36H22l-6.2 4.5L18.18 22 12 17.27 5.82 22l2.38-8.14L2 9.36h7.61z"/>
        </svg>
      </div>
      <div>
        <div class="text-lg font-bold tracking-tight text-slate-800 dark:text-white">
          Trae · 个人作品集
        </div>
        <div class="text-xs text-slate-500 dark:text-slate-300">欢迎回来，开启创作之旅</div>
      </div>
    </div>

    <!-- 角色组合（绝对定位，从后往前叠） -->
    <div class="relative mb-24 h-[380px] w-[460px] shrink-0">
      <!-- 角色 1：紫色方块（后排左） -->
      <div
        ref="rolePurple"
        class="absolute left-4 top-0"
        style="width: 140px; height: 220px; opacity: 0;"
      >
        <div class="size-full rounded-[32px] bg-gradient-to-b from-purple-500 to-purple-700 shadow-2xl shadow-purple-500/40">
          <!-- 眼睛 -->
          <div class="absolute left-6 top-14 size-7 rounded-full bg-white">
            <div :ref="registerPupil" class="absolute left-2 top-2 size-3 rounded-full bg-slate-900" />
            <div class="absolute left-2.5 top-2 size-1 rounded-full bg-white" />
          </div>
          <div class="absolute right-6 top-14 size-7 rounded-full bg-white">
            <div :ref="registerPupil" class="absolute left-2 top-2 size-3 rounded-full bg-slate-900" />
            <div class="absolute left-2.5 top-2 size-1 rounded-full bg-white" />
          </div>
          <!-- 微笑 -->
          <div class="absolute left-1/2 top-28 h-3 w-10 -translate-x-1/2 rounded-b-full border-b-4 border-white/90" />
        </div>
      </div>

      <!-- 角色 2：深灰长条（后排右） -->
      <div
        ref="roleDark"
        class="absolute right-6 top-4"
        style="width: 108px; height: 260px; opacity: 0;"
      >
        <div class="size-full rounded-[28px] bg-gradient-to-b from-slate-700 to-slate-900 shadow-2xl shadow-slate-700/40">
          <!-- 眼睛 -->
          <div class="absolute left-5 top-16 size-6 rounded-full bg-white">
            <div :ref="registerPupil" class="absolute left-1.5 top-1.5 size-3 rounded-full bg-slate-900" />
          </div>
          <div class="absolute right-5 top-16 size-6 rounded-full bg-white">
            <div :ref="registerPupil" class="absolute left-1.5 top-1.5 size-3 rounded-full bg-slate-900" />
          </div>
          <!-- 横线嘴（严肃脸） -->
          <div class="absolute left-1/2 top-32 h-1 w-7 -translate-x-1/2 rounded-full bg-white/90" />
        </div>
      </div>

      <!-- 角色 3：黄色胶囊（前排右） -->
      <div
        ref="roleYellow"
        class="absolute bottom-4 right-0"
        style="width: 112px; height: 200px; opacity: 0;"
      >
        <div class="size-full rounded-[56px] bg-gradient-to-b from-yellow-300 to-yellow-500 shadow-2xl shadow-yellow-400/40">
          <!-- 眼睛（小圆点） -->
          <div class="absolute left-7 top-14 size-3 rounded-full bg-slate-900">
            <div :ref="registerPupil" class="size-full" />
          </div>
          <div class="absolute right-7 top-14 size-3 rounded-full bg-slate-900">
            <div :ref="registerPupil" class="size-full" />
          </div>
          <!-- 扁平嘴 -->
          <div class="absolute left-1/2 top-24 h-1.5 w-6 -translate-x-1/2 rounded-full bg-slate-800" />
          <!-- 腮红 -->
          <div class="absolute left-2 top-20 size-4 rounded-full bg-orange-400/50 blur-[2px]" />
          <div class="absolute right-2 top-20 size-4 rounded-full bg-orange-400/50 blur-[2px]" />
        </div>
      </div>

      <!-- 角色 4：橙色半圆（最前主角，带手和遮眼） -->
      <div
        ref="roleOrange"
        class="absolute bottom-0 left-0"
        style="width: 200px; height: 200px; opacity: 0;"
      >
        <!-- 身体（半圆） -->
        <div class="absolute inset-x-0 top-0 h-full rounded-t-full rounded-b-[60px] bg-gradient-to-b from-orange-400 via-orange-500 to-red-500 shadow-2xl shadow-orange-500/40">
          <!-- 眼睛（大） -->
          <div class="absolute left-10 top-16 size-9 rounded-full bg-white shadow-inner">
            <div :ref="registerPupil" class="absolute left-2.5 top-2.5 size-4 rounded-full bg-slate-900" />
            <div class="absolute left-3.5 top-3 size-1.5 rounded-full bg-white" />
          </div>
          <div class="absolute right-10 top-16 size-9 rounded-full bg-white shadow-inner">
            <div :ref="registerPupil" class="absolute left-2.5 top-2.5 size-4 rounded-full bg-slate-900" />
            <div class="absolute left-3.5 top-3 size-1.5 rounded-full bg-white" />
          </div>
          <!-- 微笑 -->
          <div class="absolute left-1/2 top-[96px] h-3.5 w-12 -translate-x-1/2 rounded-b-full border-b-[3px] border-slate-900/80" />
          <!-- 腮红 -->
          <div class="absolute left-4 top-[78px] size-5 rounded-full bg-red-500/50 blur-[2px]" />
          <div class="absolute right-4 top-[78px] size-5 rounded-full bg-red-500/50 blur-[2px]" />
        </div>

        <!-- 手（左手）：默认 y=80 藏在底部，遮眼时 y=-20 抬起 -->
        <div
          ref="handLeft"
          class="absolute left-8 top-[72px] size-10 rounded-full bg-orange-600 shadow-md ring-2 ring-orange-400/40"
          style="transform: translateY(80px);"
        >
          <div class="absolute inset-1 rounded-full bg-orange-500" />
        </div>
        <!-- 手（右手） -->
        <div
          ref="handRight"
          class="absolute right-8 top-[72px] size-10 rounded-full bg-orange-600 shadow-md ring-2 ring-orange-400/40"
          style="transform: translateY(80px);"
        >
          <div class="absolute inset-1 rounded-full bg-orange-500" />
        </div>
      </div>
    </div>

    <!-- 底部小字 -->
    <div class="absolute bottom-8 left-10 right-10 flex items-center justify-between text-xs text-slate-500/80 dark:text-slate-300/70">
      <span>© 2026 TE-Fire · All rights reserved</span>
      <span class="flex items-center gap-1">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s-8-4.5-8-11.8A8 8 0 0112 2a8 8 0 018 8.2c0 7.3-8 11.8-8 11.8z"/><circle cx="12" cy="10" r="3"/></svg>
        Made with love in China
      </span>
    </div>
  </div>
</template>
