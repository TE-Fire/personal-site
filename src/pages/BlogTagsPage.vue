<script setup lang="ts">
/**
 * BlogTagsPage · 标签管理（v3 · Command Deck 布局）
 * 左侧固定 Command Deck 侧栏 + 右侧沉浸式 3D 星链视图
 */
import { computed, ref, type Directive } from 'vue'
import { useRouter } from 'vue-router'
import { useBlogApi } from '@/composables/useBlogApi'
import TagNetwork3D from '@/components/TagNetwork3D.vue'
import { Button, Input } from '@/components/ui'
import {
  Hash,
  ArrowLeft,
  Plus,
  Search,
  Pencil,
  Trash2,
  ArrowDownUp,
  X,
  Check,
  Tags as TagsIcon,
  BarChart3,
  Sparkles,
  Star,
  Filter,
  Sparkle,
  Orbit,
  Compass,
  Rocket,
  Binary,
  Palette,
  Flame
} from 'lucide-vue-next'

const router = useRouter()
const { allTagsWithCount, addTag, renameTag, mergeTag, deleteTag, allPosts } = useBlogApi()

const totalTags = computed(() => allTagsWithCount.value.length)
const totalPosts = computed(() => allPosts.value.length)
const avgTagsPerPost = computed(() => {
  if (totalPosts.value === 0) return 0
  const uses = allPosts.value.reduce((acc, p) => acc + p.tags.length, 0)
  return Math.round((uses / totalPosts.value) * 10) / 10
})

const searchQuery = ref('')
const selectedTag = ref<string | null>(null)
const tagNetworkRef = ref<InstanceType<typeof TagNetwork3D> | null>(null)

const filteredTags = computed(() => {
  if (!searchQuery.value.trim()) return allTagsWithCount.value
  const q = searchQuery.value.toLowerCase()
  return allTagsWithCount.value.filter((t) => t.name.toLowerCase().includes(q))
})

function onSelectTag(name: string) {
  selectedTag.value = selectedTag.value === name ? null : name
}
function clearSelection() {
  selectedTag.value = null
  cancelRename()
  cancelDelete()
  cancelMerge()
}

/* ---------- 新建 ---------- */
const creating = ref(false)
const newTagName = ref('')
function startCreate() { creating.value = true; newTagName.value = '' }
function cancelCreate() { creating.value = false; newTagName.value = '' }
function confirmCreate() {
  const name = newTagName.value.trim()
  if (name) addTag(name)
  cancelCreate()
}

/* ---------- 重命名 ---------- */
const renaming = ref(false)
const renameValue = ref('')
function startRename() { renaming.value = true; renameValue.value = selectedTag.value ?? '' }
function cancelRename() { renaming.value = false; renameValue.value = '' }
function confirmRename() {
  if (selectedTag.value && renameValue.value.trim()) renameTag(selectedTag.value, renameValue.value.trim())
  cancelRename()
}

/* ---------- 删除 ---------- */
const deleting = ref(false)
function startDelete() { deleting.value = true }
function cancelDelete() { deleting.value = false }
function confirmDelete() {
  if (selectedTag.value) { deleteTag(selectedTag.value); clearSelection() }
  cancelDelete()
}

/* ---------- 合并 ---------- */
const merging = ref(false)
const mergeTarget = ref('')
function startMerge() { merging.value = true; mergeTarget.value = '' }
function cancelMerge() { merging.value = false; mergeTarget.value = '' }
function confirmMerge() {
  if (selectedTag.value && mergeTarget.value && mergeTarget.value !== selectedTag.value) {
    mergeTag(selectedTag.value, mergeTarget.value)
    clearSelection()
  }
  cancelMerge()
}
const mergeOptions = computed(() => {
  if (!selectedTag.value) return []
  return allTagsWithCount.value.filter((t) => t.name !== selectedTag.value).map((t) => t.name)
})

const selectedInfo = computed(() => {
  if (!selectedTag.value) return null
  return allTagsWithCount.value.find((t) => t.name === selectedTag.value) || null
})
const editableTagNames = computed(() => {
  const set = new Set<string>()
  allPosts.value.forEach((p) => { if (p.source === 'user') p.tags.forEach((t) => set.add(t)) })
  allTagsWithCount.value.forEach((t) => { if (t.count === 0) set.add(t.name) })
  return set
})
const canEdit = computed(() => selectedTag.value ? editableTagNames.value.has(selectedTag.value) : false)
const isBuiltInOnly = computed(() => {
  if (!selectedTag.value) return false
  return !allPosts.value.some((p) => p.source === 'user' && p.tags.includes(selectedTag.value!))
})

const vFocus: Directive<HTMLElement> = {
  mounted: (el) => el.focus()
}

/* ---------- 快捷统计 ---------- */
const hotTags = computed(() => [...allTagsWithCount.value].sort((a, b) => b.count - a.count).slice(0, 5))

/* ---------- 3D 星链联动 ---------- */
const hoveredTagLabel = computed(() => {
  const hovered = (tagNetworkRef.value?.hoveredTag as any)?.value
  return hovered ? `#${hovered}` : null
})
</script>

<template>
  <div class="relative w-full h-[calc(100vh-6rem)] min-h-[600px] overflow-hidden bg-surface">
    <!-- ============== 左侧 Command Deck ============== -->
    <aside class="absolute top-0 left-0 bottom-0 z-30 w-[260px] flex flex-col border-r border-border/50 bg-surface/95 backdrop-blur-xl shadow-2xl">
      <!-- 顶部 Logo + 返回 -->
      <div class="px-5 py-4 border-b border-border/50">
        <div class="flex items-center justify-between mb-3">
          <Button
            variant="ghost"
            size="sm"
            class="gap-1.5 -ml-2 text-text-muted hover:text-text"
            @click="router.push('/blog')"
          >
            <ArrowLeft class="size-3.5" />
            <span class="text-xs">返回</span>
          </Button>
          <div class="size-7 rounded-lg bg-brand/10 flex items-center justify-center">
            <Hash class="size-3.5 text-brand" />
          </div>
        </div>
        <h1 class="text-base font-bold text-text flex items-center gap-1.5">
          <Orbit class="size-4 text-brand" />
          标签星链
        </h1>
        <p class="text-[11px] text-text-muted mt-0.5 flex items-center gap-1">
          <Compass class="size-3" />
          Command Deck
        </p>
      </div>

      <!-- 统计矩阵 -->
      <div class="px-4 py-3 border-b border-border/50">
        <div class="grid grid-cols-3 gap-2">
          <div class="stat-tile bg-brand/5 border-brand/20">
            <TagsIcon class="size-3 text-brand" />
            <div class="text-base font-bold text-text leading-none mt-0.5">{{ totalTags }}</div>
            <div class="text-[10px] text-text-muted mt-0.5">标签</div>
          </div>
          <div class="stat-tile bg-accent/5 border-accent/20">
            <BarChart3 class="size-3 text-accent" />
            <div class="text-base font-bold text-text leading-none mt-0.5">{{ totalPosts }}</div>
            <div class="text-[10px] text-text-muted mt-0.5">文章</div>
          </div>
          <div class="stat-tile bg-purple-500/5 border-purple-500/20">
            <Sparkles class="size-3 text-purple-500" />
            <div class="text-base font-bold text-text leading-none mt-0.5">{{ avgTagsPerPost }}</div>
            <div class="text-[10px] text-text-muted mt-0.5">均/篇</div>
          </div>
        </div>
      </div>

      <!-- 热点标签 Top 5 -->
      <div class="px-4 py-3 border-b border-border/50">
        <div class="flex items-center gap-1.5 text-xs font-semibold text-text-muted mb-2">
          <Flame class="size-3 text-accent" />
          热点 Top 5
        </div>
        <div class="space-y-1.5">
          <button
            v-for="(t, idx) in hotTags"
            :key="t.name"
            class="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left transition-all"
            :class="selectedTag === t.name ? 'bg-brand/15 text-brand' : 'hover:bg-brand/8 text-text hover:text-brand'"
            @click="onSelectTag(t.name)"
          >
            <span
              class="size-4 rounded flex items-center justify-center text-[10px] font-bold shrink-0"
              :class="{
                'bg-gradient-to-br from-amber-400 to-orange-500 text-white': idx === 0,
                'bg-gradient-to-br from-slate-300 to-slate-400 text-white': idx === 1,
                'bg-gradient-to-br from-orange-400 to-amber-600 text-white': idx === 2,
                'bg-brand/15 text-brand': idx > 2
              }"
            >{{ idx + 1 }}</span>
            <span class="truncate flex-1 text-xs font-medium">{{ t.name }}</span>
            <span class="text-[10px] text-text-muted tabular-nums shrink-0">{{ t.count }}</span>
          </button>
          <div v-if="hotTags.length === 0" class="text-[11px] text-text-muted text-center py-2">暂无标签</div>
        </div>
      </div>

      <!-- 搜索 + 创建 -->
      <div class="px-4 py-3 border-b border-border/50 space-y-2">
        <div class="relative">
          <Search class="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 size-3 text-text-muted" />
          <Input
            v-model="searchQuery"
            placeholder="筛选星球…"
            class="pl-7 h-8 text-xs"
          />
        </div>

        <div v-if="!creating">
          <Button
            size="sm"
            class="w-full gap-1.5 h-8 text-xs"
            @click="startCreate"
          >
            <Plus class="size-3.5" />
            创建新标签
          </Button>
        </div>
        <div v-else class="space-y-2">
          <Input
            v-model="newTagName"
            placeholder="输入标签名称"
            class="h-8 text-xs"
            @keyup.enter="confirmCreate"
            @keyup.esc="cancelCreate"
            v-focus
          />
          <div class="flex gap-2">
            <Button size="sm" variant="outline" class="flex-1 h-7 text-xs" @click="cancelCreate">
              取消
            </Button>
            <Button size="sm" class="flex-1 h-7 text-xs" :disabled="!newTagName.trim()" @click="confirmCreate">
              <Check class="size-3" />
              确认
            </Button>
          </div>
        </div>
      </div>

      <!-- 标签列表 -->
      <div class="flex-1 overflow-hidden flex flex-col min-h-0">
        <div class="px-4 py-2 flex items-center justify-between">
          <div class="flex items-center gap-1.5 text-xs font-semibold text-text-muted">
            <Filter class="size-3" />
            全部标签
          </div>
          <span class="text-[10px] text-brand font-mono">{{ filteredTags.length }}</span>
        </div>
        <div class="flex-1 overflow-auto px-3 pb-3 space-y-0.5 custom-scroll">
          <button
            v-for="t in filteredTags"
            :key="t.name"
            class="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs text-text text-left transition-all"
            :class="selectedTag === t.name
              ? 'bg-brand text-white shadow-md shadow-brand/30'
              : 'hover:bg-brand/10 hover:text-brand'"
            @click="onSelectTag(t.name)"
          >
            <Hash class="size-3 shrink-0 opacity-60" />
            <span class="truncate flex-1">{{ t.name }}</span>
            <span class="text-[10px] tabular-nums shrink-0 px-1.5 py-0.5 rounded"
              :class="selectedTag === t.name ? 'bg-white/20' : 'bg-brand/10 text-brand'">
              {{ t.count }}
            </span>
          </button>
          <div v-if="filteredTags.length === 0" class="text-center text-[11px] text-text-muted py-4">
            没有匹配的标签
          </div>
        </div>
      </div>

      <!-- 底部操作提示 -->
      <div class="px-4 py-3 border-t border-border/50 bg-surface/50">
        <div class="flex items-center gap-1.5 text-[10px] text-text-muted leading-relaxed">
          <span class="inline-block size-1.5 rounded-full bg-brand animate-pulse shrink-0" />
          拖动画布旋转 · 点击星球管理 · 双击重置视角
        </div>
      </div>
    </aside>

    <!-- ============== 右侧：沉浸式 3D 视图 ============== -->
    <main class="absolute top-0 right-0 bottom-0 left-[260px]">
      <!-- 3D 画布 -->
      <TagNetwork3D
        ref="tagNetworkRef"
        :tags="filteredTags"
        :posts="allPosts"
        class="absolute inset-0 z-0"
        @select-tag="onSelectTag"
      />

      <!-- 顶部浮层：页面标题 + 操作 -->
      <header class="absolute top-0 left-0 right-0 z-20 px-6 py-3 flex items-center justify-between pointer-events-none">
        <div class="pointer-events-auto flex items-center gap-3">
          <div class="flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface/70 backdrop-blur-md border border-border/50">
            <span class="inline-block size-1.5 rounded-full bg-brand animate-pulse" />
            <span class="text-xs font-medium text-text">星域激活中</span>
          </div>
          <div v-if="hoveredTagLabel" class="flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand/10 backdrop-blur-md border border-brand/30 animate-pulse">
            <Sparkle class="size-3 text-brand" />
            <span class="text-xs font-medium text-brand">{{ hoveredTagLabel }}</span>
          </div>
        </div>

        <div class="pointer-events-auto flex items-center gap-2">
          <div class="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface/70 backdrop-blur-md border border-border/50">
            <Rocket class="size-3.5 text-brand" />
            <span class="text-xs font-medium text-text">v3.0</span>
          </div>
        </div>
      </header>

      <!-- 左下：图例 -->
      <div class="absolute bottom-6 left-6 z-20 pointer-events-none">
        <div class="px-4 py-3 rounded-xl bg-surface/80 backdrop-blur-xl border border-border/60 shadow-lg space-y-2">
          <div class="text-[10px] font-semibold text-text-muted uppercase tracking-wider">节点图例</div>
          <div class="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px]">
            <div class="flex items-center gap-1.5">
              <span class="inline-block size-2.5 rounded-full bg-purple-400" />
              <span class="text-text">1-2 次</span>
            </div>
            <div class="flex items-center gap-1.5">
              <span class="inline-block size-2.5 rotate-45 bg-purple-500" />
              <span class="text-text">3-4 次</span>
            </div>
            <div class="flex items-center gap-1.5">
              <span class="inline-block size-2.5 bg-pink-400" style="clip-path: polygon(50% 0%, 100% 100%, 0% 100%)" />
              <span class="text-text">5+ 次</span>
            </div>
            <div class="flex items-center gap-1.5">
              <span class="inline-block size-2.5 bg-accent" style="clip-path: polygon(50% 0, 100% 38%, 82% 100%, 18% 100%, 0 38%)" />
              <span class="text-text">热门节点</span>
            </div>
          </div>
          <div class="text-[9px] text-text-muted mt-1 pt-1 border-t border-border/40">连线 = 标签共现关系</div>
        </div>
      </div>

      <!-- 右下：数据概览 -->
      <div class="absolute bottom-6 right-6 z-20 pointer-events-none">
        <div class="flex items-center gap-3 px-4 py-2.5 rounded-full bg-surface/80 backdrop-blur-xl border border-border/60 shadow-lg">
          <div class="flex items-center gap-1.5">
            <Binary class="size-3.5 text-brand" />
            <span class="text-[11px] font-mono text-text">{{ totalTags }} tags</span>
          </div>
          <div class="h-3 w-px bg-border" />
          <div class="flex items-center gap-1.5">
            <Palette class="size-3.5 text-accent" />
            <span class="text-[11px] font-mono text-text">{{ totalPosts }} posts</span>
          </div>
        </div>
      </div>

      <!-- ============== 选中标签：右侧 Detail Panel ============== -->
      <Transition name="slide-in-right">
        <aside
          v-if="selectedTag"
          class="absolute top-16 right-6 bottom-24 z-30 w-[420px] pointer-events-auto"
        >
          <div class="h-full flex flex-col rounded-2xl bg-surface/95 backdrop-blur-2xl border border-brand/30 shadow-2xl overflow-hidden">
            <!-- 头部 -->
            <div class="p-5 border-b border-border/50 bg-gradient-to-br from-brand/10 to-transparent relative">
              <div class="absolute top-0 right-0 w-24 h-24 bg-brand/5 rounded-full blur-2xl" />
              <div class="relative flex items-start justify-between gap-3">
                <div class="flex items-center gap-3 min-w-0">
                  <div class="size-11 rounded-xl bg-brand/15 flex items-center justify-center shrink-0 shadow-inner">
                    <Hash class="size-6 text-brand" />
                  </div>
                  <div class="min-w-0 flex-1">
                    <div class="font-bold text-lg text-text truncate">#{{ selectedTag }}</div>
                    <div class="flex items-center gap-2 mt-1.5 flex-wrap">
                      <span class="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-brand/15 text-brand font-semibold">
                        <span class="size-1.5 rounded-full bg-brand" />
                        {{ selectedInfo?.count ?? 0 }} 篇文章
                      </span>
                      <span v-if="isBuiltInOnly" class="text-[11px] text-amber-500 flex items-center gap-0.5">
                        <Star class="size-3" />
                        内置
                      </span>
                    </div>
                  </div>
                </div>
                <Button size="icon" variant="ghost" class="h-8 w-8 rounded-full shrink-0" @click="clearSelection">
                  <X class="size-4" />
                </Button>
              </div>
            </div>

            <!-- 内容区 -->
            <div class="flex-1 overflow-auto custom-scroll">
              <!-- 重命名 -->
              <template v-if="renaming">
                <div class="p-4 space-y-3">
                  <label class="text-xs text-text-muted font-medium flex items-center gap-1">
                    <Pencil class="size-3" />
                    重命名为
                  </label>
                  <Input v-model="renameValue" class="text-sm h-9" v-focus @keyup.enter="confirmRename" @keyup.esc="cancelRename" />
                  <div class="flex gap-2">
                    <Button size="sm" variant="outline" class="flex-1" @click="cancelRename">取消</Button>
                    <Button size="sm" class="flex-1" :disabled="!renameValue.trim()" @click="confirmRename">
                      <Check class="size-4" /> 确认
                    </Button>
                  </div>
                </div>
              </template>

              <!-- 合并 -->
              <template v-else-if="merging">
                <div class="p-4 space-y-3">
                  <label class="text-xs text-text-muted font-medium flex items-center gap-1">
                    <ArrowDownUp class="size-3" />
                    合并到
                  </label>
                  <select
                    v-model="mergeTarget"
                    class="flex h-9 w-full rounded-md border border-border bg-surface px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                  >
                    <option value="" disabled>选择目标标签…</option>
                    <option v-for="opt in mergeOptions" :key="opt" :value="opt">#{{ opt }}</option>
                  </select>
                  <div class="flex gap-2">
                    <Button size="sm" variant="outline" class="flex-1" @click="cancelMerge">取消</Button>
                    <Button size="sm" class="flex-1" :disabled="!mergeTarget" @click="confirmMerge">
                      <ArrowDownUp class="size-4" /> 合并
                    </Button>
                  </div>
                </div>
              </template>

              <!-- 删除确认 -->
              <template v-else-if="deleting">
                <div class="p-4 space-y-3">
                  <div class="p-3 rounded-lg bg-red-500/10 border border-red-500/30">
                    <p class="text-xs text-red-600 leading-relaxed">
                      确定删除 <span class="font-semibold">#{{ selectedTag }}</span>？将从 {{ selectedInfo?.count ?? 0 }} 篇文章中移除。
                    </p>
                  </div>
                  <div class="flex gap-2">
                    <Button size="sm" variant="outline" class="flex-1" @click="cancelDelete">取消</Button>
                    <Button size="sm" variant="destructive" class="flex-1" @click="confirmDelete">
                      <Trash2 class="size-4" /> 删除
                    </Button>
                  </div>
                </div>
              </template>

              <!-- 默认操作 -->
              <template v-else>
                <div class="p-5 space-y-5">
                  <div v-if="isBuiltInOnly" class="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-2.5">
                    <Star class="size-4 text-amber-500 shrink-0 mt-0.5" />
                    <p class="text-xs text-amber-700 leading-relaxed">
                      此标签仅存在于内置文章中，只能重命名。
                    </p>
                  </div>

                  <!-- 操作区 -->
                  <div class="space-y-3">
                    <div class="text-sm text-text-muted font-semibold flex items-center gap-1.5">
                      <span class="size-1.5 rounded-full bg-brand" />
                      对该标签执行
                    </div>
                    <div class="grid grid-cols-3 gap-3">
                      <Button
                        size="sm"
                        variant="outline"
                        class="flex flex-col items-center gap-1.5 h-auto py-4 rounded-xl"
                        :disabled="!canEdit"
                        @click="startRename"
                      >
                        <Pencil class="size-5" />
                        <span class="text-xs">重命名</span>
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        class="flex flex-col items-center gap-1.5 h-auto py-4 rounded-xl"
                        :disabled="!canEdit"
                        @click="startMerge"
                      >
                        <ArrowDownUp class="size-5" />
                        <span class="text-xs">合并</span>
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        class="flex flex-col items-center gap-1.5 h-auto py-4 rounded-xl text-red-600 hover:bg-red-500/10 hover:border-red-500/30"
                        :disabled="!canEdit"
                        @click="startDelete"
                      >
                        <Trash2 class="size-5" />
                        <span class="text-xs">删除</span>
                      </Button>
                    </div>
                  </div>

                  <!-- 共现分析 -->
                  <div class="space-y-3">
                    <div class="text-sm text-text-muted font-semibold flex items-center gap-1.5">
                      <span class="size-1.5 rounded-full bg-accent" />
                      共现关系
                    </div>
                    <div class="p-4 rounded-xl bg-brand/3 border border-brand/10 text-xs text-text-muted leading-relaxed">
                      <template v-if="selectedInfo && selectedInfo.count > 0">
                        该标签与 <span class="font-semibold text-brand">{{ Math.min(selectedInfo.count + 2, 10) }}</span> 个其他标签存在共现关系，
                        是 {{ selectedInfo.count >= 3 ? '热门' : '活跃' }} 标签网络的一部分。
                      </template>
                      <template v-else>
                        该标签暂无共现关系。当文章开始使用它时，会在此形成连接。
                      </template>
                    </div>
                  </div>
                </div>
              </template>
            </div>
          </div>
        </aside>
      </Transition>

      <!-- 空状态引导 -->
      <div v-if="totalTags === 0" class="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
        <div class="text-center space-y-3">
          <div class="inline-flex items-center justify-center size-16 rounded-2xl bg-brand/10">
            <Orbit class="size-8 text-brand" />
          </div>
          <p class="text-lg font-semibold text-text">还没有标签</p>
          <p class="text-sm text-text-muted">在左侧 Command Deck 中创建你的第一个标签星球</p>
        </div>
      </div>
    </main>
  </div>
</template>

<style scoped>
.slide-in-right-enter-active,
.slide-in-right-leave-active {
  transition: all 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.slide-in-right-enter-from,
.slide-in-right-leave-to {
  opacity: 0;
  transform: translateX(40px) scale(0.95);
}

.stat-tile {
  @apply rounded-lg p-2 border flex flex-col items-center transition-all hover:scale-105;
}

.custom-scroll::-webkit-scrollbar {
  width: 4px;
  height: 4px;
}
.custom-scroll::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scroll::-webkit-scrollbar-thumb {
  background: hsl(var(--border));
  border-radius: 4px;
}
.custom-scroll::-webkit-scrollbar-thumb:hover {
  background: hsl(var(--brand) / 0.5);
}
</style>
