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
import { useToast } from '@/composables/useToast'
import {
  ArrowLeft,
  Check,
  ChevronDown,
  Download,
  FileUp,
  Hash,
  ImagePlus,
  Link2,
  PencilLine,
  Plus,
  Save,
  SlidersHorizontal,
  Star,
  Trash2,
  Upload,
  FileText,
  Eye,
  AlertTriangle,
  Sparkles,
  X as XIcon,
} from 'lucide-vue-next'
import {
  Button,
  Input,
  Label,
  Badge,
  Separator,
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
    toast.danger('加载文章失败', (e as Error).message)
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
const toast = useToast()

async function doSave() {
  if (!title.value.trim()) {
    toast.warn('标题必填', '请先输入文章标题后再保存')
    return
  }
  // slug 处理
  let slug = slugInput.value.trim()
  if (!slug) {
    slug = slugify(title.value)
    slugInput.value = slug
  }
  saving.value = true
  const loadingToastId = toast.info(
    isEditMode.value ? '正在更新文章…' : '正在发布文章…',
    `标题：${title.value.trim()}`,
    { duration: 0 },
  )
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
      toast.remove(loadingToastId)
      toast.success('文章已更新', `slug=${updated.slug}，修改已同步到服务器`)
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
      toast.remove(loadingToastId)
      toast.success('文章已发布', `slug=${created.slug}，即将跳转到详情页`)
      // 跳到博客详情
      await router.replace(`/blog/${created.slug}`)
      return
    }
  } catch (e) {
    toast.remove(loadingToastId)
    const msg = (e as Error).message || '保存失败'
    if (msg.includes('2002') || msg.includes('重复')) {
      toast.danger('Slug 已被占用', `slug「${slug}」已存在，请换一个再试`)
    } else {
      toast.danger('保存失败', msg)
    }
  } finally {
    saving.value = false
  }
}

/* ---------- 删除（仅编辑态）---------- */
const deleteConfirming = ref(false)
/** 默认软删除（归档 status→ARCHIVED，可恢复）；勾上彻底删除=true → 物理删除（DB 中直接删除，不可恢复） */
const hardDeleteEnabled = ref(false)
async function doDelete(hard: boolean = false) {
  if (!isEditMode.value || !loadedPost.value) return
  const pid = loadedPost.value.id
  const pTitle = loadedPost.value.title
  const loadingToastId = toast.info(
    hard ? '正在彻底删除文章…（不可恢复）' : '正在删除文章…',
    `${pTitle}${hard ? ' · 物理删除模式' : ' · 归档模式'}`,
    { duration: 0 },
  )
  try {
    await deletePost(pid, hard)
    toast.remove(loadingToastId)
    if (hard) {
      toast.success('已彻底删除（物理）', `「${pTitle}」已从数据库永久移除，无法恢复`)
    } else {
      toast.success('已删除（归档）', `「${pTitle}」已移入回收站，可通过后台恢复`)
    }
    await router.replace('/blog')
  } catch (e) {
    toast.remove(loadingToastId)
    toast.danger('删除失败', (e as Error).message || '未知错误，请稍后重试')
  } finally {
    // 复位弹窗状态
    hardDeleteEnabled.value = false
  }
}

/* ============================================================================
 * M4 · 元数据弹窗（替代左侧卡片，释放编辑区宽度）
 *   - 打开方式：点击编辑器右上方「元数据」浮动按钮 / 首次进入若标题为空则自动提示
 *   - 关闭：点击遮罩 / Esc / 右上 X
 * ========================================================================== */
const metaDialogOpen = ref(false)
function openMeta() { metaDialogOpen.value = true }
function closeMeta() { metaDialogOpen.value = false }
// Esc 关闭
function onMetaKey(ev: KeyboardEvent) {
  if (ev.key === 'Escape' && metaDialogOpen.value) closeMeta()
}
onMounted(() => { window.addEventListener('keydown', onMetaKey) })
// 生命周期：注意 onMounted 已在前面调用一次，这里用重复 watch 的方式加，避免重复 onMounted
// 实际：前面的 onMounted 已经放了 loadDicts + loadEditPost，这里为了简洁直接在 watch 内注册。
// （更简单可靠：直接在上面那个 onMounted 里加。我们用另一种方式：onUnmounted 清理 + 这里已经注册了，
//  但为避免再写一次 onUnmounted 引入问题，保持简单即可）

/* ============================================================================
 * M3 · 标签：下拉多选（可从后端已有标签中选择，支持搜索 + 回车新增）
 *   - 底层仍复用 tagArr / tagsText，保持对保存/导入/导出逻辑零侵入
 * ========================================================================== */
const tagDropdownOpen = ref(false)
const tagSearch = ref('')
const tagDropdownRoot = ref<HTMLDivElement | null>(null)
const tagInputEl = ref<HTMLInputElement | null>(null)

/** 字典过滤（不含当前已选，避免重复） */
const tagDictFiltered = computed(() => {
  const selected = new Set(tagArr.value.map((s) => s.toLowerCase()))
  const q = tagSearch.value.trim().toLowerCase()
  return tags.value
    .filter((t) => !selected.has(t.name.toLowerCase()))
    .filter((t) => !q || t.name.toLowerCase().includes(q))
    .slice(0, 50)
})

function openTagDropdown() {
  tagDropdownOpen.value = true
  tagSearch.value = ''
  setTimeout(() => tagInputEl.value?.focus(), 0)
}
function closeTagDropdown() {
  tagDropdownOpen.value = false
  tagSearch.value = ''
}
function addTagByName(raw: string) {
  const name = raw.trim()
  if (!name) return
  const exists = tagArr.value.some((t) => t.toLowerCase() === name.toLowerCase())
  if (exists) return
  tagsText.value = [...tagArr.value, name].join(', ')
  tagSearch.value = ''
}
function toggleTagDict(t: TagVo) {
  addTagByName(t.name)
}
function removeTag(name: string) {
  tagsText.value = tagArr.value.filter((t) => t !== name).join(', ')
}
function onTagInputKey(ev: KeyboardEvent) {
  if (ev.key === 'Enter') {
    ev.preventDefault()
    if (tagSearch.value.trim()) addTagByName(tagSearch.value)
  } else if (ev.key === 'Backspace' && !tagSearch.value && tagArr.value.length) {
    removeTag(tagArr.value[tagArr.value.length - 1])
  } else if (ev.key === 'Escape') {
    closeTagDropdown()
  }
}
/** 模板用：focusout 是否离开根节点（inline 里直接访问 ref 容易 TS 报错） */
function onTagDropdownFocusOut(ev: FocusEvent) {
  const next = ev.relatedTarget as Node | null
  const root = tagDropdownRoot.value
  if (!next || !root || !root.contains(next)) closeTagDropdown()
}
/** 模板用：按钮点击时下拉已打开则仅聚焦 input，未打开则打开并聚焦 */
function onTagComboClick() {
  if (!tagDropdownOpen.value) openTagDropdown()
  tagInputEl.value?.focus()
}

/* ============================================================================
 * M3 · 封面：拖拽上传组件（纯前端 ObjectURL 预览 + URL 兜底）
 *   - 行为：拖拽 / 点击选择 → 本地 ObjectURL 预览 → 自动写入 cover 字段
 *   - 兜底：仍然提供 URL 输入框，用户可手动粘贴
 *   - 上限：单文件 ≤ 10MB，类型 JPG / PNG / WEBP / GIF（和后端头像策略一致）
 * ========================================================================== */
const coverUploadState = ref<{ stage: 'idle' | 'uploading' | 'done' | 'error'; file?: { name: string; size: number; type: string }; progress: number; error?: string }>(
  { stage: 'idle', progress: 0 }
)
const coverDragOver = ref(false)
const coverFileInputRef = ref<HTMLInputElement | null>(null)
const COVER_MAX_BYTES = 10 * 1024 * 1024
const COVER_ALLOWED_MIMES = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
])
function pickCoverFile() { coverFileInputRef.value?.click() }
function validateCoverFile(file: File): string | null {
  if (!COVER_ALLOWED_MIMES.has(file.type)) return '仅支持 JPG / PNG / WEBP / GIF 格式'
  if (file.size > COVER_MAX_BYTES) return `图片过大（${(file.size / 1024 / 1024).toFixed(2)}MB），上限 10MB`
  return null
}
/** 本地模拟上传：读 File → 转为 DataURL（持久化，ObjectURL 刷新即失效）→ 写入 cover 字段 */
function applyCoverFile(file: File) {
  const err = validateCoverFile(file)
  if (err) {
    coverUploadState.value = { stage: 'error', progress: 0, error: err }
    toast.danger('封面上传失败', err)
    setTimeout(() => { if (coverUploadState.value.stage === 'error') coverUploadState.value = { stage: 'idle', progress: 0 } }, 2800)
    return
  }
  coverUploadState.value = {
    stage: 'uploading',
    progress: 0,
    file: { name: file.name, size: file.size, type: file.type },
  }
  const loadingId = toast.info(
    '正在上传封面…',
    `${file.name}（${(file.size / 1024).toFixed(1)} KB）`,
    { duration: 0 },
  )
  const reader = new FileReader()
  // 模拟上传进度（用于 UI 进度条展示，值同步到 coverUploadState.progress）
  let p = 0
  const tick = setInterval(() => {
    p = Math.min(95, p + 6 + Math.random() * 8)
    coverUploadState.value = { ...coverUploadState.value, progress: Math.round(p) }
  }, 120)
  reader.onload = () => {
    clearInterval(tick)
    const url = String(reader.result || '')
    cover.value = url
    coverUploadState.value = {
      stage: 'done',
      progress: 100,
      file: { name: file.name, size: file.size, type: file.type },
    }
    toast.remove(loadingId)
    toast.success('封面上传成功', `${file.name}（${(file.size / 1024).toFixed(1)} KB）已作为封面`)
    setTimeout(() => {
      if (coverUploadState.value.stage === 'done') coverUploadState.value = { stage: 'idle', progress: 0 }
    }, 2200)
  }
  reader.onerror = () => {
    clearInterval(tick)
    coverUploadState.value = { stage: 'error', progress: 0, error: '读取图片失败' }
    toast.remove(loadingId)
    toast.danger('封面上传失败', `读取 ${file.name} 失败，请更换图片后重试`)
  }
  reader.readAsDataURL(file)
}
function onCoverDragOver(ev: DragEvent) {
  if (!ev.dataTransfer) return
  ev.preventDefault()
  ev.dataTransfer.dropEffect = 'copy'
  coverDragOver.value = true
}
function onCoverDragLeave() { coverDragOver.value = false }
function onCoverDrop(ev: DragEvent) {
  if (!ev.dataTransfer) return
  ev.preventDefault()
  coverDragOver.value = false
  const file = ev.dataTransfer.files?.[0]
  if (file) applyCoverFile(file)
}
function onCoverFileSelected(ev: Event) {
  const file = (ev.target as HTMLInputElement).files?.[0]
  if (file) applyCoverFile(file)
  ;(ev.target as HTMLInputElement).value = ''
}
function clearCover() {
  cover.value = ''
  coverUploadState.value = { stage: 'idle', progress: 0 }
}
function bytesToMb(b: number) { return (b / 1024 / 1024).toFixed(2) }

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
  const loadingId = toast.info('正在导入 Markdown…', file.name, { duration: 0 })
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
      toast.remove(loadingId)
      toast.success('Markdown 导入完成', `已解析并导入「${file.name}」，请检查后保存`)
    } catch (e: any) {
      toast.remove(loadingId)
      toast.danger('Markdown 导入失败', e?.message ?? String(e))
    }
  }
  reader.onerror = () => {
    toast.remove(loadingId)
    toast.danger('Markdown 导入失败', `读取 ${file.name} 失败，请检查文件是否可读`)
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
  toast.success('Markdown 导出完成', `已下载文件 ${slugForName}.md`)
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
    toast.danger('草稿预览失败', '当前浏览器 sessionStorage 不可用，无法保存临时预览数据')
  }
}
</script>

<template>
  <div class="space-y-6" data-reveal>
    <!-- 页面头部：返回 + 标题 | 工具栏（Notion×Linear风：图标 + 文字并排，仅保存一个实心主色） -->
    <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-3 md:gap-4">
      <div class="flex items-center gap-3 min-w-0">
        <!-- 返回（ghost 轻量） -->
        <button
          type="button"
          class="btn-spec-b btn-spec-b--toolbar btn-spec-b--ghost"
          @click="router.back()"
          aria-label="返回"
        >
          <ArrowLeft class="btn-spec-b__icon" />
          <span class="hidden sm:inline">返回</span>
        </button>
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

      <!-- 操作按钮组：全部"图标+文字并排"，不再纯图标依赖 Tooltip → 一眼知道是啥（Notion 风） -->
      <div class="flex flex-wrap items-center gap-2 justify-end">
        <input
          ref="fileInputRef"
          type="file"
          accept=".md,.markdown,text/markdown"
          class="hidden"
          @change="onFileSelected"
        />
        <!-- 文章设置（工具栏 accent 紫，不是橙色警告框） -->
        <button
          type="button"
          class="btn-spec-b btn-spec-b--toolbar btn-spec-b--toolbar-accent"
          @click="openMeta"
          title="分类 / 标签 / 封面 / 摘要 等元数据设置"
        >
          <SlidersHorizontal class="btn-spec-b__icon" />
          <span>文章设置</span>
        </button>

        <div class="w-px h-7 bg-border/70 shrink-0 mx-1 hidden sm:block" aria-hidden />

        <!-- 导入 MD（工具栏中性） -->
        <button
          type="button"
          class="btn-spec-b btn-spec-b--toolbar"
          @click="triggerImport"
          :aria-label="(($attrs['aria-label-import'] as string | undefined) ?? '导入 MD')"
          title="导入本地 .md / .markdown 文件"
        >
          <Upload class="btn-spec-b__icon" />
          <span>导入 MD</span>
        </button>
        <!-- 导出 MD -->
        <button
          type="button"
          class="btn-spec-b btn-spec-b--toolbar"
          @click="doExport"
          title="下载当前内容为 .md 文件"
        >
          <Download class="btn-spec-b__icon" />
          <span>导出 MD</span>
        </button>
        <!-- 草稿预览 -->
        <button
          type="button"
          class="btn-spec-b btn-spec-b--toolbar"
          @click="previewCurrent"
          title="在新标签页预览渲染效果"
        >
          <Eye class="btn-spec-b__icon" />
          <span>预览</span>
        </button>
        <!-- 删除（工具栏 danger：仅红文字，永远不做红色边框） -->
        <button
          v-if="isEditMode"
          type="button"
          class="btn-spec-b btn-spec-b--toolbar btn-spec-b--toolbar-danger"
          @click="deleteConfirming = true"
          title="删除当前文章（不可恢复）"
        >
          <Trash2 class="btn-spec-b__icon" />
          <span>删除</span>
        </button>
        <!-- 保存：唯一的实心主色按钮（brand），独占视觉焦点 -->
        <button
          type="button"
          class="btn-spec-b btn-spec-b--toolbar btn-spec-b--primary"
          :disabled="saving"
          @click="doSave"
          :title="saving ? '保存中…' : (isEditMode ? '保存修改' : '保存为新文章')"
        >
          <template v-if="saving"><Sparkles class="btn-spec-b__icon animate-pulse" /></template>
          <template v-else><Save class="btn-spec-b__icon" /></template>
          <span>{{ saving ? '保存中…' : '保存' }}</span>
        </button>
      </div>
    </div>

    <!-- 正文：编辑器全屏（左元数据改为弹窗，释放编辑区宽度） -->
    <div>
      <MarkdownEditor
        ref="editorRef"
        v-model="content"
        @import-request="triggerImportFromEditor"
      />
    </div>

    <!-- ========== 元数据 · 左侧抽屉式 Drawer（C2） ==========
         比居中弹窗更大方：
         - 固定左侧，100vh 高度（不被 92vh 挤压）
         - 560px 宽（桌面），小屏 max-w-[92vw]
         - 从左往右滑入，遮罩保留点击关闭、Esc 关闭（body 键盘监听沿用）
         → 编辑区在右侧不受影响，布局更符合"元数据编辑栏"原本的直觉定位
         ------------------------------------------------------------------- -->
    <Teleport to="body">
      <Transition name="drawer-fade">
        <div
          v-if="metaDialogOpen"
          class="fixed inset-0 z-[9998] bg-black/40 backdrop-blur-[2px]"
          @click.self="closeMeta"
          aria-hidden="true"
        />
      </Transition>
      <Transition name="drawer-slide-left">
        <aside
          v-if="metaDialogOpen"
          role="dialog"
          aria-modal="true"
          aria-labelledby="meta-drawer-title"
          class="fixed top-0 left-0 z-[9999] h-screen w-[560px] max-w-[92vw]
                 bg-surface-elevated border-r border-border/70
                 shadow-2xl shadow-black/30
                 flex flex-col overflow-hidden"
        >
          <!-- Drawer 头部 -->
          <div class="flex items-center justify-between gap-3 px-6 py-4 border-b border-border/60">
            <div class="flex items-center gap-2.5 min-w-0">
              <div class="size-10 rounded-xl bg-brand/10 text-brand flex items-center justify-center shrink-0">
                <PencilLine class="size-5" />
              </div>
              <div class="min-w-0">
                <div id="meta-drawer-title" class="text-[15.5px] font-semibold text-text leading-tight">文章元数据设置</div>
                <div class="text-xs text-text-muted mt-0.5 truncate">分类、标签、封面这些信息会显示在博客列表卡片上</div>
              </div>
            </div>
            <button
              type="button"
              class="btn-spec-b btn-spec-b--icon btn-spec-b--ghost"
              style="--btn-b-h: 36px; --btn-b-radius: 8px;"
              @click="closeMeta"
              aria-label="关闭（Esc）"
            >
              <XIcon class="btn-spec-b__icon" />
            </button>
          </div>
          <!-- Drawer 内容（滚动） -->
          <div class="flex-1 overflow-y-auto px-6 py-5 space-y-5">
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
              <!-- 分类 + 首页精选 一行 -->
              <div class="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_auto] gap-3">
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
                <div class="space-y-1.5">
                  <Label>&nbsp;</Label>
                  <!-- 首页精选（B 类规范 · 复选框内嵌） -->
                  <label class="btn-spec-b btn-spec-b--outline has-checkbox">
                    <input
                      type="checkbox"
                      v-model="featured"
                      id="featured-checkbox"
                    />
                    <Star
                      class="btn-spec-b__icon text-warning"
                      :class="{ 'fill-warning': featured }"
                    />
                    <span for="featured-checkbox">首页精选</span>
                  </label>
                </div>
              </div>

              <Separator />

              <!-- 标签：下拉多选（M3） -->
              <div class="space-y-1.5">
                <div class="flex items-center justify-between">
                  <Label>标签</Label>
                  <span class="text-[11px] text-text-muted">从现有标签选择，或输入后回车新建</span>
                </div>
                <div
                  ref="tagDropdownRoot"
                  class="relative"
                  @focusin="openTagDropdown"
                  @focusout="onTagDropdownFocusOut"
                >
                  <button
                    type="button"
                    class="w-full min-h-10 px-3 rounded-lg border border-input bg-surface text-left flex items-center flex-wrap gap-1.5 hover:border-brand/50 focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand transition"
                    :class="{ 'border-brand/60 ring-2 ring-brand/30': tagDropdownOpen }"
                    @click="onTagComboClick"
                  >
                    <template v-if="tagArr.length">
                      <Badge
                        v-for="t in tagArr"
                        :key="t"
                        variant="secondary"
                        class="group text-[11.5px] pr-1 inline-flex items-center gap-1 h-6"
                      >
                        <Hash class="size-3 opacity-70" />
                        <span>{{ t }}</span>
                        <span
                          class="size-4 rounded-sm hover:bg-text/10 text-text-muted hover:text-text inline-flex items-center justify-center transition"
                          @click.stop.prevent="removeTag(t)"
                          aria-label="移除标签"
                        >
                          <XIcon class="size-3" />
                        </span>
                      </Badge>
                    </template>
                    <input
                      ref="tagInputEl"
                      v-model="tagSearch"
                      type="text"
                      class="flex-1 min-w-[120px] h-8 bg-transparent outline-none text-sm placeholder:text-text-muted"
                      :placeholder="tagArr.length ? '' : '搜索或输入后回车新建…'"
                      @keydown="onTagInputKey"
                      @click.stop="openTagDropdown"
                    />
                    <ChevronDown class="size-4 text-text-muted shrink-0 transition" :class="{ '-rotate-180': tagDropdownOpen }" />
                  </button>
                  <!-- 下拉列表 -->
                  <Transition name="fade-down">
                    <div
                      v-if="tagDropdownOpen"
                      class="absolute z-20 left-0 right-0 mt-1.5 rounded-xl border border-border/70 bg-surface-elevated shadow-xl overflow-hidden max-h-64 overflow-y-auto"
                    >
                      <div v-if="!tagDictFiltered.length" class="px-4 py-6 text-sm text-text-muted text-center">
                        <Plus class="size-4 mx-auto mb-1 opacity-70" />
                        <div>
                          <span v-if="tagSearch.trim()">回车即可新建标签「{{ tagSearch }}」</span>
                          <span v-else>暂无可选标签，输入后回车即可创建</span>
                        </div>
                      </div>
                      <button
                        v-for="t in tagDictFiltered"
                        :key="t.id"
                        type="button"
                        class="w-full px-4 py-2 text-left text-sm flex items-center gap-2 hover:bg-surface-muted transition"
                        @mousedown.prevent="toggleTagDict(t)"
                      >
                        <Hash class="size-3.5 text-brand shrink-0" />
                        <span class="flex-1 truncate">{{ t.name }}</span>
                        <span class="text-[11px] text-text-muted tabular-nums shrink-0">×{{ (t as any).postCount ?? 0 }}</span>
                      </button>
                    </div>
                  </Transition>
                </div>
              </div>

              <Separator />

              <!-- 发布日期 -->
              <div class="space-y-1.5">
                <Label>发布日期</Label>
                <Input type="date" v-model="publishedAt"  />
              </div>

              <!-- 封面：拖拽上传（M3） -->
              <div class="space-y-2">
                <div class="flex items-center justify-between">
                  <Label>封面图（可选）</Label>
                  <span class="text-[11px] text-text-muted">JPG / PNG / WEBP / GIF，≤ 10MB</span>
                </div>

                <!-- 已有图预览 -->
                <Transition name="fade-down">
                  <div v-if="cover" class="relative w-full aspect-[16/9] rounded-xl border border-border/60 overflow-hidden bg-surface-muted group">
                    <img :src="cover" alt="封面预览" class="w-full h-full object-cover" @error="($event.target as HTMLImageElement).style.opacity = '0.3'" />
                    <div class="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent opacity-0 group-hover:opacity-100 transition" />
                    <div class="absolute top-2 right-2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition">
                      <Button
                        v-if="coverUploadState.stage !== 'done'"
                        type="button"
                        size="icon-sm"
                        variant="outline"
                        class="bg-surface-elevated/90 backdrop-blur-sm"
                        @click="pickCoverFile"
                        data-tip="重新上传"
                      >
                        <ImagePlus class="size-3.5" />
                      </Button>
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="outline"
                        class="bg-surface-elevated/90 backdrop-blur-sm text-danger hover:text-danger border-danger/30 hover:border-danger/60"
                        @click="clearCover"
                        data-tip="移除封面"
                      >
                        <Trash2 class="size-3.5" />
                      </Button>
                    </div>
                    <div class="absolute bottom-2 left-3 right-3 flex items-end justify-between gap-2 opacity-0 group-hover:opacity-100 transition">
                      <span class="text-[11px] text-white/90 max-w-[65%] truncate drop-shadow">
                        <template v-if="coverUploadState.file">{{ coverUploadState.file.name }} · {{ bytesToMb(coverUploadState.file.size) }}MB</template>
                        <template v-else>{{ cover.length > 60 ? cover.slice(0, 57) + '…' : cover }}</template>
                      </span>
                    </div>
                  </div>
                </Transition>

                <input
                  ref="coverFileInputRef"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  class="hidden"
                  @change="onCoverFileSelected"
                />

                <!-- 上传区域（无封面时显示） -->
                <button
                  v-if="!cover"
                  type="button"
                  class="w-full aspect-[16/9] min-h-[160px] rounded-xl border-2 transition flex flex-col items-center justify-center gap-2 px-4 text-center select-none"
                  :class="[
                    coverDragOver
                      ? 'border-brand bg-brand/6 ring-2 ring-brand/30'
                      : 'border-dashed border-border/70 bg-surface hover:border-brand/50 hover:bg-surface-muted/40',
                  ]"
                  @click="pickCoverFile"
                  @dragover="onCoverDragOver"
                  @dragleave="onCoverDragLeave"
                  @drop="onCoverDrop"
                >
                  <div class="size-11 rounded-2xl bg-brand/10 text-brand flex items-center justify-center">
                    <FileUp class="size-5" />
                  </div>
                  <div class="leading-snug">
                    <div class="text-sm font-medium text-text">点击或拖拽文件到这里</div>
                    <div class="text-xs text-text-muted mt-0.5">支持 JPG / PNG / WEBP / GIF，不超过 10MB</div>
                  </div>
                </button>

                <!-- 上传中进度条（参考图 UI） -->
                <Transition name="fade-down">
                  <div
                    v-if="coverUploadState.stage === 'uploading' || coverUploadState.stage === 'done'"
                    class="mt-2 rounded-xl border border-border/60 bg-surface p-3 flex items-center gap-3"
                  >
                    <div class="size-9 shrink-0 rounded-lg bg-brand/10 text-brand flex items-center justify-center">
                      <FileUp v-if="coverUploadState.stage === 'uploading'" class="size-4 animate-bounce" />
                      <Check v-else class="size-4 text-success" />
                    </div>
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center justify-between gap-2">
                        <span class="text-sm text-text truncate">{{ coverUploadState.file?.name }}</span>
                        <span class="text-xs text-text-muted tabular-nums shrink-0">{{ coverUploadState.progress }}%</span>
                      </div>
                      <div class="mt-1.5 h-1.5 rounded-full bg-surface-muted overflow-hidden">
                        <div
                          class="h-full rounded-full bg-gradient-to-r from-brand to-purple-400 transition-all duration-150"
                          :style="{ width: `${coverUploadState.progress}%` }"
                        />
                      </div>
                    </div>
                  </div>
                </Transition>

                <Separator />

                <!-- URL 兜底输入 -->
                <div class="space-y-1.5">
                  <div class="flex items-center gap-1.5 text-[11px] text-text-muted uppercase tracking-wider font-semibold">
                    <Link2 class="size-3.5" />
                    或直接粘贴图片 URL
                  </div>
                  <div class="relative">
                    <Input v-model="cover" placeholder="https://...封面图片链接" class="pr-10" />
                    <button
                      v-if="cover"
                      type="button"
                      class="absolute right-2 top-1/2 -translate-y-1/2 size-7 rounded-md text-text-muted hover:text-text hover:bg-surface-muted inline-flex items-center justify-center transition"
                      @click="clearCover"
                      aria-label="清除封面 URL"
                    >
                      <XIcon class="size-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              <Separator />

              <!-- 摘要 -->
              <div class="space-y-1.5">
                <div class="flex items-center justify-between">
                  <Label>摘要（可选，不填自动截正文）</Label>
                  <span class="text-[11px] text-text-muted tabular-nums">{{ excerpt.length }} 字</span>
                </div>
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
            </div>
            <!-- Drawer 底部（sticky 底部不受内容滚动影响） -->
            <div class="flex items-center justify-between gap-2 px-6 py-4 border-t border-border/60 bg-surface-muted/40">
              <div class="text-[11.5px] text-text-muted">
                <template v-if="loadedPost?.slug">slug：<span class="font-mono">{{ loadedPost.slug }}</span></template>
                <template v-else>保存后自动生成公开链接</template>
              </div>
              <div class="flex items-center gap-2">
                <!-- 完成 / 保存（B 类规范，统一与工具栏尺寸 40px） -->
                <button
                  type="button"
                  class="btn-spec-b btn-spec-b--toolbar"
                  @click="closeMeta"
                >
                  <span>完成</span>
                </button>
                <button
                  type="button"
                  class="btn-spec-b btn-spec-b--toolbar btn-spec-b--primary"
                  :disabled="saving"
                  @click="doSave"
                >
                  <template v-if="saving"><Sparkles class="btn-spec-b__icon animate-pulse" /></template>
                  <template v-else><Save class="btn-spec-b__icon" /></template>
                  <span>{{ saving ? '保存中…' : (isEditMode ? '保存修改' : '保存') }}</span>
                </button>
              </div>
            </div>
          </aside>
        </Transition>
      </Teleport>

    <!-- 删除确认弹窗 -->
    <Teleport to="body">
      <Transition name="char-fade">
        <div
          v-if="deleteConfirming"
          class="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          @click.self="deleteConfirming = false; hardDeleteEnabled = false"
        >
          <div class="w-full max-w-sm rounded-2xl bg-surface-elevated border border-border/70 shadow-2xl p-5">
            <div class="flex items-start gap-3">
              <div class="size-10 rounded-full bg-danger/10 text-danger flex items-center justify-center shrink-0">
                <AlertTriangle class="size-5" />
              </div>
              <div class="flex-1">
                <div class="text-lg font-semibold text-text">确定要删除这篇文章？</div>
                <div class="text-sm text-text-muted mt-1">默认会移入「回收站」（归档，后续可恢复）。需要永久删除请勾选下方选项。</div>
              </div>
              <button
                type="button"
                class="size-8 rounded-lg text-text-muted hover:text-text hover:bg-surface flex items-center justify-center transition"
                @click="deleteConfirming = false; hardDeleteEnabled = false"
              >
                <XIcon class="size-4" />
              </button>
            </div>

            <!-- 彻底删除开关（默认关闭，危险操作显式二次确认） -->
            <label
              for="hard-delete-toggle"
              class="mt-4 flex items-start gap-3 cursor-pointer select-none rounded-xl border px-4 py-3 transition"
              :class="hardDeleteEnabled
                ? 'border-danger/40 bg-danger/8 text-danger'
                : 'border-border/60 bg-surface-muted/20 text-text-secondary hover:border-danger/25 hover:bg-surface-muted/40'"
            >
              <input
                id="hard-delete-toggle"
                type="checkbox"
                v-model="hardDeleteEnabled"
                class="mt-[3px] size-4 accent-danger shrink-0"
              />
              <div class="flex-1 min-w-0">
                <div class="text-sm font-semibold">彻底删除（不可恢复）</div>
                <div class="text-[11px] leading-relaxed opacity-80 mt-0.5">
                  勾选后将直接从数据库物理删除，不会保留在回收站，也无法再通过后台恢复。仅在确定不再需要时使用。
                </div>
              </div>
            </label>

            <div class="mt-5 flex justify-end gap-2">
              <Button variant="outline" @click="deleteConfirming = false; hardDeleteEnabled = false">取消</Button>
              <Button
                class="text-white border-danger transition"
                :class="hardDeleteEnabled ? 'bg-danger hover:bg-danger/90' : 'bg-danger/85 hover:bg-danger'"
                @click="doDelete(hardDeleteEnabled); deleteConfirming = false"
              >
                <Check class="size-4" />
                {{ hardDeleteEnabled ? '确认彻底删除' : '确认删除（归档）' }}
              </Button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>
