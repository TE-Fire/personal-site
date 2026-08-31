<script setup lang="ts">
/**
 * BlogEditorPage.vue · 博客文章编辑页
 * 路由：
 *   /blog/new          → 新建
 *   /blog/:slug/edit   → 编辑已有文章
 *
 * 数据源：
 *   · 分类 / 标签下拉 → GET /api/categories + GET /api/tags
 *   · 编辑态加载 → GET /api/posts/slug/:slug
 *   · 新建 / 更新 / 删除 → POST /api/posts / PUT /api/posts/:id / DELETE /api/posts/:id
 *   · MD 导入 / 导出 → 纯前端解析 front-matter
 *
 * 保存时自动做名称→ID 转换：
 *   · 分类名 → categoryId（不存在则先调 POST /api/categories 创建）
 *   · 标签名 → tagIds（不存在则逐个调 POST /api/tags 创建）
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
import {
  createPost,
  updatePost,
  deletePost,
  fetchPostBySlug,
  type CreatePostParams,
  type UpdatePostParams,
} from '@/api/post'
import { fetchCategories, createCategory } from '@/api/category'
import { fetchTags, createTag } from '@/api/tag'
import type { CategoryVo, TagVo, PostVo } from '@/lib/api-types'

const route = useRoute()
const router = useRouter()

const routeSlug = computed<string | undefined>(() =>
  route.name === 'BlogEdit' ? (route.params.slug as string) : undefined
)

const isEditMode = computed(() => !!routeSlug.value)

/* ---------- 后端字典 ---------- */
const categories = ref<CategoryVo[]>([])
const tags = ref<TagVo[]>([])

async function loadDicts() {
  try {
    const [c, t] = await Promise.all([fetchCategories(), fetchTags()])
    categories.value = c
    tags.value = t
  } catch { /* 静默失败，下拉为空 */ }
}

/* ---------- 表单状态 ---------- */
const title = ref('')
const slugInput = ref('')
/** 选中的 categoryId（null = 未分类） */
const categoryId = ref<number | null>(null)
const tagsText = ref('')
const publishedAt = ref(new Date().toISOString().slice(0, 10))
const cover = ref('')
const featured = ref(false)
const status = ref<'draft' | 'published'>('published')
const content = ref('')
const excerpt = ref('')

/* 已加载文章引用（编辑态才有） */
const loadedPost = shallowRef<PostVo | null>(null)

/* ---------- 编辑器 ref ---------- */
const editorRef = ref<InstanceType<typeof MarkdownEditor> | null>(null)

/* ---------- MD file input ---------- */
const fileInputRef = ref<HTMLInputElement | null>(null)

/* ---------- 统计 ---------- */
function countWords(md: string): number {
  // 粗略：Markdown 去掉代码块和格式后算字符数
  return md.replace(/```[\s\S]*?```/g, '').replace(/[>#*_~\-`!\[\]()]/g, '').length
}
function readingMinutes(wordCount: number): number {
  return Math.max(1, Math.ceil(wordCount / 500))
}
const wordCount = computed(() => countWords(content.value))
const reading = computed(() => readingMinutes(wordCount.value))

/* ---------- slug 生成 ---------- */
function slugify(input: string): string {
  const base = input
    .toLowerCase()
    .replace(/[^\w\s\-]/g, '')   // 去掉非字母数字空格减号
    .trim()
    .replace(/\s+/g, '-')        // 空格变减号
    .replace(/-+/g, '-')         // 连续减号合并
  return base || `post-${Date.now().toString(36)}`
}

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

/* slug 自动生成：标题变化时（新建态）自动填充 */
watch(title, (v) => {
  if (!isEditMode.value && v.trim() && !slugInput.value.trim()) {
    slugInput.value = slugify(v)
  }
})

/* ---------- 加载编辑态文章 ---------- */
async function loadEditPost() {
  if (!routeSlug.value) return
  try {
    const p = await fetchPostBySlug(routeSlug.value)
    loadedPost.value = p
    title.value = p.title
    slugInput.value = p.slug
    categoryId.value = p.category?.id ?? null
    tagsText.value = p.tags.map((t) => t.name).join(', ')
    publishedAt.value = p.createdAt.slice(0, 10)
    cover.value = p.cover || ''
    featured.value = p.featured
    status.value = (p.status === 'published' ? 'published' : 'draft')
    content.value = p.content || ''
    excerpt.value = p.excerpt
  } catch (e) {
    showToast('error', `加载文章失败：${(e as Error).message}`)
    router.replace('/blog')
  }
}

onMounted(async () => {
  await loadDicts()
  if (isEditMode.value) {
    await loadEditPost()
  }
})

/* ---------- 标签解析 ---------- */
const tagArr = computed(() =>
  tagsText.value
    .split(/[,，、]/)
    .map((s) => s.trim())
    .filter(Boolean)
)

/** categoryId → 分类名（保存时需要） */
const categoryName = computed(() => {
  if (categoryId.value == null) return ''
  return categories.value.find((c) => c.id === categoryId.value)?.name ?? ''
})

/**
 * 名称 → ID 转换：
 *   · 分类名 → categoryId（不存在则先创建）
 *   · 标签名 → tagIds（不存在则逐个创建）
 */
async function resolveCategoryId(name: string): Promise<number | null> {
  if (!name.trim()) return null
  const existing = categories.value.find((c) => c.name === name)
  if (existing) return existing.id
  const created = await createCategory({ name: name.trim() })
  categories.value = [...categories.value, created]
  return created.id
}

async function resolveTagIds(names: string[]): Promise<number[]> {
  const ids: number[] = []
  for (const name of names) {
    const existing = tags.value.find((t) => t.name === name)
    if (existing) {
      ids.push(existing.id)
    } else {
      const created = await createTag({ name })
      tags.value = [...tags.value, created]
      ids.push(created.id)
    }
  }
  return ids
}

/* ---------- 保存 ---------- */
const saving = ref(false)
const toast = ref<{ kind: 'success' | 'error'; text: string } | null>(null)

function showToast(kind: 'success' | 'error', text: string) {
  toast.value = { kind, text }
  setTimeout(() => { toast.value = null }, 2200)
}

async function doSave() {
  if (!title.value.trim()) {
    showToast('error', '标题必填')
    return
  }
  // slug 处理
  let slug = slugInput.value.trim()
  if (!slug) {
    slug = slugify(title.value)
    slugInput.value = slug
  }
  saving.value = true
  try {
    // 名称 → ID 转换
    const catId = await resolveCategoryId(categoryName.value)
    const tagIds = await resolveTagIds(tagArr.value)

    if (isEditMode.value && loadedPost.value) {
      // 更新
      const params: UpdatePostParams = {
        slug,
        title: title.value.trim(),
        content: content.value,
        excerpt: excerpt.value,
        cover: cover.value || undefined,
        featured: featured.value,
        status: status.value,
        categoryId: catId,
        tagIds,
      }
      const updated = await updatePost(loadedPost.value.id, params)
      loadedPost.value = updated
      showToast('success', '已更新')
    } else {
      // 新建
      const params: CreatePostParams = {
        slug,
        title: title.value.trim(),
        content: content.value,
        excerpt: excerpt.value,
        cover: cover.value || undefined,
        featured: featured.value,
        status: status.value,
        categoryId: catId ?? undefined,
        tagIds,
      }
      const created = await createPost(params)
      loadedPost.value = created
      showToast('success', '已保存到服务器')
      // 跳到博客详情
      await router.replace(`/blog/${created.slug}`)
      return
    }
  } catch (e) {
    const msg = (e as Error).message || '保存失败'
    if (msg.includes('2002') || msg.includes('重复')) {
      showToast('error', `slug 「${slug}」已被占用，请换一个`)
    } else {
      showToast('error', msg)
    }
  } finally {
    saving.value = false
  }
}

/* ---------- 删除（仅编辑态）---------- */
const deleteConfirming = ref(false)
async function doDelete() {
  if (!isEditMode.value || !loadedPost.value) return
  try {
    await deletePost(loadedPost.value.id)
    showToast('success', '已归档（软删除）')
    await router.replace('/blog')
  } catch (e) {
    showToast('error', `删除失败：${(e as Error).message}`)
  }
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
      const parsed = parseMarkdownWithFrontMatter(file.name, text)
      // 回填到表单
      title.value = parsed.title
      slugInput.value = parsed.slug || slugify(parsed.title)
      // 分类名 → categoryId（需要等 categories 字典加载）
      if (parsed.category) {
        const found = categories.value.find((c) => c.name === parsed.category)
        categoryId.value = found?.id ?? null
      }
      tagsText.value = (parsed.tags || []).join(', ')
      publishedAt.value = parsed.publishedAt
      cover.value = parsed.cover || ''
      featured.value = parsed.featured
      status.value = parsed.status || 'published'
      content.value = parsed.content || ''
      excerpt.value = parsed.excerpt || ''
      showToast('success', `已导入：${file.name}`)
    } catch (e: any) {
      showToast('error', `导入失败：${e?.message ?? e}`)
    }
  }
  reader.readAsText(file)
  // 重置 input，允许同一文件再次选中
  ;(ev.target as HTMLInputElement).value = ''
}

/** 解析带 front-matter 的 Markdown（纯前端，不写 localStorage） */
function parseMarkdownWithFrontMatter(fileName: string, md: string) {
  let content = md
  let fmTitle = ''
  let fmCategory = ''
  let fmTags: string[] = []
  let fmPublishedAt = new Date().toISOString().slice(0, 10)
  let fmSlug = ''
  let fmExcerpt = ''
  let fmCover = ''
  let fmFeatured = false
  let fmStatus: 'draft' | 'published' = 'published'

  // 解析 front-matter（yaml 风格）
  const fmMatch = md.match(/^---\s*\n([\s\S]*?)\n---\s*\n?/)
  if (fmMatch) {
    const yaml = fmMatch[1]
    content = md.slice(fmMatch[0].length)
    yaml.split(/\r?\n/).forEach((line) => {
      const m = line.match(/^([A-Za-z0-9_\-]+)\s*:\s*(.*)$/)
      if (!m) return
      const [, rawKey, rawVal] = m
      const key = rawKey.toLowerCase()
      const val = rawVal.trim()
      if (val.startsWith('[') && val.endsWith(']')) {
        const arr = val
          .slice(1, -1)
          .split(',')
          .map((v) => v.trim().replace(/^['"]|['"]$/g, ''))
          .filter(Boolean)
        if (key === 'tags' || key === 'tag') fmTags = arr
        return
      }
      const clean = val.replace(/^['"]|['"]$/g, '')
      switch (key) {
        case 'title': fmTitle = clean; break
        case 'slug':
        case 'id': fmSlug = clean; break
        case 'category':
        case 'categories': fmCategory = clean; break
        case 'tags': fmTags = [clean]; break
        case 'date':
        case 'published':
        case 'publishedat': fmPublishedAt = clean; break
        case 'excerpt':
        case 'description': fmExcerpt = clean; break
        case 'cover': fmCover = clean; break
        case 'featured': fmFeatured = clean === 'true'; break
        case 'status': fmStatus = (clean === 'draft' ? 'draft' : 'published'); break
      }
    })
  }

  const fallbackTitle = fileName.replace(/\.(md|markdown)$/i, '') || `导入的文章`

  return {
    title: fmTitle || fallbackTitle,
    slug: fmSlug,
    excerpt: fmExcerpt,
    content,
    category: fmCategory,
    tags: fmTags,
    publishedAt: fmPublishedAt,
    cover: fmCover,
    featured: fmFeatured,
    status: fmStatus,
  }
}

/* ---------- MD 导出 ---------- */
function doExport() {
  const slugForName = (slugInput.value.trim() || slugify(title.value.trim() || 'article'))
  const tagsStr = tagArr.value.length
    ? `[${tagArr.value.map((t) => `'${t}'`).join(', ')}]`
    : '[]'
  const fm = [
    '---',
    `title: '${(title.value.trim() || '未命名文章').replace(/'/g, "''")}'`,
    `slug: '${slugForName}'`,
    `category: ${categoryName.value || ''}`,
    `tags: ${tagsStr}`,
    `publishedAt: ${publishedAt.value}`,
    `featured: ${featured.value}`,
    `status: ${status.value}`,
    ...(cover.value ? [`cover: '${cover.value}'`] : []),
    '---',
    ''
  ].join('\n')
  const mdContent = `${fm}${content.value}`
  const blob = new Blob([mdContent], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${slugForName}.md`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  showToast('success', `已导出 ${slugForName}.md`)
}

/* ---------- 草稿预览（sessionStorage 临时方案）---------- */
let tmpPreview: { slug: string; title: string; excerpt: string; content: string; category: string; tags: string[] } | null = null
function previewCurrent() {
  const slug = slugInput.value.trim() || slugify(title.value)
  const titleStr = title.value.trim() || '（未命名草稿）'
  tmpPreview = {
    slug,
    title: titleStr,
    excerpt: excerpt.value,
    content: content.value || '*（正文空白，先写一点东西？）*',
    category: categoryName.value,
    tags: tagArr.value,
  }
  try {
    sessionStorage.setItem('blog-preview-tmp', JSON.stringify(tmpPreview))
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
          v-if="isEditMode"
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
          :disabled="saving"
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
            <Input v-model="title" placeholder="起一个吸引读者的标题…"  />
          </div>
          <!-- Slug -->
          <div class="space-y-1.5">
            <Label>URL 标识（slug，可选）</Label>
            <Input v-model="slugInput" placeholder="留空会自动根据标题生成"  />
          </div>
          <!-- 分类 -->
          <div class="space-y-1.5">
            <Label>分类</Label>
            <select
              v-model="categoryId"
              class="w-full h-10 rounded-lg border border-input bg-surface px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand"
            >
              <option :value="null">未分类</option>
              <option v-for="c in categories" :key="c.id" :value="c.id">{{ c.name }}</option>
            </select>
          </div>
          <!-- 标签 -->
          <div class="space-y-1.5">
            <Label>标签（逗号分隔）</Label>
            <Input v-model="tagsText" placeholder="如：Vue 3, 设计系统, vibecoding"  />
            <div v-if="tagArr.length" class="flex flex-wrap gap-1.5 pt-1">
              <Badge v-for="t in tagArr" :key="t" variant="secondary" class="text-[11px]">#{{ t }}</Badge>
            </div>
          </div>
          <Separator />
          <!-- 日期 / 封面 / 精选 -->
          <div class="grid grid-cols-2 gap-3">
            <div class="space-y-1.5">
              <Label>发布日期</Label>
              <Input type="date" v-model="publishedAt"  />
            </div>
            <div class="space-y-1.5 flex flex-col justify-end">
              <Label>&nbsp;</Label>
              <label
                class="inline-flex items-center gap-2 h-10 px-3 rounded-lg border border-input cursor-pointer select-none hover:border-brand/50 transition"
                
              >
                <input
                  type="checkbox"
                  class="size-4 accent-brand"
                  v-model="featured"
                  
                />
                <Star class="size-4 text-warning" :class="{ 'fill-warning': featured }" />
                <span class="text-sm">首页精选</span>
              </label>
            </div>
          </div>
          <div class="space-y-1.5">
            <Label>封面图 URL（可选）</Label>
            <Input v-model="cover" placeholder="https://...封面图片链接"  />
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
