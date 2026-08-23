<script setup lang="ts">
/**
 * 根组件：直接渲染 AppLayout（里面包了 Header / RouterView / Footer）
 * useTheme() 被 useTheme.ts 首次调用时完成主题 class + 系统监听，无需在本文件显式初始化。
 */
import AppLayout from '@/components/layout/AppLayout.vue'
</script>

<template>
  <AppLayout />
</template>
