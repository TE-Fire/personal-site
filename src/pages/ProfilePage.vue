<script setup lang="ts">
/**
 * ProfilePage · 个人工作台（/profile，requiresAuth）
 *
 * Tab 结构（重心在「关于我展示」—— 这才是用户详情模块）：
 *   Tab1 · 关于我展示编辑器（默认激活）
 *     · 头像卡片（与账号头像共用：上传 / 清除）
 *     · 展示名称 displayName ↔ authStore.user.nickname 始终同步（改任一边都自动写另一边）
 *     · shortBio（textarea 单行大简介，展示在 AboutPage 页头 & HomePage Hero）
 *     · location（input）
 *     · available（switch · 可接项目 / 不可接）
 *     · tags（chip 输入 · HomePage 终端 whoami 展示用）
 *     · interests（chip 输入 · AboutPage 「最近感兴趣」）
 *     · longBio（textarea 多行 · 回车分段 · AboutPage 「关于我」长文）
 *     · nowDoing（textarea 多行 · 每行一条 · 支持 **粗体** inline md · AboutPage 「现在」Card）
 *     · highlightStats（4 行动态增删：label + value · AboutPage/HomePage 的 4 个数字 chip）
 *     · skillGroups（3 组动态增删：每组 title + variant + items chip · AboutPage 技能栈）
 *   Tab2 · 账号资料（原 ProfilePage 表单原封不动移入）
 *     · username 只读 · nickname 与 Tab1 的 displayName 同步 · email · role 展示
 *
 * 依赖：
 *   · authStore：用户资料 CRUD + 头像上传/清除 + resolveAvatarUrl
 *   · aboutStore：fetchAbout / saveAbout（PUT /api/about），成功后 about/aboutStore 统一刷新，
 *                 AboutPage/HomePage/Widget 三端立即响应
 *   · 路由守卫已保证 requiresAuth=true，进来必然已登录；若 token 过期会被 axios 拦截器登出
 */
import { computed, onMounted, ref, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useAboutStore } from '@/stores/about'
import type { AboutRsp, HighlightStat, SkillGroup, UpdateAboutParams, HeatmapSource } from '@/lib/api-types'
import { Button, Card, CardContent, Input, Label, Switch } from '@/components/ui'
import {
  Camera,
  X,
  Check,
  Loader2,
  UserCircle2,
  Plus,
  Minus,
  RotateCcw,
  Save,
  User as UserIcon,
  Sparkles,
  Heart,
} from 'lucide-vue-next'

const authStore = useAuthStore()
const aboutStore = useAboutStore()

/* ========================================================================
 *  Tab 切换（手搓 · 不用引入 Tabs 组件，避免新增 shadcn 依赖）
 * ====================================================================== */
type TabKey = 'about' | 'account'
const activeTab = ref<TabKey>('about')
const TABS: { key: TabKey; label: string; hint: string }[] = [
  { key: 'about', label: '关于我展示', hint: '管理 About 页面 / 首页 Hero / 悬浮卡片的展示内容' },
  { key: 'account', label: '账号资料', hint: '昵称 / 邮箱 / 角色等账号基础信息' },
]
function setTab(t: TabKey) { activeTab.value = t }

/* ========================================================================
 *  全局 Toast 反馈（顶部浮窗，两个 Tab 共用）
 * ====================================================================== */
type Feedback = { type: 'success' | 'error'; message: string } | null
const feedback = ref<Feedback>(null)
let feedbackTimer: number | undefined
function showFeedback(type: 'success' | 'error', message: string) {
  feedback.value = { type, message }
  if (feedbackTimer) window.clearTimeout(feedbackTimer)
  feedbackTimer = window.setTimeout(() => { feedback.value = null }, 3200)
}

/* ========================================================================
 *  Tab1 · About 展示编辑器 —— 表单状态 + 与后端 / store 的同步逻辑
 * ====================================================================== */

// ---- 本地 editable 快照（避免"取消"时数据脏写）----
const aboutLoading = ref(false)   // 初次加载 / 保存时的 loading
const aboutSubmitting = ref(false)

/** 深拷贝一个 AboutRsp 为「可编辑快照」初始值（字段与 UpdateAboutParams 对齐）。
 *  注意：displayName(对应 About.name) 跟 authStore.user.nickname 同步；avatar 不在这里改，
 *  通过「头像上传卡片」直接走 authStore.uploadAvatar/removeAvatar 绑定到 User.avatar，
 *  后端 GET /api/about 时自动把 User.about_avatar(=User.avatar) 当作 About.avatar 返回。
 */
function cloneForEdit(src: AboutRsp): UpdateAboutParams & { displayName: string } {
  return {
    displayName: src.name ?? '',
    shortBio: src.shortBio ?? '',
    location: src.location ?? '',
    available: Boolean(src.available),
    longBio: Array.isArray(src.longBio) ? [...src.longBio] : [],
    tags: Array.isArray(src.tags) ? [...src.tags] : [],
    interests: Array.isArray(src.interests) ? [...src.interests] : [],
    nowDoing: Array.isArray(src.nowDoing) ? [...src.nowDoing] : [],
    highlightStats: Array.isArray(src.highlightStats)
      ? src.highlightStats.map((s) => ({ label: s.label ?? '', value: s.value ?? '' }))
      : [],
    skillGroups: Array.isArray(src.skillGroups)
      ? src.skillGroups.map((g) => ({
          id: g.id ?? Math.random().toString(36).slice(2, 9),
          title: g.title ?? '',
          variant: (['default', 'secondary', 'outline'].includes(g.variant as any)
            ? g.variant
            : 'default') as SkillGroup['variant'],
          items: Array.isArray(g.items) ? [...g.items] : [],
        }))
      : [],
    // ===== 热力图配置（4 字段；Phase 1 后 3 项在 UI 上 disabled，但表单仍统一维护）=====
    heatmapSource: (['SITE', 'GITHUB', 'MERGED'].includes(src.heatmapSource as any)
      ? src.heatmapSource
      : 'SITE') as HeatmapSource,
    heatmapEnableGithub: Boolean(src.heatmapEnableGithub),
    githubUsername: src.githubUsername ?? '',
    githubLink: src.githubLink ?? '',
  }
}

// ---- 表单本地 ref（onMounted 从 store 初始化）----
const aboutDraft = ref<ReturnType<typeof cloneForEdit>>({
  displayName: '',
  shortBio: '',
  location: '',
  available: false,
  longBio: [],
  tags: [],
  interests: [],
  nowDoing: [],
  highlightStats: [],
  skillGroups: [],
  heatmapSource: 'SITE',
  heatmapEnableGithub: false,
  githubUsername: '',
  githubLink: '',
})

/** 从 store 同步到 aboutDraft（首次加载 / 重置 触发） */
function syncAboutFromStore() {
  aboutDraft.value = cloneForEdit(aboutStore.safeAbout)
  // displayName 兜底：若后端 About.name 空 → 取账号昵称
  if (!aboutDraft.value.displayName.trim()) {
    aboutDraft.value.displayName = authStore.user?.nickname || authStore.user?.username || ''
  }
}

/** 初次挂载：拉齐 auth + about 两边的数据（保证编辑区不是空的） */
onMounted(async () => {
  aboutLoading.value = true
  try {
    // 1) 用户 profile（保证头像 / nickname 有值）
    if (!authStore.user) await authStore.fetchProfile()
    // 2) About 公开展示数据（force=true 确保拿最新，避免使用旧缓存）
    await aboutStore.fetchAbout(true)
    syncAboutFromStore()
  } catch (e: any) {
    showFeedback('error', e?.message || '初始化资料失败，请刷新重试')
  } finally {
    aboutLoading.value = false
  }
})

/* ---- displayName 与账号 nickname 双向同步 ----
 *  用户选定「始终同步」方案：编辑 displayName 时，通过双向 watch 让
 *  Tab2 昵称输入框也实时变化；保存时再真正写入后端。
 *  这里的 syncingDisplayName 锁防止双向 watch 反复触发。
 */
const syncingDisplayName = ref(false)
watch(
  () => aboutDraft.value.displayName,
  (_newName) => {
    if (syncingDisplayName.value) return
    syncingDisplayName.value = true
    // 当前侧只是"草稿改动"，无需额外动作；双向 watch 放在下面两个 watcher 处理
    syncingDisplayName.value = false
  },
)

/* ========================================================================
 *  Tab1 · 辅助：Chip 输入（tags / interests / skill items 共用模板逻辑）
 *  策略：一个输入框 + 下方 badges；回车/逗号分隔 = 添加；点击 × = 删除。
 * ====================================================================== */
function addChip(listRef: string[], raw: string) {
  const v = raw.trim().replace(/[,，\s]+$/, '').trim()
  if (!v) return
  // 去重（大小写不敏感）
  if (listRef.some((x) => x.toLowerCase() === v.toLowerCase())) return
  listRef.push(v)
}
function removeChip(listRef: string[], idx: number) {
  listRef.splice(idx, 1)
}

/* ========================================================================
 *  Tab1 · 辅助：换行分割数组（longBio / nowDoing 的 textarea <-> string[]）
 *  textarea 里「每行 = 数组一项」，空行跳过，便于非技术用户理解段落语义。
 * ====================================================================== */
function linesToArr(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
}
function arrToLines(arr: string[]): string {
  return (arr ?? []).join('\n')
}

// 用两个 computed 让 textarea 的 v-model 与 string[] 双向联动
const longBioText = computed({
  get: () => arrToLines(aboutDraft.value.longBio),
  set: (v: string) => (aboutDraft.value.longBio = linesToArr(v)),
})
const nowDoingText = computed({
  get: () => arrToLines(aboutDraft.value.nowDoing),
  set: (v: string) => (aboutDraft.value.nowDoing = linesToArr(v)),
})

/* ========================================================================
 *  Tab1 · 辅助：highlightStats 动态增删（4 个数字 chip 编辑器）
 * ====================================================================== */
function addStat() {
  aboutDraft.value.highlightStats.push({ label: '', value: '' })
}
function removeStat(idx: number) {
  aboutDraft.value.highlightStats.splice(idx, 1)
}

/* ========================================================================
 *  Tab1 · 辅助：skillGroups 动态增删 + items/title/variant 编辑
 * ====================================================================== */
function addSkillGroup() {
  aboutDraft.value.skillGroups.push({
    id: Math.random().toString(36).slice(2, 9),
    title: '新分组',
    variant: 'default',
    items: [],
  })
}
function removeSkillGroup(idx: number) {
  aboutDraft.value.skillGroups.splice(idx, 1)
}

/* ========================================================================
 *  Tab1 · 脏检查（判断是否有改动，避免重复提交）
 * ====================================================================== */
const aboutDirty = computed(() => {
  // 直接把 draft 与 aboutStore.safeAbout 逐字段对比（浅字段 + 数组 JSON 序列化）
  const cur = aboutStore.safeAbout
  const d = aboutDraft.value
  if (d.displayName !== (cur.name ?? '')) return true
  if (d.shortBio !== (cur.shortBio ?? '')) return true
  if (d.location !== (cur.location ?? '')) return true
  if (d.available !== Boolean(cur.available)) return true
  if (JSON.stringify(d.longBio) !== JSON.stringify(cur.longBio ?? [])) return true
  if (JSON.stringify(d.tags) !== JSON.stringify(cur.tags ?? [])) return true
  if (JSON.stringify(d.interests) !== JSON.stringify(cur.interests ?? [])) return true
  if (JSON.stringify(d.nowDoing) !== JSON.stringify(cur.nowDoing ?? [])) return true
  if (
    JSON.stringify(d.highlightStats) !==
    JSON.stringify(
      (cur.highlightStats ?? []).map((s: HighlightStat) => ({
        label: s.label ?? '',
        value: s.value ?? '',
      })),
    )
  ) { return true }
  if (
    JSON.stringify(d.skillGroups) !==
    JSON.stringify(
      (cur.skillGroups ?? []).map((g: SkillGroup) => ({
        id: g.id ?? '',
        title: g.title ?? '',
        variant: ['default', 'secondary', 'outline'].includes(g.variant as any) ? g.variant : 'default',
        items: g.items ?? [],
      })),
    )
  ) { return true }
  // ===== 热力图配置 4 字段 =====
  if (d.heatmapSource !== (cur.heatmapSource ?? 'SITE')) return true
  if (d.heatmapEnableGithub !== Boolean(cur.heatmapEnableGithub)) return true
  if (d.githubUsername !== (cur.githubUsername ?? '')) return true
  if (d.githubLink !== (cur.githubLink ?? '')) return true
  return false
})

/* ========================================================================
 *  Tab1 · 保存 / 重置
 * ====================================================================== */

/**
 * 重置：把本地 draft 还原回 store 当前值
 */
function resetAboutDraft() {
  syncAboutFromStore()
  showFeedback('success', '已还原为当前线上展示内容')
}

/**
 * 保存：先 PUT /api/about（保存展示字段 + displayName→about_name 同步），
 *       再 POST /users/me（同步 nickname=displayName，确保账号昵称 ≡ About 展示名）。
 * 任一步失败都提示错误，不做"部分成功"提交。
 */
async function saveAboutDraft() {
  if (aboutSubmitting.value) return
  aboutSubmitting.value = true
  try {
    const d = aboutDraft.value

    // 校验：非空的核心字段
    if (!d.displayName.trim()) {
      throw new Error('展示名称不能为空')
    }
    if (d.highlightStats.some((s) => !s.label.trim() || !s.value.trim())) {
      throw new Error('数字统计 chip 里有空值，请填完整或删除空行')
    }
    if (d.skillGroups.some((g) => !g.title.trim())) {
      throw new Error('技能分组有空白标题，请填完整或删除空分组')
    }

    // Step 1: 保存 About 展示内容（displayName 写回后端的 about_name 字段）
    const savePayload: UpdateAboutParams & { name: string } = {
      name: d.displayName.trim(),
      shortBio: d.shortBio.trim(),
      location: d.location.trim(),
      available: d.available,
      longBio: d.longBio,
      tags: d.tags,
      interests: d.interests,
      nowDoing: d.nowDoing,
      highlightStats: d.highlightStats,
      skillGroups: d.skillGroups,
      // ===== 热力图配置（Phase 1 只有 heatmapSource 实际会被用户改动；其余字段保持写入以便后续 Phase 2 直接生效）=====
      heatmapSource: d.heatmapSource,
      heatmapEnableGithub: d.heatmapEnableGithub,
      githubUsername: (d.githubUsername ?? '').trim(),
      githubLink: (d.githubLink ?? '').trim(),
    }
    // aboutStore.saveAbout 参数类型是 UpdateAboutParams，但我们后端实际能收 name（
    // AboutServiceImpl 内部会把 name 写入 User.about_name）。做一次 as any 避免改接口。
    await aboutStore.saveAbout(savePayload as any)

    // 保存成功后清掉贡献热力图前端内存缓存（可能改了 heatmapSource / enableGithub / githubUsername，
    // 让 About 页下次进入重新拉后端最新数据）
    aboutStore.invalidateHeatmap()

    // Step 2: 同步账号昵称（nickname 始终 ≡ About 展示名）
    const newNickname = d.displayName.trim()
    if (newNickname !== (authStore.user?.nickname ?? '')) {
      await authStore.updateProfile({ nickname: newNickname })
    }

    showFeedback('success', '保存成功，关于我 / 首页 / 悬浮卡片已同步更新')
  } catch (e: any) {
    showFeedback('error', e?.message || '保存失败，请稍后重试')
  } finally {
    aboutSubmitting.value = false
  }
}

/* ========================================================================
 *  Tab1 + Tab2 共用：头像卡片（上传/清除/预览）
 *  头像是"账号头像 ≡ About 展示头像"，统一走 authStore.uploadAvatar/removeAvatar。
 * ====================================================================== */
// Tab1 和 Tab2 各有一套头像卡片；共用同一个 change handler，点击时两个 input 都点一次
// （浏览器只会实际弹出其中一个选择框）
const fileInputAbout = ref<HTMLInputElement | null>(null)
const fileInputAccount = ref<HTMLInputElement | null>(null)
const avatarPreview = ref<string | null>(null)
const avatarUploading = ref(false)

const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const MAX_SIZE = 5 * 1024 * 1024 // 5MB

function triggerUpload() {
  // 根据当前 Tab 点击对应 input，避免跨 Tab 的 DOM 不可见导致选择框不弹
  const el = activeTab.value === 'about' ? fileInputAbout.value : fileInputAccount.value
  el?.click()
}

/** 从 authStore 刷新头像预览（首次加载 / 上传成功 / 清除成功 都会调） */
function refreshAvatarPreview() {
  avatarPreview.value = authStore.resolveAvatarUrl(authStore.user?.avatar)
}
// 当 user.avatar 变化时（比如 Tab2 保存昵称/邮箱时也可能触发），刷新预览
watch(
  () => authStore.user?.avatar,
  () => refreshAvatarPreview(),
)
// authStore.user 首次加载后刷新一次（onMounted fetchProfile 之后立刻生效）
watch(
  () => authStore.user,
  (u) => { if (u) refreshAvatarPreview() },
  { immediate: true },
)

async function onFileChange(ev: Event) {
  const input = ev.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  input.value = ''

  if (!ALLOWED_MIMES.includes(file.type)) {
    showFeedback('error', '仅支持 JPG / PNG / WEBP / GIF 格式')
    return
  }
  if (file.size > MAX_SIZE) {
    showFeedback('error', '头像不能超过 5MB')
    return
  }

  // 先本地 blob 预览（立即给用户反馈）
  const localUrl = URL.createObjectURL(file)
  avatarPreview.value = localUrl

  avatarUploading.value = true
  try {
    await authStore.uploadAvatar(file)
    // 上传成功后，authStore.user.avatar 已更新 → watch 自动把预览切成正式 CDN/本地 URL
    showFeedback('success', '头像更新成功')
  } catch (e: any) {
    // 失败回滚
    refreshAvatarPreview()
    showFeedback('error', e?.message || '头像上传失败')
  } finally {
    avatarUploading.value = false
    // 释放本地 blob
    try { URL.revokeObjectURL(localUrl) } catch { /* noop */ }
  }
}

async function onRemoveAvatar() {
  try {
    await authStore.removeAvatar()
    refreshAvatarPreview()
    showFeedback('success', '头像已清除（页面将显示首字母占位）')
  } catch (e: any) {
    showFeedback('error', e?.message || '清除失败')
  }
}

/* ========================================================================
 *  Tab2 · 账号资料编辑器（原 ProfilePage 保留的内容）
 * ====================================================================== */
const accNickname = ref('')
const accEmail = ref<string>('')   // 空字符串 = 清空邮箱，不使用 null，避免 Input v-model 类型报错
const accSubmitting = ref(false)

/** 从 store 同步 Tab2 表单（挂载 / 保存后 / 点击"取消" 触发） */
function syncAccountFromStore() {
  const u = authStore.user
  if (!u) return
  // Tab2 nickname 与 Tab1 displayName 始终保持同源，先取账号的
  accNickname.value = u.nickname ?? u.username ?? ''
  // 后端 user.email 可能是 null —— 统一转 '' 给前端 Input 用
  accEmail.value = u.email ?? ''
}
// 首次 user 就绪时同步；Tab2 的 nickname 一旦变化也往 Tab1 displayName 推送，保持一致
watch(
  () => authStore.user,
  (u) => { if (u) syncAccountFromStore() },
  { immediate: true },
)
// Tab1 displayName 变化 → 同步 Tab2 nickname（同一份数据）
watch(
  () => aboutDraft.value.displayName,
  (v) => {
    if (accNickname.value !== v) accNickname.value = v
  },
)
// Tab2 nickname 变化 → 同步 Tab1 displayName（同一份数据）
watch(
  accNickname,
  (v) => {
    if (aboutDraft.value.displayName !== v) aboutDraft.value.displayName = v
  },
)

const accDirty = computed(() => {
  const u = authStore.user
  if (!u) return false
  const nickChanged = accNickname.value.trim() !== (u.nickname ?? u.username ?? '')
  // accEmail 现在是 string，后端 u.email 可能是 string | null，统一 '' 比较
  const emailChanged = accEmail.value !== (u.email ?? '')
  return nickChanged || emailChanged
})

async function saveAccount() {
  if (!accDirty.value || accSubmitting.value) return
  accSubmitting.value = true
  try {
    await authStore.updateProfile({
      nickname: accNickname.value.trim(),
      email: accEmail.value.trim() === '' ? '' : accEmail.value.trim(),
    })
    showFeedback('success', '账号资料已保存')
  } catch (e: any) {
    showFeedback('error', e?.message || '保存失败')
  } finally {
    accSubmitting.value = false
  }
}

function resetAccount() {
  syncAccountFromStore()
}
</script>

<template>
  <div class="max-w-6xl mx-auto space-y-6">

    <!-- ==================== 全局反馈 Toast ==================== -->
    <Transition name="toast-global">
      <div
        v-if="feedback"
        :role="feedback.type === 'error' ? 'alert' : 'status'"
        :class="[
          'fixed top-20 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl border shadow-lg text-sm max-w-[90%]',
          feedback.type === 'error'
            ? 'border-danger/30 bg-danger/5 text-danger'
            : 'border-success/30 bg-success/5 text-success',
        ]"
      >
        {{ feedback.message }}
      </div>
    </Transition>

    <!-- ==================== 页头 ==================== -->
    <div>
      <h1 class="text-2xl font-semibold tracking-tight">个人工作台</h1>
      <p class="mt-1 text-sm text-text-muted">
        在这里维护两个层面的信息：Tab1 面向访客的「关于我」展示内容，Tab2 是你的账号基础资料。
      </p>
    </div>

    <!-- ==================== Tabs 头部（手搓 pill 风格） ==================== -->
    <Card class="overflow-hidden">
      <div class="flex flex-wrap items-center gap-3 px-5 py-4 border-b border-border/60 bg-surface-muted/30">
        <div class="inline-flex rounded-lg p-1 bg-surface-muted/60 ring-1 ring-border/60">
          <button
            v-for="t in TABS"
            :key="t.key"
            type="button"
            class="relative inline-flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition"
            :class="[
              activeTab === t.key
                ? 'bg-brand text-brand-on shadow-sm'
                : 'text-text-muted hover:text-text hover:bg-surface/80',
            ]"
            @click="setTab(t.key)"
          >
            <Sparkles v-if="t.key === 'about'" class="size-3.5" />
            <UserIcon v-else class="size-3.5" />
            <span>{{ t.label }}</span>
          </button>
        </div>
        <p class="m-0 text-xs text-text-muted flex-1 min-w-0 truncate">
          {{ TABS.find((t) => t.key === activeTab)?.hint }}
        </p>

        <!-- 保存 / 重置按钮（根据当前 Tab 切换动作） -->
        <div class="flex items-center gap-2">
          <template v-if="activeTab === 'about'">
            <Button
              type="button"
              variant="secondary"
              :disabled="!aboutDirty || aboutSubmitting || aboutLoading"
              class="h-9 px-4"
              @click="resetAboutDraft"
            >
              <RotateCcw class="size-4" />
              <span>还原</span>
            </Button>
            <Button
              type="button"
              :disabled="!aboutDirty || aboutSubmitting || aboutLoading"
              class="h-9 px-4 shadow hover:shadow-md transition-shadow"
              @click="saveAboutDraft"
            >
              <Loader2 v-if="aboutSubmitting" class="size-4 animate-spin" />
              <Save v-else class="size-4" />
              <span>{{ aboutSubmitting ? '保存中…' : '保存展示内容' }}</span>
            </Button>
          </template>
          <template v-else>
            <Button
              type="button"
              variant="secondary"
              :disabled="!accDirty || accSubmitting"
              class="h-9 px-4"
              @click="resetAccount"
            >
              <RotateCcw class="size-4" />
              <span>还原</span>
            </Button>
            <Button
              type="button"
              :disabled="!accDirty || accSubmitting"
              class="h-9 px-4 shadow hover:shadow-md transition-shadow"
              @click="saveAccount"
            >
              <Loader2 v-if="accSubmitting" class="size-4 animate-spin" />
              <Save v-else class="size-4" />
              <span>{{ accSubmitting ? '保存中…' : '保存账号资料' }}</span>
            </Button>
          </template>
        </div>
      </div>

      <!-- ==================== Tab1 · 关于我展示编辑器 ==================== -->
      <CardContent v-if="activeTab === 'about'" class="p-0">
        <!-- 初次加载遮罩（等 authStore.user + aboutStore.fetchAbout 都回来） -->
        <div
          v-if="aboutLoading"
          class="px-5 py-16 flex flex-col items-center gap-3 text-text-muted"
        >
          <Loader2 class="size-5 animate-spin text-brand" />
          <p class="text-sm m-0">正在加载编辑内容…</p>
        </div>

        <template v-else>
          <!-- 主体三栏：左=头像卡；右=表单（桌面 grid / 移动堆叠） -->
          <div class="grid grid-cols-1 md:grid-cols-[320px_1fr] gap-6 p-5 md:p-6">

            <!-- ========= 左侧：头像卡片 ========= -->
            <div class="space-y-4">
              <Card class="p-5 flex flex-col items-center text-center gap-4 sticky top-24">
                 <!-- 圆形头像预览 -->
                 <div class="relative group">
                   <div class="size-32 md:size-36 rounded-full overflow-hidden ring-2 ring-brand/20 bg-surface-muted flex items-center justify-center transition-shadow group-hover:ring-brand/40 group-hover:shadow-md">
                     <img
                       v-if="avatarPreview"
                       :src="avatarPreview"
                       alt="avatar"
                       class="size-full object-cover"
                       @error="avatarPreview = null"
                     />
                     <UserCircle2 v-else class="size-[88px] text-brand/40" :stroke-width="1.5" />

                     <!-- Hover 遮罩（上传/清除） -->
                     <button
                       type="button"
                       class="absolute inset-0 flex flex-col items-center justify-center gap-1 rounded-full bg-black/50 text-white opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"
                       :disabled="avatarUploading"
                       @click="triggerUpload"
                       title="点击上传头像"
                     >
                       <Camera v-if="!avatarUploading" class="size-5" />
                       <Loader2 v-else class="size-5 animate-spin" />
                       <span class="text-[11px] font-medium">
                         {{ avatarUploading ? '上传中…' : '更换头像' }}
                       </span>
                     </button>
                   </div>
                 </div>
                <input
                  ref="fileInputAbout"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  class="hidden"
                  @change="onFileChange"
                />
                <!-- 操作区：纯图标按钮（hover 才显）+ 文字链接 -->
                <div class="flex items-center justify-center gap-3">
                  <!-- 选择头像：纯 Camera 图标，hover 才淡显 -->
                  <button
                    type="button"
                    class="group/avatar inline-flex items-center gap-1.5 text-[12px] text-text-muted hover:text-brand transition-colors"
                    title="点击更换头像"
                    @click="triggerUpload"
                  >
                    <Camera class="size-3.5" />
                    <span>更换</span>
                  </button>
                  <!-- 清除头像：danger 文字链接，无背景 -->
                  <button
                    v-if="authStore.user?.avatar"
                    type="button"
                    class="inline-flex items-center gap-1 text-[12px] text-danger/70 hover:text-danger transition-colors"
                    title="清除当前头像"
                    @click="onRemoveAvatar"
                  >
                    <X class="size-3" />
                    <span>清除</span>
                  </button>
                </div>
                <p class="text-[11px] text-text-muted/70 leading-relaxed m-0">
                  展示头像 ≡ 账号头像<br>
                  支持 JPG / PNG / WEBP / GIF · 最大 5MB
                </p>
              </Card>
            </div>

            <!-- ========= 右侧：About 展示字段编辑器 ========= -->
            <div class="space-y-6 min-w-0">

              <!-- Section · 个人基本展示信息 -->
              <section class="space-y-5">
                <div>
                  <h3 class="m-0 text-sm font-semibold tracking-tight">个人基本信息</h3>
                  <p class="mt-1 text-xs text-text-muted">显示在 AboutPage 页头 &amp; 首页 Hero 大标题下。</p>
                </div>

                <!-- displayName · inline -->
                <div class="flex items-center gap-4 py-2">
                  <Label class="w-28 shrink-0 text-sm font-medium text-text">展示名称</Label>
                  <Input v-model="aboutDraft.displayName" maxlength="40" placeholder="比如：Trae" class="flex-1" />
                  <span class="shrink-0 text-[11px] text-text-muted/70">与账号昵称同步</span>
                </div>

                <!-- shortBio · inline（textarea Label top-aligned） -->
                <div class="flex gap-4 py-2">
                  <Label class="w-28 shrink-0 text-sm font-medium text-text pt-2">一句话简介</Label>
                  <textarea
                    v-model="aboutDraft.shortBio"
                    rows="2"
                    maxlength="200"
                    placeholder="一句话描述自己，约 30~60 字为宜"
                    class="block min-h-[3.5rem] flex-1 rounded-md border border-border bg-surface-elevated px-3 py-2 text-sm shadow-sm placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:cursor-not-allowed disabled:opacity-50 resize-y"
                  />
                </div>

                <!-- location · inline -->
                <div class="flex items-center gap-4 py-2">
                  <Label class="w-28 shrink-0 text-sm font-medium text-text">所在地</Label>
                  <Input
                    v-model="aboutDraft.location"
                    maxlength="80"
                    placeholder="例：中国 · 远程协作友好 (UTC+8)"
                    class="flex-1"
                  />
                </div>

                <!-- available：独立一行（用新 Switch 组件 · Radix 驱动） -->
                <div class="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-surface-elevated/50 px-4 py-3">
                  <div class="space-y-0.5 min-w-0">
                    <Label class="text-sm font-medium text-text">可接项目</Label>
                    <p class="text-[11px] text-text-muted m-0">控制 About 页 Hero 区的「可接单」状态 Badge</p>
                  </div>
                  <div class="flex items-center gap-3 shrink-0">
                    <Switch v-model:checked="aboutDraft.available" variant="success" />
                    <span
                      class="text-[12px] font-medium whitespace-nowrap"
                      :class="aboutDraft.available ? 'text-emerald-600 dark:text-emerald-400' : 'text-text-muted'"
                    >
                      {{ aboutDraft.available ? '开放中' : '排期满' }}
                    </span>
                  </div>
                </div>

                <!-- tags chip 输入 · inline -->
                <div class="flex gap-4 py-2">
                  <Label class="w-28 shrink-0 text-sm font-medium text-text pt-2">身份标签</Label>
                  <div class="flex-1 space-y-2 rounded-md border border-border bg-surface-elevated px-3 py-2 focus-within:ring-2 focus-within:ring-brand focus-within:ring-offset-2 focus-within:ring-offset-surface">
                    <input
                      class="w-full bg-transparent text-sm outline-none placeholder:text-text-muted py-1"
                      placeholder="输入后回车或逗号新增：Vue 3, TypeScript, Tailwind…"
                      @keydown.enter.prevent="(e: any) => { addChip(aboutDraft.tags, e.target.value); e.target.value = '' }"
                      @keydown.comma.prevent="(e: any) => { addChip(aboutDraft.tags, e.target.value); e.target.value = '' }"
                    />
                    <div v-if="aboutDraft.tags.length" class="flex flex-wrap gap-1.5 pt-1 pb-0.5">
                      <span
                        v-for="(tag, idx) in aboutDraft.tags"
                        :key="tag + idx"
                        class="inline-flex items-center gap-1 rounded-full bg-brand/10 text-brand text-xs px-2.5 py-1 ring-1 ring-brand/20"
                      >
                        {{ tag }}
                        <button
                          type="button"
                          class="size-3.5 inline-flex items-center justify-center rounded-full hover:bg-brand/20 transition"
                          @click="removeChip(aboutDraft.tags, idx)"
                          aria-label="删除标签"
                        >
                          <X class="size-2.5" />
                        </button>
                      </span>
                    </div>
                  </div>
                </div>
              </section>

              <!-- Section · 长文 & Now Doing -->
              <section class="space-y-5">
                <div>
                  <h3 class="m-0 text-sm font-semibold tracking-tight">长文介绍 &amp; 现在在做什么</h3>
                  <p class="mt-1 text-xs text-text-muted">
                    每行一段；Now Doing 里的每行允许 <code class="px-1 rounded bg-surface-muted text-[10.5px]">**粗体**</code> 语法。
                  </p>
                </div>

                <!-- longBio · inline textarea -->
                <div class="flex gap-4 py-2">
                  <Label class="w-28 shrink-0 text-sm font-medium text-text pt-2">关于我</Label>
                  <textarea
                    v-model="longBioText"
                    rows="5"
                    placeholder="第一段落…&#10;第二段落…"
                    class="block w-full flex-1 rounded-md border border-border bg-surface-elevated px-3 py-2 text-sm shadow-sm placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:cursor-not-allowed disabled:opacity-50 resize-y font-sans leading-relaxed"
                  />
                </div>

                <!-- nowDoing · inline textarea -->
                <div class="flex gap-4 py-2">
                  <Label class="w-28 shrink-0 text-sm font-medium text-text pt-2">现在在做</Label>
                  <textarea
                    v-model="nowDoingText"
                    rows="4"
                    placeholder="🪴 **产品**：xxx 项目模板…&#10;📝 **写作**：保持 2~3 篇 / 月…"
                    class="block w-full flex-1 rounded-md border border-border bg-surface-elevated px-3 py-2 text-sm shadow-sm placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:cursor-not-allowed disabled:opacity-50 resize-y font-mono leading-relaxed"
                  />
                </div>
              </section>

              <!-- Section · 数字统计 highlightStats（4 chip 动态增删） -->
              <section class="space-y-4">
                <div class="flex items-end justify-between gap-3 flex-wrap">
                  <div>
                    <h3 class="m-0 text-sm font-semibold tracking-tight">数字统计 highlightStats</h3>
                    <p class="mt-1 text-xs text-text-muted">AboutPage 页头下方 &amp; 首页 Hero 下方的 4 个方形 chip；建议 2~6 个。</p>
                  </div>
                  <Button type="button" variant="default" class="shadow hover:shadow-md transition-shadow" @click="addStat">
                    <Plus class="size-3.5" /><span>新增一行</span>
                  </Button>
                </div>

                <div v-if="!aboutDraft.highlightStats.length" class="rounded-md border border-dashed border-border/80 bg-surface-muted/20 px-4 py-8 text-center text-xs text-text-muted">
                  还没有数字统计，点右上角「新增一行」开始添加。
                </div>

                <div v-else class="space-y-2">
                    <div
                      v-for="(stat, idx) in aboutDraft.highlightStats"
                      :key="idx"
                      class="flex items-center gap-4 py-2 border-b border-border/60 last:border-b-0"
                    >
                      <Label class="w-20 shrink-0 text-sm font-medium text-text">标签</Label>
                      <Input v-model="stat.label" placeholder="例如：年前端经验" class="flex-1" />
                      <Label class="w-20 shrink-0 text-sm font-medium text-text text-right">数值</Label>
                      <Input v-model="stat.value" placeholder="例如：5+ 或 3.2k" class="flex-1" />
                      <button
                        type="button"
                        class="shrink-0 size-8 rounded-md border border-transparent text-text-muted hover:text-danger hover:bg-danger/10 transition inline-flex items-center justify-center"
                        :disabled="aboutDraft.highlightStats.length <= 1"
                        :title="aboutDraft.highlightStats.length <= 1 ? '至少保留 1 行' : '删除此行'"
                        @click="removeStat(idx)"
                      >
                        <Minus class="size-3.5" />
                      </button>
                    </div>
                  </div>
              </section>

              <!-- Section · 兴趣标签 interests（chip） -->
              <section class="space-y-2">
                <div>
                  <h3 class="m-0 text-sm font-semibold tracking-tight">最近感兴趣 interests</h3>
                  <p class="mt-1 text-xs text-text-muted">AboutPage 底部「最近感兴趣」chip 列表</p>
                </div>
                <div class="space-y-2 rounded-md border border-border bg-surface-elevated px-3 py-2 focus-within:ring-2 focus-within:ring-brand focus-within:ring-offset-2 focus-within:ring-offset-surface">
                  <input
                    class="w-full bg-transparent text-sm outline-none placeholder:text-text-muted py-1"
                    placeholder="输入后回车或逗号新增：AI Copilot, 3D 可视化…"
                    @keydown.enter.prevent="(e: any) => { addChip(aboutDraft.interests, e.target.value); e.target.value = '' }"
                    @keydown.comma.prevent="(e: any) => { addChip(aboutDraft.interests, e.target.value); e.target.value = '' }"
                  />
                  <div v-if="aboutDraft.interests.length" class="flex flex-wrap gap-1.5 pt-1 pb-0.5">
                    <span
                      v-for="(topic, idx) in aboutDraft.interests"
                      :key="topic + idx"
                      class="inline-flex items-center gap-1 rounded-full border border-brand/30 bg-brand/5 text-brand text-xs px-2.5 py-1"
                    >
                      <Heart class="size-3 mr-0.5" />
                      {{ topic }}
                      <button
                        type="button"
                        class="size-3.5 inline-flex items-center justify-center rounded-full hover:bg-brand/15 transition"
                        @click="removeChip(aboutDraft.interests, idx)"
                        aria-label="删除兴趣"
                      >
                        <X class="size-2.5" />
                      </button>
                    </span>
                  </div>
                </div>
              </section>

              <!-- Section · 技能栈 skillGroups（动态增删分组） -->
              <section class="space-y-4">
                <div class="flex items-end justify-between gap-3 flex-wrap">
                  <div>
                    <h3 class="m-0 text-sm font-semibold tracking-tight">技能 &amp; 工具 skillGroups</h3>
                    <p class="mt-1 text-xs text-text-muted">
                      AboutPage 的「技能 &amp; 工具」分区，建议 3~4 组；variant 控制 badges 颜色风格。
                    </p>
                  </div>
                  <Button type="button" variant="default" class="shadow hover:shadow-md transition-shadow" @click="addSkillGroup">
                    <Plus class="size-3.5" /><span>新增分组</span>
                  </Button>
                </div>

                <div
                   v-for="(grp, gIdx) in aboutDraft.skillGroups"
                   :key="grp.id"
                   class="rounded-md border border-border bg-surface-elevated p-4 space-y-3"
                 >
                   <!-- 分组标题 + variant · inline -->
                   <div class="flex items-center gap-4">
                     <Label class="w-20 shrink-0 text-sm font-medium text-text">分组</Label>
                     <Input v-model="grp.title" placeholder="例：前端框架" class="flex-1" />
                     <Label class="shrink-0 text-sm font-medium text-text">样式</Label>
                     <select
                       v-model="grp.variant"
                       class="h-9 w-[140px] rounded-md border border-border bg-surface px-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
                     >
                       <option value="default">品牌色</option>
                       <option value="secondary">灰底</option>
                       <option value="outline">描边</option>
                     </select>
                     <button
                       type="button"
                       class="shrink-0 size-8 rounded-md border border-transparent text-text-muted hover:text-danger hover:bg-danger/10 transition inline-flex items-center justify-center"
                       :disabled="aboutDraft.skillGroups.length <= 1"
                       :title="aboutDraft.skillGroups.length <= 1 ? '至少保留 1 组' : '删除此分组'"
                       @click="removeSkillGroup(gIdx)"
                     >
                       <Minus class="size-3.5" />
                     </button>
                   </div>

                  <div class="space-y-2 rounded-md bg-surface-muted/30 border border-border/60 px-3 py-2 focus-within:ring-2 focus-within:ring-brand focus-within:ring-offset-2 focus-within:ring-offset-surface">
                    <input
                      class="w-full bg-transparent text-xs outline-none placeholder:text-text-muted py-1"
                      placeholder="输入技能名称后回车 / 逗号新增：Vue 3, React, Svelte…"
                      @keydown.enter.prevent="(e: any) => { addChip(grp.items, e.target.value); e.target.value = '' }"
                      @keydown.comma.prevent="(e: any) => { addChip(grp.items, e.target.value); e.target.value = '' }"
                    />
                    <div v-if="grp.items.length" class="flex flex-wrap gap-1.5 pt-1 pb-0.5">
                      <span
                        v-for="(item, idx) in grp.items"
                        :key="item + idx"
                        class="inline-flex items-center gap-1 rounded-md text-[11px] px-2.5 py-1"
                        :class="[
                          grp.variant === 'secondary' ? 'bg-surface-muted text-text ring-1 ring-border/60' : '',
                          grp.variant === 'outline'   ? 'bg-surface text-text ring-1 ring-border' : '',
                          grp.variant === 'default'   ? 'bg-brand/10 text-brand ring-1 ring-brand/20' : '',
                        ]"
                      >
                        {{ item }}
                        <button
                          type="button"
                          class="size-3.5 inline-flex items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition"
                          @click="removeChip(grp.items, idx)"
                          aria-label="删除技能"
                        >
                          <X class="size-2.5" />
                        </button>
                      </span>
                    </div>
                  </div>
                </div>

                <div v-if="!aboutDraft.skillGroups.length" class="rounded-md border border-dashed border-border/80 bg-surface-muted/20 px-4 py-8 text-center text-xs text-text-muted">
                  还没有技能分组，点右上角「新增分组」开始添加。
                </div>
              </section>

              <!-- =========================
                   · 热力图配置 Section ·
                   Phase 1 仅「默认显示源」可编辑，
                   GitHub 相关三项标记为 Phase 2 disabled，
                   便于后续升级时无需改表单结构。
                   ========================= -->
              <section class="space-y-4 pt-6">
                <div class="flex items-end justify-between gap-3 flex-wrap">
                  <div>
                    <h3 class="m-0 text-sm font-semibold tracking-tight">贡献热力图配置</h3>
                    <p class="mt-1 text-xs text-text-muted">
                      控制 About 页贡献热力图的显示源和 GitHub 数据来源。
                    </p>
                  </div>
                </div>

                <div class="space-y-4 rounded-md border border-border bg-surface-elevated p-4">
                  <!-- 1. 显示源 · inline -->
                  <div class="flex items-center gap-4 py-1">
                    <Label class="w-28 shrink-0 text-sm font-medium text-text">默认显示源</Label>
                    <select
                      v-model="aboutDraft.heatmapSource"
                      class="h-9 flex-1 rounded-md border border-border bg-surface px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
                    >
                      <option value="SITE">本站贡献（博客 / 生活 / 笔记）</option>
                      <option value="GITHUB">GitHub 贡献</option>
                      <option value="MERGED">合并视图（本站 + GitHub）</option>
                    </select>
                  </div>

                  <!-- 2. 启用 GitHub · inline + Switch 组件 -->
                  <div class="flex items-center justify-between gap-4 py-1">
                    <Label class="w-28 shrink-0 text-sm font-medium text-text">启用 GitHub</Label>
                    <div class="flex-1 flex items-center gap-3">
                      <Switch v-model:checked="aboutDraft.heatmapEnableGithub" variant="default" />
                      <span
                        class="text-[12px] font-medium"
                        :class="aboutDraft.heatmapEnableGithub ? 'text-success' : 'text-text-muted'"
                      >
                        {{ aboutDraft.heatmapEnableGithub ? '已启用 · GitHub / 合并 Tab 可用' : '已关闭 · 回退本站数据' }}
                      </span>
                    </div>
                  </div>

                  <!-- 3. GitHub 用户名 · inline -->
                  <div class="flex items-center gap-4 py-1">
                    <Label class="w-28 shrink-0 text-sm font-medium text-text">GitHub 用户名</Label>
                    <Input v-model="aboutDraft.githubUsername" placeholder="例：TE-Fire" class="flex-1" />
                  </div>

                  <!-- 4. GitHub 链接 · inline -->
                  <div class="flex items-center gap-4 py-1">
                    <Label class="w-28 shrink-0 text-sm font-medium text-text">GitHub 主页</Label>
                    <Input v-model="aboutDraft.githubLink" placeholder="例：https://github.com/TE-Fire" class="flex-1" />
                  </div>
                </div>
              </section>

            </div>
          </div>
        </template>
      </CardContent>

      <!-- ==================== Tab2 · 账号资料 ==================== -->
      <CardContent v-else class="p-5 md:p-6">
        <div class="grid grid-cols-1 md:grid-cols-[320px_1fr] gap-6">
          <!-- 左栏：头像卡片（与 Tab1 共用的同一份上传逻辑，保持同步） -->
          <Card class="p-5 flex flex-col items-center text-center gap-4 sticky top-24">
            <!-- 圆形头像预览 + hover 遮罩触发上传 -->
            <div class="relative group">
              <div class="size-32 md:size-36 rounded-full overflow-hidden ring-2 ring-brand/20 bg-surface-muted flex items-center justify-center transition-shadow group-hover:ring-brand/40 group-hover:shadow-md">
                <img
                  v-if="avatarPreview"
                  :src="avatarPreview"
                  alt="avatar"
                  class="size-full object-cover"
                  @error="avatarPreview = null"
                />
                <UserCircle2 v-else class="size-[100px] text-brand/40" :stroke-width="1.5" />
                <!-- hover 遮罩 -->
                <button
                  type="button"
                  class="absolute inset-0 flex flex-col items-center justify-center gap-1 rounded-full bg-black/50 text-white opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"
                  :disabled="avatarUploading"
                  @click="triggerUpload"
                  title="点击更换头像"
                >
                  <Camera v-if="!avatarUploading" class="size-5" />
                  <Loader2 v-else class="size-5 animate-spin" />
                  <span class="text-[11px] font-medium">
                    {{ avatarUploading ? '上传中…' : '更换头像' }}
                  </span>
                </button>
              </div>
            </div>
            <input
              ref="fileInputAccount"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              class="hidden"
              @change="onFileChange"
            />
            <!-- 操作区：纯图标/文字链接（无背景无阴影） -->
            <div class="flex items-center justify-center gap-3">
              <button
                type="button"
                class="inline-flex items-center gap-1.5 text-[12px] text-text-muted hover:text-brand transition-colors"
                title="点击更换头像"
                @click="triggerUpload"
              >
                <Camera class="size-3.5" />
                <span>更换</span>
              </button>
              <button
                v-if="authStore.user?.avatar"
                type="button"
                class="inline-flex items-center gap-1 text-[12px] text-danger/70 hover:text-danger transition-colors"
                title="清除当前头像"
                @click="onRemoveAvatar"
              >
                <X class="size-3" />
                <span>清除</span>
              </button>
            </div>
            <p class="text-[11px] text-text-muted/70 leading-relaxed m-0">
              支持 JPG / PNG / WEBP / GIF · 最大 5MB
            </p>
          </Card>

          <!-- 右栏：表单 · 全部 inline -->
          <Card class="p-6 space-y-3">
            <!-- username -->
            <div class="flex items-center gap-4 py-1">
              <Label class="w-24 shrink-0 text-sm font-medium text-text">
                用户名 <span class="text-[10.5px] text-text-muted/50 font-normal">不可修改</span>
              </Label>
              <Input
                :value="authStore.user?.username ?? ''"
                disabled
                class="flex-1 opacity-60 cursor-not-allowed"
              />
            </div>
            <!-- nickname -->
            <div class="flex items-center gap-4 py-1">
              <Label class="w-24 shrink-0 text-sm font-medium text-text">
                昵称 <span class="text-[10.5px] text-text-muted/50 font-normal">与 Tab1 同步</span>
              </Label>
              <Input v-model="accNickname" maxlength="50" placeholder="显示名称" class="flex-1" />
            </div>
            <!-- email -->
            <div class="flex items-center gap-4 py-1">
              <Label class="w-24 shrink-0 text-sm font-medium text-text">
                邮箱 <span class="text-[10.5px] text-text-muted/50 font-normal">留空清除</span>
              </Label>
              <Input
                v-model="accEmail"
                type="email"
                maxlength="100"
                placeholder="you@example.com"
                class="flex-1"
              />
            </div>
            <!-- role -->
            <div class="flex items-center gap-4 py-1">
              <Label class="w-24 shrink-0 text-sm font-medium text-text">角色</Label>
              <div class="flex-1 flex items-center gap-2">
                <span class="inline-flex items-center gap-1.5 text-sm px-2.5 py-1 rounded-full bg-brand/10 text-brand ring-1 ring-brand/30">
                  <Check class="size-3.5" />
                  {{ authStore.user?.role === 'admin' ? '管理员' : authStore.user?.role }}
                </span>
              </div>
            </div>
          </Card>
        </div>
      </CardContent>
    </Card>
  </div>
</template>

<style scoped>
/* 全局反馈过渡 */
.toast-global-enter-active,
.toast-global-leave-active {
  transition: opacity 0.2s ease, transform 0.28s cubic-bezier(0.22, 1, 0.36, 1);
}
.toast-global-enter-from,
.toast-global-leave-to {
  opacity: 0;
  transform: translate(-50%, -8px);
}

@media (prefers-reduced-motion: reduce) {
  .toast-global-enter-active,
  .toast-global-leave-active { transition: none; }
  .toast-global-enter-from,
  .toast-global-leave-to { transform: translate(-50%, 0); }
}
</style>
