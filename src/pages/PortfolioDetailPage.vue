<script setup lang="ts">
/**
 * PortfolioDetailPage · 作品集详情页
 * 路由：/portfolio/:slug
 *
 * 数据流：
 *   onMounted → getWorkBySlug(slug) 拉取作品详情
 *   三态：loading / error（含未找到） / ok
 *
 * 设计：参考 BlogDetailPage 三态分离 + PortfolioPage 列表卡片的渐变封面风格，
 * 把封面背景做成详情页 hero 区域。
 */
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  ArrowLeft,
  AlertTriangle,
  Calendar,
  Github,
  ExternalLink,
  Home,
  RefreshCw,
  Star,
  Briefcase
} from 'lucide-vue-next'
import { Badge, Button } from '@/components/ui'
import { getWorkBySlug, type WorkData } from '@/api/portfolio'
import { useScrollReveal } from '@/composables/useScrollReveal'

defineOptions({ name: 'PortfolioDetailPage' })

const route = useRoute()
const router = useRouter()

const pageRoot = ref<HTMLElement | null>(null)
useScrollReveal(pageRoot)

/* ---------- 状态机 ---------- */
const work = ref<WorkData | null>(null)
const isLoading = ref(true)
const errorMsg = ref('')

const hasError = computed(() => !!errorMsg.value)
const slug = computed(() => String(route.params.slug ?? ''))

/* ---------- 加载入口 ---------- */
async function loadWork() {
  isLoading.value = true
  errorMsg.value = ''
  work.value = null
  if (!slug.value) {
    errorMsg.value = '缺少 slug 参数'
    isLoading.value = false
    return
  }
  try {
    work.value = await getWorkBySlug(slug.value)
  } catch (e: any) {
    work.value = null
    errorMsg.value = e?.message || '无法获取作品详情'
  } finally {
    isLoading.value = false
  }
}

onMounted(loadWork)

/* ---------- 重试 / 返回 ---------- */
function retry() {
  loadWork()
}
function goBackPortfolio() {
  // 优先 router.back，无历史则 push 到 /portfolio
  if (window.history.length > 1) {
    try {
      router.back()
      return
    } catch {
      /* noop */
    }
  }
  router.push('/portfolio')
}

/** 新窗口打开外链（模板作用域里拿不到 window，必须经 script 暴露） */
function openLink(url?: string) {
  if (url) window.open(url, '_blank')
}

/* ---------- 顶部面包屑：作品标题 ---------- */
const crumbTitle = computed(() => work.value?.title || '作品不存在')
</script>

<template>
  <div ref="pageRoot" class="space-y-8">
    <!-- 顶部导航条 -->
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div class="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          aria-label="返回作品集"
          @click="goBackPortfolio"
        >
          <ArrowLeft class="size-5" />
        </Button>
        <div
          class="text-xs text-text-muted uppercase tracking-wider font-semibold flex items-center gap-1.5"
        >
          <Briefcase class="size-3.5" />
          <router-link to="/portfolio" class="hover:text-brand transition">作品集</router-link>
          <span class="opacity-50">/</span>
          <span class="text-text-secondary truncate max-w-[40ch]">{{ crumbTitle }}</span>
        </div>
      </div>
    </div>

    <!-- ==================== 加载中 ==================== -->
    <section
      v-if="isLoading"
      aria-busy="true"
      aria-label="正在加载作品"
      class="space-y-8"
    >
      <div
        class="rounded-2xl border border-border/50 bg-surface-muted/25 px-6 py-8 md:px-10 md:py-10 space-y-7"
      >
        <div class="space-y-5">
          <div class="skeleton skeleton-h1" style="width: 60%;"></div>
          <div class="skeleton skeleton-line" style="width: 90%;"></div>
          <div class="skeleton skeleton-line" style="width: 70%;"></div>
        </div>
        <div class="skeleton" style="height: 240px; border-radius: 16px;"></div>
      </div>
    </section>

    <!-- ==================== 错误 / 不存在 ==================== -->
    <section v-else-if="hasError || !work" class="mx-auto w-full max-w-2xl">
      <div
        class="rounded-2xl border border-danger/40 bg-gradient-to-br from-danger/10 via-transparent to-transparent px-6 py-8 md:px-10 md:py-10 shadow-xl shadow-black/10 text-center space-y-6"
      >
        <div
          class="mx-auto flex items-center justify-center size-14 rounded-2xl bg-danger/15 text-danger"
        >
          <AlertTriangle class="size-7" />
        </div>
        <div class="space-y-2">
          <h2 class="text-xl md:text-2xl font-semibold tracking-tight text-text">
            未找到该作品
          </h2>
          <p class="text-text-secondary leading-relaxed">{{ errorMsg || '作品不存在或已被下架。' }}</p>
          <p class="text-sm text-text-muted">建议返回作品集列表，换个项目看看。</p>
        </div>
        <div class="flex flex-wrap items-center justify-center gap-3 pt-2">
          <Button variant="default" size="lg" @click="goBackPortfolio">
            <ArrowLeft class="size-4" />
            返回作品集
          </Button>
          <Button variant="outline" size="lg" @click="retry">
            <RefreshCw class="size-4" />
            再试一次
          </Button>
          <Button variant="ghost" size="lg" @click="router.push('/')">
            <Home class="size-4" />
            回到首页
          </Button>
        </div>
      </div>
    </section>

    <!-- ==================== 详情正文 ==================== -->
    <article v-else class="space-y-10">
      <!-- Hero 卡片：渐变封面 + 标题 + 元信息 -->
      <section
        class="rounded-2xl overflow-hidden border border-border/60 shadow-lg"
        data-reveal
      >
        <!-- 渐变封面（与列表卡片同风格） -->
        <div
          :class="[
            'aspect-[16/9] bg-gradient-to-br relative flex flex-col items-center justify-center text-text-muted',
            work.cover
          ]"
        >
          <!-- 顶部 Badge 区 -->
          <div class="absolute top-4 left-4 flex gap-2">
            <Badge variant="outline" class="backdrop-blur bg-surface-elevated/70">
              {{ work.category }}
            </Badge>
            <Badge
              v-if="work.highlight"
              variant="default"
              class="backdrop-blur bg-brand/90 gap-1 !px-2"
            >
              <Star class="size-3" /> 精选
            </Badge>
            <Badge
              v-if="work.status && work.status !== 'PUBLISHED'"
              variant="secondary"
              class="backdrop-blur bg-surface-elevated/70"
            >
              {{ work.status }}
            </Badge>
          </div>

          <!-- 封面中央的简短标题 -->
          <div class="relative z-10 max-w-[80%] text-center px-4">
            <h1
              class="m-0 text-2xl md:text-4xl font-bold tracking-tight text-text drop-shadow-sm leading-tight"
            >
              {{ work.title }}
            </h1>
            <p
              v-if="work.summary"
              class="mt-3 m-0 text-sm md:text-base text-text/80 leading-relaxed"
            >
              {{ work.summary }}
            </p>
          </div>

          <!-- 完成时间 -->
          <div class="absolute bottom-4 right-4">
            <span
              class="font-mono text-xs text-text-muted/80 backdrop-blur bg-surface-elevated/60 rounded-full px-3 py-1 inline-flex items-center gap-1.5"
            >
              <Calendar class="size-3" />
              {{ work.finishedAt }}
            </span>
          </div>
        </div>
      </section>

      <!-- 描述区 -->
      <section
        v-if="work.description"
        class="mx-auto w-full max-w-3xl space-y-4"
        data-reveal="0.05"
      >
        <h2 class="m-0 text-lg font-semibold text-text flex items-center gap-2">
          <span class="inline-block w-1 h-5 bg-brand rounded-full"></span>
          项目描述
        </h2>
        <p class="m-0 text-base md:text-lg leading-[1.85] text-text-secondary whitespace-pre-line">
          {{ work.description }}
        </p>
      </section>

      <!-- 技术标签 -->
      <section
        v-if="work.tags.length"
        class="mx-auto w-full max-w-3xl space-y-3"
        data-reveal="0.1"
      >
        <h2 class="m-0 text-lg font-semibold text-text flex items-center gap-2">
          <span class="inline-block w-1 h-5 bg-brand rounded-full"></span>
          技术标签
        </h2>
        <div class="flex flex-wrap gap-2">
          <Badge
            v-for="tag in work.tags"
            :key="tag"
            variant="secondary"
            class="text-sm px-3 py-1 rounded-full"
          >
            #{{ tag }}
          </Badge>
        </div>
      </section>

      <!-- 链接区 -->
      <section
        v-if="work.links?.repo || work.links?.demo || work.links?.homepage"
        class="mx-auto w-full max-w-3xl space-y-3"
        data-reveal="0.15"
      >
        <h2 class="m-0 text-lg font-semibold text-text flex items-center gap-2">
          <span class="inline-block w-1 h-5 bg-brand rounded-full"></span>
          相关链接
        </h2>
        <div class="flex flex-wrap gap-3">
          <Button
            v-if="work.links?.repo"
            variant="outline"
            @click="openLink(work?.links?.repo)"
          >
            <Github class="size-4" />
            源码仓库
          </Button>
          <Button
            v-if="work.links?.demo"
            variant="default"
            @click="openLink(work?.links?.demo)"
          >
            <ExternalLink class="size-4" />
            在线 Demo
          </Button>
          <Button
            v-if="work.links?.homepage"
            variant="secondary"
            @click="openLink(work?.links?.homepage)"
          >
            <Home class="size-4" />
            项目主页
          </Button>
        </div>
      </section>

      <!-- 底部操作区 -->
      <div class="mx-auto w-full max-w-3xl flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-border/60">
        <div class="flex flex-wrap gap-2">
          <Badge variant="outline">{{ work.category }}</Badge>
          <Badge v-if="work.highlight" variant="default" class="gap-1">
            <Star class="size-3" /> 精选
          </Badge>
        </div>
        <div class="flex items-center gap-2">
          <Button variant="outline" size="sm" @click="router.push('/portfolio')">
            <ArrowLeft class="size-4" />
            作品集列表
          </Button>
          <Button variant="outline" size="sm" @click="router.push('/')">
            <Home class="size-4" />
            <span class="hidden sm:inline">回首页</span>
          </Button>
        </div>
      </div>
    </article>
  </div>
</template>
