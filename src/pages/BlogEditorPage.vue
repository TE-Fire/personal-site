<script setup lang="ts">
/**
 * BlogEditorPage.vue · 博客文章编辑页
 * 路由：
 *   /blog/new          → 新建
 *   /blog/:slug/edit   → 编辑已有（仅用户文章可编辑，内置文章提示"内置不可编辑"）
 *
 * 功能：
 *   · 左侧元数据表单：标题 / slug / 分类 / 标签 / 发布日期 / 封面 / 是否精选
 *   · 下方 MarkdownEditor（分栏编辑预览）
 *   · 顶部操作栏：导入 MD / 导出 MD / 草稿预览 / 保存 / 删除（仅编辑态）
 */
import { computed, onMounted, ref, shallowRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  ArrowLeft,
  Check,
  Download,
  PencilLine,
  Save,
  Star,
  Trash2,
  Upload,
  FileText,
  Eye,
  AlertTriangle,
  Sparkles,
  X as XIcon
} from 'lucide-vue-next'
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Badge,
  Separator,
  CardDescription
} from '@/components/ui'
import MarkdownEditor from '@/components/MarkdownEditor.vue'
import { useBlogApi, type ExtendedBlogPost, type NewPostInput } from '@/composables/useBlogApi'
import { type PostArticleCategory, readingMinutes } from '@/data/posts'

const route = useRoute()
const router = useRouter()
const {
  createPost,
  updatePost,
  deletePost,
  getBySlug,
  importFromMarkdown,
  exportToMarkdown,
  countWords,
  categories
} = useBlogApi()

const routeSlug = computed<string | undefined>(() =>
  route.name === 'BlogEdit' ? (route.params.slug as string) : undefined
)

const isEditMode = computed(() => !!routeSlug.value)

/* ---------- 表单状态 ---------- */
const title = ref('')
const slugInput = ref('')
const category = ref<PostArticleCategory>('工程笔记')
const tagsText = ref('')
const publishedAt = ref(new Date().toISOString().slice(0, 10))
const cover = ref('')
const featured = ref(false)
const content = ref('')
const excerpt = ref('')

/* 已保存文章引用（编辑态才有） */
const loadedPost = shallowRef<ExtendedBlogPost | null>(null)
const isBuiltInBlock = computed(() => loadedPost.value?.source === 'built-in')

/* ---------- 编辑器 ref ---------- */
const editorRef = ref<InstanceType<typeof MarkdownEditor> | null>(null)

/* ---------- MD file input ---------- */
const fileInputRef = ref<HTMLInputElement | null>(null)

/* ---------- 统计 ---------- */
const wordCount = computed(() => countWords(content.value))
const reading = computed(() => readingMinutes(wordCount.value))

/* ---------- 自动摘要计算 ---------- */
watch(content, (v) => {
  if (!excerpt.value.trim() && v.trim()) {
    const plain = v
      .replace(/```[\s\S]*?```/g, '')
      .replace(/[>#*_~\-`!\[\]()]/g, '')
      .replace(/\s+/g, '')
      .slice(0, 140)
    excerpt.value = plain.length > 140 ? `${plain}…` : plain
  }
})

/* ---------- 加载编辑态文章 ---------- */
function loadEditPost() {
  if (!routeSlug.value) return
  const p = getBySlug(routeSlug.value)
  if (!p) return
  loadedPost.value = p
  title.value = p.title
  slugInput.value = p.slug
  // 分类可能已被删除 → 回退到第一个分类
  category.value = categories.value.includes(p.category) ? p.category : categories.value[0]
  tagsText.value = (p.tags || []).join(', ')
  publishedAt.value = p.publishedAt
  cover.value = p.cover || ''
  featured.value = p.featured
  content.value = p.content || ''
  excerpt.value = p.excerpt
}

onMounted(loadEditPost)

/* ---------- 标签解析 ---------- */
const tagArr = computed(() =>
  tagsText.value
    .split(/[,，、]/)
    .map((s) => s.trim())
    .filter(Boolean)
)

/* ---------- 保存 ---------- */
const saving = ref(false)
const toast = ref<{ kind: 'success' | 'error'; text: string } | null>(null)

function showToast(kind: 'success' | 'error', text: string) {
  toast.value = { kind, text }
  setTimeout(() => { toast.value = null }, 2200)
}

async function doSave() {
  if (isBuiltInBlock.value) {
    showToast('error', '内置示例文章不可编辑')
    return
  }
  if (!title.value.trim()) {
    showToast('error', '标题必填')
    return
  }
  saving.value = true
  try {
    const input: NewPostInput = {
      title: title.value,
      slug: slugInput.value || undefined,
      category: category.value,
      tags: tagArr.value,
      publishedAt: publishedAt.value || new Date().toISOString().slice(0, 10),
      cover: cover.value || undefined,
      featured: featured.value,
      excerpt: excerpt.value || '',
      content: content.value
    }
    let saved: ExtendedBlogPost | undefined
    if (isEditMode.value && routeSlug.value) {
      saved = updatePost(routeSlug.value, input)
      if (!saved) {
        saved = createPost(input)
      }
    } else {
      saved = createPost(input)
    }
    showToast('success', '已保存到本地')
    // 跳到博客详情
    await router.replace(`/blog/${saved.slug}`)
  } finally {
    saving.value = false
  }
}

/* ---------- 删除（仅编辑态 + 用户文章）---------- */
const deleteConfirming = ref(false)
async function doDelete() {
  if (!isEditMode.value || !routeSlug.value) return
  const ok = deletePost(routeSlug.value)
  if (!ok) {
    showToast('error', '删除失败：可能是内置示例文章')
    return
  }
  showToast('success', '文章已删除')
  await router.replace('/blog')
}

/* ---------- MD 导入 ---------- */
function triggerImport() {
  fileInputRef.value?.click()
}

function triggerImportFromEditor() {
  triggerImport()
}

function onFileSelected(ev: Event) {
  const files = (ev.target as HTMLInputElement).files
  if (!files || !files.length) return
  const file = files[0]
  const reader = new FileReader()
  reader.onload = () => {
    try {
      const text = String(reader.result || '')
      const parsed = importFromMarkdown(file.name, text)
      // 回填到表单
      title.value = parsed.title
      slugInput.value = parsed.slug
      category.value = parsed.category
      tagsText.value = (parsed.tags || []).join(', ')
      publishedAt.value = parsed.publishedAt
      cover.value = parsed.cover || ''
      featured.value = parsed.featured
      content.value = parsed.content || ''
      excerpt.value = parsed.excerpt
      showToast('success', `已导入：${file.name}`)
    } catch (e: any) {
      showToast('error', `导入失败：${e?.message ?? e}`)
    }
  }
  reader.readAsText(file)
  // 重置 input，允许同一文件再次选中
  ;(ev.target as HTMLInputElement).value = ''
}

/* ---------- MD 导出 ---------- */
function doExport() {
  const slugForName = (slugInput.value.trim() || 'article')
  const post: ExtendedBlogPost = {
    slug: slugForName,
    title: title.value.trim() || '未命名文章',
    excerpt: excerpt.value,
    wordCount: wordCount.value,
    publishedAt: publishedAt.value,
    category: category.value,
    tags: tagArr.value,
    featured: featured.value,
    content: content.value,
    cover: cover.value || undefined,
    lastModified: new Date().toISOString(),
    source: 'user'
  }
  const { fileName, content: mdContent } = exportToMarkdown(post)
  const blob = new Blob([mdContent], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  showToast('success', `已导出 ${fileName}`)
}

/* ---------- 预览当前文章 ---------- */
let tmpPreviewPost: ExtendedBlogPost | null = null
function previewCurrent() {
  // 构造临时对象，塞入 useBlogApi 的 localStorage 层不持久：用内存临时导入
  const slug = slugInput.value.trim() || `preview-${Date.now().toString(36)}`
  const titleStr = title.value.trim() || '（未命名草稿）'
  const previewContent = content.value || '*（正文空白，先写一点东西？）*'
  tmpPreviewPost = {
    slug,
    title: titleStr,
    excerpt: excerpt.value || '',
    wordCount: wordCount.value,
    publishedAt: publishedAt.value,
    category: category.value,
    tags: tagArr.value,
    featured: featured.value,
    content: previewContent,
    cover: cover.value || undefined,
    lastModified: new Date().toISOString(),
    source: 'user'
  }
  // 用 sessionStorage 存一下临时预览，详情页能取到
  try {
    sessionStorage.setItem('blog-preview-tmp', JSON.stringify(tmpPreviewPost))
    router.push(`/blog/${slug}?preview=1`)
  } catch {
    showToast('error', '预览失败：sessionStorage 不可用')
  }
}
</script>

<template>
  <div class="space-y-6" data-reveal>
    <!-- 页面头部：返回 + 标题 + 操作按钮 -->
    <div class="flex flex-wrap items-center justify-between gap-4">
      <div class="flex items-center gap-3 min-w-0">
        <Button variant="ghost" size="icon" @click="router.back()" aria-label="返回">
          <ArrowLeft class="size-5" />
        </Button>
        <div class="min-w-0">
          <div class="text-xs uppercase tracking-wider font-semibold text-brand flex items-center gap-1.5">
            <FileText class="size-3.5" />
            {{ isEditMode ? '编辑文章' : '新建文章' }}
          </div>
          <h1 class="mt-1 text-2xl md:text-3xl font-bold text-text truncate">
            {{ title || '未命名文章' }}
          </h1>
        </div>
      </div>

      <!-- 操作按钮 -->
      <div class="flex items-center gap-2">
        <input
          ref="fileInputRef"
          type="file"
          accept=".md,.markdown,text/markdown"
          class="hidden"
          @change="onFileSelected"
        />
        <Button variant="outline" size="sm" @click="triggerImport">
          <Upload class="size-4" />
          <span class="hidden sm:inline">导入 MD</span>
        </Button>
        <Button variant="outline" size="sm" @click="doExport">
          <Download class="size-4" />
          <span class="hidden sm:inline">导出 MD</span>
        </Button>
        <Button variant="outline" size="sm" @click="previewCurrent">
          <Eye class="size-4" />
          <span class="hidden sm:inline">草稿预览</span>
        </Button>
        <Button
          v-if="isEditMode && !isBuiltInBlock"
          variant="outline"
          size="sm"
          class="text-danger hover:text-danger border-danger/30 hover:border-danger/60"
          @click="deleteConfirming = true"
        >
          <Trash2 class="size-4" />
          <span class="hidden sm:inline">删除</span>
        </Button>
        <Button
          size="sm"
          :disabled="!!isBuiltInBlock || saving"
          @click="doSave"
        >
          <template v-if="saving"><Sparkles class="size-4 animate-pulse" /> 保存中…</template>
          <template v-else>
            <Save class="size-4" />
            <span class="hidden sm:inline">{{ isEditMode ? '保存修改' : '保存' }}</span>
          </template>
        </Button>
      </div>
    </div>

    <!-- 内置文章不可编辑警告 -->
    <div
      v-if="isBuiltInBlock"
      class="rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 flex items-start gap-3 text-warning"
    >
      <AlertTriangle class="size-5 shrink-0 mt-0.5" />
      <div class="text-sm leading-relaxed">
        <p class="font-semibold text-warning">这是示例文章，直接修改不生效。</p>
        <p class="text-warning/80 mt-0.5">如果想要基于它修改，可以先「导出 MD → 导入 MD → 新建文章」流程，保存后就归你了。</p>
      </div>
      <Button variant="ghost" size="sm" @click="doExport">另存为 MD</Button>
    </div>

    <!-- 正文网格：左元数据 / 右正文编辑器 -->
    <div class="grid grid-cols-1 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] gap-6 items-start">
      <!-- 左：元数据卡片 -->
      <Card class="lg:sticky lg:top-20">
        <CardHeader>
          <CardTitle class="text-lg flex items-center gap-2">
            <PencilLine class="size-4 text-brand" />
            文章元数据
          </CardTitle>
          <CardDescription>分类、标签、封面这些信息会显示在博客列表卡片上</CardDescription>
        </CardHeader>
        <CardContent class="space-y-4">
          <!-- 标题 -->
          <div class="space-y-1.5">
            <Label required>标题</Label>
            <Input v-model="title" placeholder="起一个吸引读者的标题…" :disabled="isBuiltInBlock" />
          </div>
          <!-- Slug -->
          <div class="space-y-1.5">
            <Label>URL 标识（slug，可选）</Label>
            <Input v-model="slugInput" placeholder="留空会自动根据标题生成" :disabled="isBuiltInBlock" />
          </div>
          <!-- 分类 -->
          <div class="space-y-1.5">
            <Label required>分类</Label>
            <select
              v-model="category"
              class="w-full h-10 rounded-lg border border-input bg-surface px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand disabled:opacity-50"
              :disabled="isBuiltInBlock"
            >
              <option v-for="c in categories" :key="c" :value="c">{{ c }}</option>
            </select>
          </div>
          <!-- 标签 -->
          <div class="space-y-1.5">
            <Label>标签（逗号分隔）</Label>
            <Input v-model="tagsText" placeholder="如：Vue 3, 设计系统, vibecoding" :disabled="isBuiltInBlock" />
            <div v-if="tagArr.length" class="flex flex-wrap gap-1.5 pt-1">
              <Badge v-for="t in tagArr" :key="t" variant="secondary" class="text-[11px]">#{{ t }}</Badge>
            </div>
          </div>
          <Separator />
          <!-- 日期 / 封面 / 精选 -->
          <div class="grid grid-cols-2 gap-3">
            <div class="space-y-1.5">
              <Label>发布日期</Label>
              <Input type="date" v-model="publishedAt" :disabled="isBuiltInBlock" />
            </div>
            <div class="space-y-1.5 flex flex-col justify-end">
              <Label>&nbsp;</Label>
              <label
                class="inline-flex items-center gap-2 h-10 px-3 rounded-lg border border-input cursor-pointer select-none hover:border-brand/50 transition"
                :class="{ 'opacity-50 pointer-events-none': isBuiltInBlock }"
              >
                <input
                  type="checkbox"
                  class="size-4 accent-brand"
                  v-model="featured"
                  :disabled="isBuiltInBlock"
                />
                <Star class="size-4 text-warning" :class="{ 'fill-warning': featured }" />
                <span class="text-sm">首页精选</span>
              </label>
            </div>
          </div>
          <div class="space-y-1.5">
            <Label>封面图 URL（可选）</Label>
            <Input v-model="cover" placeholder="https://...封面图片链接" :disabled="isBuiltInBlock" />
          </div>

          <Separator />

          <!-- 摘要 -->
          <div class="space-y-1.5">
            <Label>摘要（可选，不填自动截正文）</Label>
            <textarea
              v-model="excerpt"
              rows="3"
              placeholder="列表页展示的文章简介…"
              class="w-full rounded-lg border border-input bg-surface px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand resize-none disabled:opacity-50"
              :disabled="isBuiltInBlock"
            />
          </div>

          <Separator />

          <!-- 字数 / 阅读时长 -->
          <div class="grid grid-cols-2 gap-3 pt-1">
            <div class="rounded-xl bg-surface p-3 border border-border/60">
              <div class="text-[10px] uppercase tracking-wider text-text-muted font-medium">正文字数</div>
              <div class="mt-0.5 text-xl font-bold tabular-nums">{{ wordCount.toLocaleString() }}</div>
            </div>
            <div class="rounded-xl bg-surface p-3 border border-border/60">
              <div class="text-[10px] uppercase tracking-wider text-text-muted font-medium">阅读时长</div>
              <div class="mt-0.5 text-xl font-bold tabular-nums">{{ reading }} 分钟</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <!-- 右：编辑器 -->
      <div class="min-w-0">
        <MarkdownEditor
          ref="editorRef"
          v-model="content"
          @import-request="triggerImportFromEditor"
        />
      </div>
    </div>

    <!-- 删除确认弹窗 -->
    <Teleport to="body">
      <Transition name="char-fade">
        <div
          v-if="deleteConfirming"
          class="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          @click.self="deleteConfirming = false"
        >
          <div class="w-full max-w-sm rounded-2xl bg-surface-elevated border border-border/70 shadow-2xl p-5">
            <div class="flex items-start gap-3">
              <div class="size-10 rounded-full bg-danger/10 text-danger flex items-center justify-center shrink-0">
                <AlertTriangle class="size-5" />
              </div>
              <div class="flex-1">
                <div class="text-lg font-semibold text-text">确定要删除这篇文章？</div>
                <div class="text-sm text-text-muted mt-1">删除后无法从本设备恢复，建议先导出 MD 备份。</div>
              </div>
              <button
                type="button"
                class="size-8 rounded-lg text-text-muted hover:text-text hover:bg-surface flex items-center justify-center transition"
                @click="deleteConfirming = false"
              >
                <XIcon class="size-4" />
              </button>
            </div>
            <div class="mt-5 flex justify-end gap-2">
              <Button variant="outline" @click="deleteConfirming = false">取消</Button>
              <Button
                class="bg-danger hover:bg-danger/90 text-white border-danger"
                @click="doDelete(); deleteConfirming = false"
              >
                <Check class="size-4" />
                确认删除
              </Button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Toast -->
    <Teleport to="body">
      <Transition name="bubble">
        <div
          v-if="toast"
          class="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] rounded-full shadow-xl px-5 py-2.5 text-sm font-medium text-white border border-white/20 backdrop-blur-md"
          :class="toast.kind === 'success' ? 'bg-success/90' : 'bg-danger/90'"
        >
          {{ toast.text }}
        </div>
      </Transition>
    </Teleport>
  </div>
</template>
