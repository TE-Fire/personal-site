<script setup lang="ts">
/**
 * 根组件：直接渲染 AppLayout（里面包了 Header / RouterView / Footer）
 * useTheme() 被 useTheme.ts 首次调用时完成主题 class + 系统监听，无需在本文件显式初始化。
 *
 * 额外职责（首页路由防御）：
 *   应用冷启动（刷新页面 / 首次打开 / Vite HMR 重启）时，如果 URL 已经是 / 但
 *   Vue Router 内部 matched[0] 不是 Home（懒加载缓存错位），这里做一次 replace('/')。
 *   这是「首帧防御」，防止用户一打开网站就看到"新建文章"页面。
 */
import { onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppLayout from '@/components/layout/AppLayout.vue'

const route = useRoute()
const router = useRouter()

onMounted(() => {
  if (route.path === '/') {
    const firstMatchedName = route.matched[0]?.name
    if (firstMatchedName && firstMatchedName !== 'Home') {
      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.warn(
          `[App.boot] 启动检测到首页错位：path=/ 但 matched[0].name=${String(firstMatchedName)}，replace('/') 重新对齐`,
        )
      }
      router.replace('/')
    } else if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.debug(
        `[App.boot] 路由自检通过：path=/ matched=[${route.matched.map((r) => String(r.name || r.path)).join(', ') || '(none)'}]`,
      )
    }
  }
})
</script>

<template>
  <AppLayout />
</template>
