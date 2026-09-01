import {
  createRouter,
  createWebHashHistory,
  type RouteRecordRaw,
} from 'vue-router'
import { useAuthStore } from '@/stores/auth'
/**
 * 首页组件改成静态 import（不懒加载）。
 *   原全部用 () => import(...) 懒加载时，Vite dev HMR 偶尔出现「组件引用错位」的缓存问题：
 *   明明 URL 是 / 却渲染 BlogEditorPage。把首页这条改成静态导入后，路由表初始化时
 *   HomePage 的组件引用就钉死了，不会被后续 chunk 加载的其他组件引用污染。
 */
import HomePage from '@/pages/HomePage.vue'

/**
 * 用一个全局唯一 Symbol 标记「首页兜底重定向」，避免同一条路由反复重定向造成死循环。
 */
const HOME_FORCE_REDIRECT = /* @__PURE__ */ Symbol('HOME_FORCE_REDIRECT')

/**
 * 路由表（v1.0 · 首版只注册 6 条主路由 + 通配 404）。
 * 使用 Hash 模式（部署到任何静态 CDN/GitHub Pages/Gitee Pages 都无需服务器 rewrite 配置）。
 * 若未来需切换 History 模式，改 createWebHistory(import.meta.env.BASE_URL) 并加部署端 fallback。
 */
const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'Home',
    component: HomePage, // 静态导入，避免 HMR 缓存下组件错位
    meta: { title: '首页', icon: 'Home' }
  },
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/pages/LoginPage.vue'),
    meta: { title: '登录', requiresAuth: false }
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
    path: '/profile',
    name: 'Profile',
    component: () => import('@/pages/ProfilePage.vue'),
    meta: { title: '个人资料', requiresAuth: true }
  },
  {
    path: '/blog/new',
    name: 'BlogNew',
    component: () => import('@/pages/BlogEditorPage.vue'),
    meta: { title: '新建文章', requiresAuth: true }
  },
  {
    path: '/blog/tags',
    name: 'BlogTags',
    component: () => import('@/pages/BlogTagsPage.vue'),
    meta: { title: '标签管理', requiresAuth: true }
  },
  {
    path: '/blog/:slug/edit',
    name: 'BlogEdit',
    component: () => import('@/pages/BlogEditorPage.vue'),
    meta: { title: '编辑文章', requiresAuth: true },
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
    path: '/life/new',
    name: 'LifeNew',
    component: () => import('@/pages/LifeEditorPage.vue'),
    meta: { title: '发布碎片', requiresAuth: true }
  },
  {
    path: '/life/:id/edit',
    name: 'LifeEdit',
    component: () => import('@/pages/LifeEditorPage.vue'),
    meta: { title: '编辑碎片', requiresAuth: true },
    props: true
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
    path: '/demo/loading',
    name: 'LoadingDemo',
    component: () => import('@/pages/LoadingDemoPage.vue'),
    meta: { title: '加载动画演示' }
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
 * beforeEach 钩子：需要登录的页面检查 Token
 * meta.requiresAuth = true 的路由，未登录 → 跳转 /login?redirect=原路径
 *
 * 额外防御（诊断 & 防跳转错位）：
 *   · DEV 环境打印每次导航，便于定位「首页莫名跳到 /blog/new」问题
 *   · 登录后 redirect 参数只允许站内相对路径（不以 http/// 开头、必须以 / 开头），
 *     否则丢弃直接用 /，避免旧 URL 缓存（比如 redirect=/blog/new）把用户拉到奇怪页面
 */
router.beforeEach((to, from, next) => {
  const authStore = useAuthStore()

  // ---- DEV 导航日志（方便定位路由错位）----
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.debug(
      `[router] ${from.fullPath || '(init)'} → ${to.fullPath}  matched: ${to.matched.map((r) => String(r.name || r.path)).join(' > ') || '(none)'}`,
    )
  }

  // -------- 首页兜底：URL = '/' 但匹配到的第一条路由不是 Home 时，强制干净重定向 --------
  //   这是 Vite HMR 懒加载偶发的"组件引用错位"最终防线：
  //   比如 '/blog/new' 组件被串到 Home 路由上时，这里会发现 to.matched[0].name !== 'Home'，
  //   于是用 HOME_FORCE_REDIRECT 做一次 replace。注意用 Symbol 做一次性标记，
  //   避免同一条 '/ → /' 守卫再命中，形成无限循环。
  if (
    to.path === '/' &&
    // 只要匹配到路由，且第一条不是 Home → 需要修正
    to.matched.length > 0 &&
    to.matched[0].name !== 'Home' &&
    // 已经被兜底重定向过一次 → 不再重复触发
    !(from as any)[HOME_FORCE_REDIRECT]
  ) {
    if (import.meta.env.DEV) {
      console.warn(
        `[router] 检测到首页路由错位：path=/ 匹配到的是 [${to.matched.map((r) => String(r.name || r.path)).join(', ')}]，强制 replace('/') 重新对齐`,
      )
    }
    ;(to as any)[HOME_FORCE_REDIRECT] = true
    next({ path: '/', replace: true })
    return
  }

  // ---- 需要登录：拦到 /login?redirect=原路径 ----
  if (to.meta?.requiresAuth && !authStore.isLoggedIn) {
    next({
      path: '/login',
      query: { redirect: to.fullPath },
    })
    return
  }

  // ---- 已登录用户访问登录页 → 重定向首页 ----
  if (to.path === '/login' && authStore.isLoggedIn) {
    next({ path: '/' })
    return
  }

  next()
})

/**
 * 把 login 页面的 redirect 参数做安全校验：
 *   - 必须是站内相对路径（以 / 开头）
 *   - 不能是 http(s) 协议或 // 开头（避免开放重定向漏洞 & 避免跳到别站）
 * 返回 '/', '/about', '/blog/xxx' 这种安全路径
 */
export function sanitizeLoginRedirect(raw: unknown, fallback = '/'): string {
  if (typeof raw !== 'string' || !raw) return fallback
  if (raw.startsWith('http:') || raw.startsWith('https:') || raw.startsWith('//')) {
    return fallback
  }
  if (!raw.startsWith('/')) return fallback
  return raw
}

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
