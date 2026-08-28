<script setup lang="ts">
/**
 * 登录页左侧动画 Hero 区（v3 · 角色垂直居中对齐 + 眼睛定位修复）
 *
 * 布局：
 *   · 4 个角色 底部对齐，横向排成一排
 *   · 从左 → 右顺序：紫方块 → 橙半圆 → 黑长条 → 黄胶囊
 *   · 整排居中（稍向下偏移 5%），与右侧登录卡片中心水平对齐
 *
 * 关键修复：
 *   · 身体渐变 div + relative → 嘴巴/腮红 absolute 定位正确
 *   · 眼白 div + relative → 瞳孔 absolute 定位相对于眼白内部（之前定位错祖先导致全白）
 *   · 眼白:瞳孔 ≈ 2:1，居中摆放
 */
import { ref, onMounted, onUnmounted, computed, watch } from 'vue';
import gsap from 'gsap';

const props = defineProps<{
  focusField?: 'username' | 'password' | null;
  passwordLen?: number;
}>();

/* ---------- Refs ---------- */
const heroRef = ref<HTMLElement | null>(null);
const rolePurple = ref<HTMLElement | null>(null);
const roleOrange = ref<HTMLElement | null>(null);
const roleDark = ref<HTMLElement | null>(null);
const roleYellow = ref<HTMLElement | null>(null);

const pupils = ref<HTMLElement[]>([]);
function registerPupil(el: HTMLElement | null) {
  if (el && !pupils.value.includes(el)) pupils.value.push(el);
}
const handLeft = ref<HTMLElement | null>(null);
const handRight = ref<HTMLElement | null>(null);
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
  return Math.min(1, 0.6 + len * 0.05);
});

/* ---------- GSAP 生命周期 ---------- */
let mouseMoveCleanup: (() => void) | null = null;
let enterCleanup: (() => void) | null = null;
let leaveCleanup: (() => void) | null = null;

onMounted(() => {
  const roles = [
    rolePurple.value,
    roleOrange.value,
    roleDark.value,
    roleYellow.value,
  ].filter(Boolean) as HTMLElement[];

  // 入场 stagger 弹跳
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

  // 角色持续呼吸
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

  // mouseenter 欢迎倾斜
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

  // 瞳孔跟随鼠标
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

/* ---------- 遮眼 ---------- */
watch(coverIntensity, (v) => {
  const y = 80 - v * 100;
  const rotateL = -v * 15;
  const rotateR = v * 15;
  if (handLeft.value) {
    gsap.to(handLeft.value, { y, rotate: rotateL, duration: 0.45, ease: 'power2.out' });
  }
  if (handRight.value) {
    gsap.to(handRight.value, { y, rotate: rotateR, duration: 0.45, ease: 'power2.out' });
  }
}, { immediate: true });

/* ---------- 用户名聚焦 → 黄胶囊跳一下 ---------- */
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
    class="relative flex h-full w-full flex-col items-center justify-center overflow-hidden"
  >
    <!-- 渐变背景 -->
    <div class="absolute inset-0 bg-gradient-to-br from-purple-50 via-violet-50 to-indigo-50 dark:from-indigo-950 dark:via-purple-950 dark:to-slate-950" />
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
      角色行：容器相对居中（向下偏移 5%，视觉更自然，与右侧登录卡片中心齐平）
      flex items-end justify-center → 角色底部基线齐平
    -->
    <div
      class="relative z-10 w-full translate-y-[5%] flex items-end justify-center"
    >
      <div class="flex items-end justify-center gap-0" style="width: 540px;">
        <!-- ====== 角色 1：紫色方块（最高，左1，150×240） ====== -->
        <div
          ref="rolePurple"
          class="shrink-0"
          style="width: 150px; height: 240px; margin-right: -24px; opacity: 0; z-index: 1;"
        >
          <div class="relative size-full rounded-[34px] bg-gradient-to-b from-purple-500 to-purple-700 shadow-2xl shadow-purple-500/40">
            <!-- 左眼：眼白 32 / 瞳孔 14 居中（absolute 自身作为 containing block，不必再加 relative） -->
            <div
              class="absolute rounded-full bg-white"
              style="left: 24px; top: 60px; width: 32px; height: 32px;"
            >
              <div
                :ref="registerPupil"
                class="absolute rounded-full bg-slate-900"
                style="left: 9px; top: 9px; width: 14px; height: 14px;"
              >
                <div
                  class="absolute rounded-full bg-white"
                  style="left: 3px; top: 3px; width: 4px; height: 4px;"
                />
              </div>
            </div>
            <!-- 右眼 -->
            <div
              class="absolute rounded-full bg-white"
              style="left: 94px; top: 60px; width: 32px; height: 32px;"
            >
              <div
                :ref="registerPupil"
                class="absolute rounded-full bg-slate-900"
                style="left: 9px; top: 9px; width: 14px; height: 14px;"
              >
                <div
                  class="absolute rounded-full bg-white"
                  style="left: 3px; top: 3px; width: 4px; height: 4px;"
                />
              </div>
            </div>
            <!-- 微笑 -->
            <div
              class="absolute rounded-b-full border-b-[3px] border-white/90"
              style="left: 53px; top: 132px; width: 44px; height: 14px;"
            />
          </div>
        </div>

        <!-- ====== 角色 2：橙色半圆（最矮，左2，210×150，最前景带手） ====== -->
        <div
          ref="roleOrange"
          class="shrink-0 relative"
          style="width: 210px; height: 150px; opacity: 0; z-index: 3;"
        >
          <div
            class="absolute bottom-0 rounded-t-full rounded-b-[48px] bg-gradient-to-b from-orange-400 via-orange-500 to-red-500 shadow-2xl shadow-orange-500/40"
            style="left: 0; right: 0; height: 140px;"
          >
            <!-- 左眼：眼白 40 / 瞳孔 18 居中 -->
            <div
              class="absolute rounded-full bg-white shadow-inner"
              style="left: 48px; top: 28px; width: 40px; height: 40px;"
            >
              <div
                :ref="registerPupil"
                class="absolute rounded-full bg-slate-900"
                style="left: 11px; top: 11px; width: 18px; height: 18px;"
              >
                <div
                  class="absolute rounded-full bg-white"
                  style="left: 4px; top: 4px; width: 5px; height: 5px;"
                />
              </div>
            </div>
            <!-- 右眼 -->
            <div
              class="absolute rounded-full bg-white shadow-inner"
              style="left: 122px; top: 28px; width: 40px; height: 40px;"
            >
              <div
                :ref="registerPupil"
                class="absolute rounded-full bg-slate-900"
                style="left: 11px; top: 11px; width: 18px; height: 18px;"
              >
                <div
                  class="absolute rounded-full bg-white"
                  style="left: 4px; top: 4px; width: 5px; height: 5px;"
                />
              </div>
            </div>
            <!-- 微笑 -->
            <div
              class="absolute rounded-b-full border-b-[3px] border-slate-900/80"
              style="left: 77px; top: 82px; width: 56px; height: 16px;"
            />
            <!-- 腮红 -->
            <div
              class="absolute rounded-full bg-red-500/50 blur-[2px]"
              style="left: 20px; top: 64px; width: 20px; height: 20px;"
            />
            <div
              class="absolute rounded-full bg-red-500/50 blur-[2px]"
              style="left: 170px; top: 64px; width: 20px; height: 20px;"
            />
          </div>
          <!-- 左手（遮眼） -->
          <div
            ref="handLeft"
            class="absolute size-11 rounded-full bg-orange-600 shadow-md ring-2 ring-orange-400/40"
            style="left: 28px; top: 58px; transform: translateY(80px);"
          >
            <div class="absolute inset-1 rounded-full bg-orange-500" />
          </div>
          <!-- 右手（遮眼） -->
          <div
            ref="handRight"
            class="absolute size-11 rounded-full bg-orange-600 shadow-md ring-2 ring-orange-400/40"
            style="left: 158px; top: 58px; transform: translateY(80px);"
          >
            <div class="absolute inset-1 rounded-full bg-orange-500" />
          </div>
        </div>

        <!-- ====== 角色 3：深灰长条（次高，右2，120×270） ====== -->
        <div
          ref="roleDark"
          class="shrink-0"
          style="width: 120px; height: 270px; margin-left: -20px; margin-right: -34px; opacity: 0; z-index: 1;"
        >
          <div class="relative size-full rounded-[32px] bg-gradient-to-b from-slate-700 to-slate-900 shadow-2xl shadow-slate-700/40">
            <!-- 左眼：眼白 28 / 瞳孔 12 居中 -->
            <div
              class="absolute rounded-full bg-white"
              style="left: 20px; top: 72px; width: 28px; height: 28px;"
            >
              <div
                :ref="registerPupil"
                class="absolute rounded-full bg-slate-900"
                style="left: 8px; top: 8px; width: 12px; height: 12px;"
              >
                <div
                  class="absolute rounded-full bg-white"
                  style="left: 3px; top: 2px; width: 3px; height: 3px;"
                />
              </div>
            </div>
            <!-- 右眼 -->
            <div
              class="absolute rounded-full bg-white"
              style="left: 72px; top: 72px; width: 28px; height: 28px;"
            >
              <div
                :ref="registerPupil"
                class="absolute rounded-full bg-slate-900"
                style="left: 8px; top: 8px; width: 12px; height: 12px;"
              >
                <div
                  class="absolute rounded-full bg-white"
                  style="left: 3px; top: 2px; width: 3px; height: 3px;"
                />
              </div>
            </div>
            <!-- 严肃嘴 -->
            <div
              class="absolute rounded-full bg-white/90"
              style="left: 44px; top: 130px; width: 32px; height: 4px;"
            />
          </div>
        </div>

        <!-- ====== 角色 4：黄色胶囊（中矮，右1，125×210） ====== -->
        <div
          ref="roleYellow"
          class="shrink-0"
          style="width: 125px; height: 210px; opacity: 0; z-index: 2;"
        >
          <div class="relative size-full rounded-[62px] bg-gradient-to-b from-yellow-300 to-yellow-500 shadow-2xl shadow-yellow-400/40">
            <!-- 左眼（纯黑点） -->
            <div
              class="absolute rounded-full bg-slate-900"
              style="left: 32px; top: 64px; width: 14px; height: 14px;"
            >
              <div :ref="registerPupil" class="size-full" />
            </div>
            <!-- 右眼（纯黑点） -->
            <div
              class="absolute rounded-full bg-slate-900"
              style="left: 79px; top: 64px; width: 14px; height: 14px;"
            >
              <div :ref="registerPupil" class="size-full" />
            </div>
            <!-- 扁平嘴 -->
            <div
              class="absolute rounded-full bg-slate-800"
              style="left: 48px; top: 100px; width: 28px; height: 6px;"
            />
            <!-- 腮红 -->
            <div
              class="absolute rounded-full bg-orange-400/50 blur-[2px]"
              style="left: 10px; top: 84px; width: 18px; height: 18px;"
            />
            <div
              class="absolute rounded-full bg-orange-400/50 blur-[2px]"
              style="left: 97px; top: 84px; width: 18px; height: 18px;"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
