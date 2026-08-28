<script setup lang="ts">
/**
 * 登录页左侧动画 Hero 区（v2 · 底部对齐横排布局）
 *
 * 布局（参照用户提供的效果图）：
 *   · 4 个角色 底部对齐，横向排成一排
 *   · 从左 → 右顺序：紫方块 → 橙半圆 → 黑长条 → 黄胶囊
 *   · 高低错落（紫最高，黑次高，黄中矮，橙最矮）但 底部基线齐平
 *   · 角色之间负 margin 形成前后遮挡层次（紫压橙、黑压黄）
 *
 * 交互：
 *   · props.focusField: 'username'|'password'|null → 控制角色遮眼/看输入框
 *   · props.passwordLen: number → 密码长度变化 → 遮眼强度
 *   · 鼠标在 hero 区移动 → 所有瞳孔跟踪鼠标
 *   · mouseenter hero → 角色轻微倾斜欢迎
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

// 4 个角色（从左到右）
const rolePurple = ref<HTMLElement | null>(null); // 左1：紫色方块（最高，后排）
const roleOrange = ref<HTMLElement | null>(null); // 左2：橙色半圆（最矮，最前）
const roleDark = ref<HTMLElement | null>(null);   // 右2：深灰长条（次高，后排）
const roleYellow = ref<HTMLElement | null>(null); // 右1：黄色胶囊（中矮，前排）

// 每个角色的瞳孔
const pupils = ref<HTMLElement[]>([]);
function registerPupil(el: HTMLElement | null) {
  if (el && !pupils.value.includes(el)) pupils.value.push(el);
}

// 主角（橙半圆）的手（遮眼用）
const handLeft = ref<HTMLElement | null>(null);
const handRight = ref<HTMLElement | null>(null);

// 光点背景
const dots = ref<HTMLElement[]>([]);
function registerDot(el: HTMLElement | null) {
  if (el) dots.value.push(el);
}

/* ---------- 计算属性 ---------- */
const shouldCoverEyes = computed(() => props.focusField === 'password');
const coverIntensity = computed(() => {
  if (!shouldCoverEyes.value) return 0;
  const len = props.passwordLen ?? 0;
  if (len === 0) return 0.5;
  return Math.min(1, 0.6 + len * 0.05); // 输入越多，遮得越紧
});

/* ---------- GSAP 生命周期 ---------- */
let mouseMoveCleanup: (() => void) | null = null;
let enterCleanup: (() => void) | null = null;
let leaveCleanup: (() => void) | null = null;

onMounted(() => {
  // 入场：stagger 弹跳
  const roles = [
    rolePurple.value,
    roleOrange.value,
    roleDark.value,
    roleYellow.value,
  ].filter(Boolean) as HTMLElement[];
  gsap.fromTo(
    roles,
    { y: 80, opacity: 0, scale: 0.85 },
    {
      y: 0,
      opacity: 1,
      scale: 1,
      duration: 0.9,
      stagger: 0.1,
      ease: 'back.out(1.5)',
    },
  );

  // 瞳孔初始值
  pupils.value.forEach((p) => gsap.set(p, { x: 0, y: 0 }));

  // 光点持续浮动
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

  // 角色持续呼吸浮动（轻微上下）
  roles.forEach((el, i) => {
    gsap.to(el, {
      y: i % 2 === 0 ? '-=5' : '+=5',
      duration: 2.2 + i * 0.25,
      repeat: -1,
      yoyo: true,
      ease: 'sine.inOut',
      delay: i * 0.15,
    });
  });

  // mouseenter：角色欢迎倾斜
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

  // 瞳孔跟随鼠标（全局）
  const onMouse = (e: MouseEvent) => {
    const rect = heroRef.value?.getBoundingClientRect();
    if (!rect) return;
    const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const ny = ((e.clientY - rect.top) / rect.height) * 2 - 1;
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
  [rolePurple.value, roleOrange.value, roleDark.value, roleYellow.value].forEach(
    (el) => el && gsap.killTweensOf(el),
  );
  pupils.value.forEach((el) => gsap.killTweensOf(el));
  dots.value.forEach((el) => gsap.killTweensOf(el));
  if (handLeft.value) gsap.killTweensOf(handLeft.value);
  if (handRight.value) gsap.killTweensOf(handRight.value);
});

/* ---------- 监听遮眼 ---------- */
watch(coverIntensity, (v) => {
  // v=0 → y=80（放下）；v=1 → y=-20（完全遮住）
  const y = 80 - v * 100;
  const rotateL = -v * 15;
  const rotateR = v * 15;
  if (handLeft.value) {
    gsap.to(handLeft.value, {
      y,
      rotate: rotateL,
      duration: 0.45,
      ease: 'power2.out',
    });
  }
  if (handRight.value) {
    gsap.to(handRight.value, {
      y,
      rotate: rotateR,
      duration: 0.45,
      ease: 'power2.out',
    });
  }
}, { immediate: true });

/* ---------- 用户名聚焦时：黄色胶囊角色跳一下表示在听 ---------- */
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
    class="relative flex h-full w-full flex-col items-center justify-end overflow-hidden"
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

    <!--
      角色行：底部对齐(flex items-end)，横向居中，
      顺序：紫（最高，左）→ 橙（最矮，左2）→ 黑（次高，右2）→ 黄（中矮，右1）
      用负 margin 叠加前后景，角色底部都对齐 flex 容器底线（齐平）
    -->
    <div class="relative z-10 flex w-full items-end justify-center pb-24">
      <div class="flex items-end justify-center gap-0" style="width: 520px;">
        <!-- 角色 1：紫色方块（最高，左，稍微叠在橙色后方） -->
        <div
          ref="rolePurple"
          class="shrink-0"
          style="width: 150px; height: 240px; margin-right: -24px; opacity: 0; z-index: 1;"
        >
          <div class="size-full rounded-[34px] bg-gradient-to-b from-purple-500 to-purple-700 shadow-2xl shadow-purple-500/40">
            <!-- 眼睛 -->
            <div class="absolute left-6 top-16 size-8 rounded-full bg-white">
              <div :ref="registerPupil" class="absolute left-2.5 top-2.5 size-3.5 rounded-full bg-slate-900" />
              <div class="absolute left-3.5 top-3 size-1.5 rounded-full bg-white" />
            </div>
            <div class="absolute right-6 top-16 size-8 rounded-full bg-white">
              <div :ref="registerPupil" class="absolute left-2.5 top-2.5 size-3.5 rounded-full bg-slate-900" />
              <div class="absolute left-3.5 top-3 size-1.5 rounded-full bg-white" />
            </div>
            <!-- 微笑 -->
            <div class="absolute left-1/2 top-[132px] h-3.5 w-11 -translate-x-1/2 rounded-b-full border-b-[3px] border-white/90" />
          </div>
        </div>

        <!-- 角色 2：橙色半圆（最矮，左2，最前景） -->
        <div
          ref="roleOrange"
          class="shrink-0 relative"
          style="width: 210px; height: 150px; opacity: 0; z-index: 3;"
        >
          <!-- 身体（半圆） -->
          <div class="absolute inset-x-0 bottom-0 h-[140px] rounded-t-full rounded-b-[48px] bg-gradient-to-b from-orange-400 via-orange-500 to-red-500 shadow-2xl shadow-orange-500/40">
            <!-- 眼睛（大） -->
            <div class="absolute left-12 top-7 size-10 rounded-full bg-white shadow-inner">
              <div :ref="registerPupil" class="absolute left-3 top-3 size-4.5 rounded-full bg-slate-900" />
              <div class="absolute left-4 top-4 size-1.5 rounded-full bg-white" />
            </div>
            <div class="absolute right-12 top-7 size-10 rounded-full bg-white shadow-inner">
              <div :ref="registerPupil" class="absolute left-3 top-3 size-4.5 rounded-full bg-slate-900" />
              <div class="absolute left-4 top-4 size-1.5 rounded-full bg-white" />
            </div>
            <!-- 微笑 -->
            <div class="absolute left-1/2 top-[82px] h-4 w-14 -translate-x-1/2 rounded-b-full border-b-[3px] border-slate-900/80" />
            <!-- 腮红 -->
            <div class="absolute left-5 top-[64px] size-5 rounded-full bg-red-500/50 blur-[2px]" />
            <div class="absolute right-5 top-[64px] size-5 rounded-full bg-red-500/50 blur-[2px]" />
          </div>
          <!-- 手（左手）：默认 y=80 藏在底部，遮眼时 y=-20 抬起 -->
          <div
            ref="handLeft"
            class="absolute left-7 top-[58px] size-11 rounded-full bg-orange-600 shadow-md ring-2 ring-orange-400/40"
            style="transform: translateY(80px);"
          >
            <div class="absolute inset-1 rounded-full bg-orange-500" />
          </div>
          <!-- 手（右手） -->
          <div
            ref="handRight"
            class="absolute right-7 top-[58px] size-11 rounded-full bg-orange-600 shadow-md ring-2 ring-orange-400/40"
            style="transform: translateY(80px);"
          >
            <div class="absolute inset-1 rounded-full bg-orange-500" />
          </div>
        </div>

        <!-- 角色 3：深灰长条（次高，右2，叠在黄色后方） -->
        <div
          ref="roleDark"
          class="shrink-0"
          style="width: 120px; height: 270px; margin-left: -20px; margin-right: -34px; opacity: 0; z-index: 1;"
        >
          <div class="size-full rounded-[32px] bg-gradient-to-b from-slate-700 to-slate-900 shadow-2xl shadow-slate-700/40">
            <!-- 眼睛（偏上，因为高） -->
            <div class="absolute left-5 top-[72px] size-7 rounded-full bg-white">
              <div :ref="registerPupil" class="absolute left-2 top-2 size-3.5 rounded-full bg-slate-900" />
            </div>
            <div class="absolute right-5 top-[72px] size-7 rounded-full bg-white">
              <div :ref="registerPupil" class="absolute left-2 top-2 size-3.5 rounded-full bg-slate-900" />
            </div>
            <!-- 严肃嘴 -->
            <div class="absolute left-1/2 top-[130px] h-1 w-8 -translate-x-1/2 rounded-full bg-white/90" />
          </div>
        </div>

        <!-- 角色 4：黄色胶囊（中矮，右1，最右前排） -->
        <div
          ref="roleYellow"
          class="shrink-0"
          style="width: 125px; height: 210px; opacity: 0; z-index: 2;"
        >
          <div class="size-full rounded-[62px] bg-gradient-to-b from-yellow-300 to-yellow-500 shadow-2xl shadow-yellow-400/40">
            <!-- 小圆点眼睛 -->
            <div class="absolute left-8 top-[64px] size-3.5 rounded-full bg-slate-900">
              <div :ref="registerPupil" class="size-full" />
            </div>
            <div class="absolute right-8 top-[64px] size-3.5 rounded-full bg-slate-900">
              <div :ref="registerPupil" class="size-full" />
            </div>
            <!-- 扁平嘴 -->
            <div class="absolute left-1/2 top-[100px] h-1.5 w-7 -translate-x-1/2 rounded-full bg-slate-800" />
            <!-- 腮红 -->
            <div class="absolute left-2.5 top-[84px] size-4.5 rounded-full bg-orange-400/50 blur-[2px]" />
            <div class="absolute right-2.5 top-[84px] size-4.5 rounded-full bg-orange-400/50 blur-[2px]" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
