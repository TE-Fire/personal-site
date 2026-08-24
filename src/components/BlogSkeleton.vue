<script setup lang="ts">
/**
 * BlogSkeleton · 博客列表骨架屏。
 * 模拟 BlogPage 卡片式布局，shimmer 光扫过效果。
 */
defineProps<{
  /** 骨架卡片数量 */
  count?: number
}>()
</script>

<template>
  <div class="space-y-4">
    <div
      v-for="n in count ?? 3"
      :key="n"
      class="rounded-xl border border-border/50 bg-surface p-4 md:p-5"
    >
      <div class="flex flex-col md:flex-row md:items-stretch gap-4">
        <!-- 左侧信息区 -->
        <div class="flex-1 min-w-0 space-y-3">
          <!-- badges 行 -->
          <div class="flex items-center gap-2">
            <div class="skel skel-badge" />
            <div class="skel skel-badge" />
            <div class="skel h-3 w-24 rounded" />
            <div class="skel h-3 w-20 rounded" />
          </div>
          <!-- 标题 -->
          <div class="skel h-5 w-3/4 rounded" />
          <!-- 摘要 -->
          <div class="space-y-2">
            <div class="skel h-3.5 w-full rounded" />
            <div class="skel h-3.5 w-5/6 rounded" />
          </div>
          <!-- 标签 -->
          <div class="flex gap-1.5 pt-0.5">
            <div class="skel h-5 w-12 rounded-full" />
            <div class="skel h-5 w-14 rounded-full" />
            <div class="skel h-5 w-10 rounded-full" />
          </div>
        </div>
        <!-- 右侧占位 -->
        <div class="shrink-0 md:w-16 border-t md:border-t-0 md:border-l border-border/50 md:pl-4 pt-3 md:pt-0">
          <div class="skel h-6 w-6 rounded mx-auto" />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 骨架基础色块 */
.skel {
  position: relative;
  overflow: hidden;
  background: var(--surface-muted);
}

/* shimmer 光扫过 */
.skel::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(
    90deg,
    transparent,
    var(--surface-elevated, var(--surface)),
    transparent
  );
  transform: translateX(-100%);
  animation: shimmer 1.5s infinite;
}

.skel-badge {
  height: 18px;
  width: 48px;
  border-radius: 4px;
}

@keyframes shimmer {
  100% { transform: translateX(100%); }
}
</style>
