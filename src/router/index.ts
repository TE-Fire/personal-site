import {
  createRouter,
  createWebHashHistory,
  type RouteRecordRaw
} from 'vue-router'

/**
 * 路由表（v1.0 · 首版只注册 6 条主路由 + 通配 404）。
 * 使用 Hash 模式（部署到任何静态 CDN/GitHub Pages/Gitee Pages 都无需服务器 rewrite 配置）。
 * 若未来需切换 History 模式，改 createWebHistory(import.meta.env.BASE_URL) 并加部署端 fallback。
 */
const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'Home',
    component: () => import('@/pages/HomePage.vue'),
    meta: { title: '首页', icon: 'Home' }
  },
  {
    path: '/about',
    name: 'About',
    component: () => import('@/pages/AboutPage.vue'),
    meta: { title: '关于我', icon: 'User' }
  },
  {
    path: '/portfolio',
    name: 'Portfolio',
    component: () => import('@/pages/PortfolioPage.vue'),
    meta: { title: '作品集', icon: 'Briefcase' }
  },
  {
    path: '/blog',
    name: 'Blog',
    component: () => import('@/pages/BlogPage.vue'),
    meta: { title: '博客', icon: 'BookOpen' }
  },
  {
    path: '/blog/new',
    name: 'BlogNew',
    component: () => import('@/pages/BlogEditorPage.vue'),
    meta: { title: '新建文章' }
  },
  {
    path: '/blog/tags',
    name: 'BlogTags',
    component: () => import('@/pages/BlogTagsPage.vue'),
    meta: { title: '标签管理' }
  },
  {
    path: '/blog/:slug/edit',
    name: 'BlogEdit',
    component: () => import('@/pages/BlogEditorPage.vue'),
    meta: { title: '编辑文章' },
    props: true
  },
  {
    path: '/blog/:slug',
    name: 'BlogDetail',
    component: () => import('@/pages/BlogDetailPage.vue'),
    meta: { title: '博客详情' },
    props: true
  },
  {
    path: '/life',
    name: 'Life',
    component: () => import('@/pages/LifePage.vue'),
    meta: { title: '生活碎片', icon: 'Coffee' }
  },
  {
    path: '/timeline',
    name: 'Timeline',
    component: () => import('@/pages/TimelinePage.vue'),
    meta: { title: '经历时间线', icon: 'History' }
  },
  {
    path: '/contact',
    name: 'Contact',
    component: () => import('@/pages/ContactPage.vue'),
    meta: { title: '联系方式', icon: 'Mail' }
  },
  {
    // 404：放最后一条兜底。Vue Router 4 使用 :pathMatch(.*)* 的 POSIX 扩展语法。
    path: '/:pathMatch(.*)*',
    name: 'NotFound',
    component: () => import('@/pages/NotFoundPage.vue'),
    meta: { title: '404 · 迷路了' }
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
  /**
   * 路由跳转滚动行为：
   * 1) 带 hash（#section）→ 平滑滚动到对应元素（加 offset 避免被 sticky Header 遮住）
   * 2) 在浏览器前进/后退时（savedPosition 存在）→ 保留用户原本滚动位置
   * 3) 普通页面跳转 → 直接滚动回顶部 { top: 0 }
   */
  scrollBehavior(to, _from, savedPosition) {
    const headerOffset = 72 // Header 高度约 h-16（64px）再留一点间隙
    if (to.hash) {
      return {
        el: to.hash,
        top: headerOffset,
        behavior: 'smooth'
      }
    }
    if (savedPosition) return savedPosition
    return { top: 0, left: 0 }
  }
})

/**
 * afterEach 钩子：自动把 document.title 改成「页面名 · 站点名」。
 * 空值或非字符串 meta.title 时回退默认标题。
 */
const SITE_NAME = 'Trae · 个人作品集'
router.afterEach((to) => {
  const title = (to.meta?.title as string | undefined)?.trim()
  document.title = title ? `${title} · ${SITE_NAME}` : SITE_NAME
})

export default router
