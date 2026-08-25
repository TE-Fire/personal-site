/**
 * useBlogApi.ts · 博客数据 CRUD 统一抽象层
 *
 * 数据策略（localStorage + posts.ts 合并）：
 *   · 「内置文章」来自 posts.ts（只读，来源于 Mock/版本库）
 *   · 「用户文章」保存在 localStorage（可新增/修改/删除）
 *   · API 返回全部：[...用户文章(按 publishedAt 倒序), ...内置文章]
 *
 * 未来接入后端（如 GitHub Issue / Notion / 自建 API）：
 *   · 只要替换这个 composable 内部实现即可，调用方零修改
 *
 * 文章完整数据结构（BlogPost + content + cover + lastModified）：
 *   · slug            唯一标识，路由路径用
 *   · title           标题
 *   · excerpt         摘要（不填则自动截取 content 前 200 字）
 *   · content         Markdown 正文（只在用户文章中保证非空，内置文章仅展示卡片不含全文）
 *   · wordCount       正文字数（保存时自动计算）
 *   · publishedAt     发布日期 YYYY-MM-DD
 *   · category        分类（PostCategory 联合类型）
 *   · tags            标签数组
 *   · featured        是否首页精选
 *   · cover           封面图 URL（可选）
 *   · lastModified    最后修改时间 ISO 字符串（自动）
 */
import { computed, ref, watch, type Ref } from 'vue'
import { posts as builtInPosts, postArticleCategories, readingMinutes, type BlogPost, type PostArticleCategory } from '@/data/posts'

const STORAGE_KEY = 'blog-api:user-posts:v1'
const CATEGORY_KEY = 'blog-api:categories:v1'
const TAG_POOL_KEY = 'blog-api:tag-pool:v1'

/** 扩展字段：content / cover / lastModified 是用户文章特有 */
export type ExtendedBlogPost = BlogPost & {
  content: string
  cover?: string
  lastModified: string
  /** 标记是内置文章还是用户新增 */
  source: 'built-in' | 'user'
}

export type NewPostInput = Omit<ExtendedBlogPost, 'slug' | 'wordCount' | 'lastModified' | 'source'> & {
  slug?: string
}

/** ---------- 底层存储 ---------- */

type StoredUserPost = Omit<ExtendedBlogPost, 'source'>

function loadUserPosts(): StoredUserPost[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
  } catch {
    return []
  }
}

function saveUserPosts(list: StoredUserPost[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
  } catch {
    // quota exceeded / private mode
  }
}

/** ---------- 分类持久化 ---------- */

function loadCategories(): string[] {
  try {
    const raw = localStorage.getItem(CATEGORY_KEY)
    if (!raw) return [...postArticleCategories]
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed) || parsed.length === 0) return [...postArticleCategories]
    return parsed as string[]
  } catch {
    return [...postArticleCategories]
  }
}

function saveCategories(list: string[]) {
  try {
    localStorage.setItem(CATEGORY_KEY, JSON.stringify(list))
  } catch {
    // ignore
  }
}

/** ---------- 标签池持久化（独立于文章 tags） ---------- */

function loadTagPool(): string[] {
  try {
    const raw = localStorage.getItem(TAG_POOL_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed as string[]
  } catch {
    return []
  }
}

function saveTagPool(list: string[]) {
  try {
    localStorage.setItem(TAG_POOL_KEY, JSON.stringify(list))
  } catch {
    // ignore
  }
}

/** ---------- 标签统计类型 ---------- */

export type TagWithCount = { name: string; count: number }

/** ---------- 工具 ---------- */

function slugify(str: string): string {
  // 尽量用中文拼音的话太复杂，这里做简单处理：
  // 保留中文+字母+数字，空格和标点替换为「-」，去除首尾「-」
  const s = str
    .toLowerCase()
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/[^\p{Letter}\p{Number}-]+/gu, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
  return s || `post-${Date.now().toString(36)}`
}

function ensureUniqueSlug(slugBase: string, existing: string[]): string {
  let slug = slugBase
  let idx = 1
  while (existing.includes(slug)) {
    slug = `${slugBase}-${idx++}`
  }
  return slug
}

function countWords(md: string): number {
  if (!md) return 0
  // Markdown 粗略字数：去除 ``` fenced code block 内单独计数不准确，这里用字符数除以 1.5（中文单字、英文单词混合）
  const stripped = md
    .replace(/```[\s\S]*?```/g, (code) => {
      // 代码块按真实字符数 / 4 估算
      return code.length > 4 ? 'x'.repeat(Math.floor(code.length / 4)) : ''
    })
    .replace(/`[^`]*`/g, 'x')
    .replace(/!\[.*?\]\(.*?\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[>#*_~\-\|]/g, '')
    .replace(/\s+/g, '')
  return stripped.length
}

function excerptFromContent(md: string): string {
  const plain = md
    .replace(/```[\s\S]*?```/g, '')
    .replace(/[>#*_~\-`!\[\]()]/g, '')
    .replace(/\s+/g, '')
    .slice(0, 140)
  return plain.length > 140 ? `${plain}…` : plain
}

/** ---------- 模块级单例 ref（跨组件共享状态） ---------- */

const _userPosts: Ref<StoredUserPost[]> = ref(loadUserPosts())
const _categories: Ref<string[]> = ref(loadCategories())
const _tagPool: Ref<string[]> = ref(loadTagPool())
let _watchersInit = false

function initWatchers() {
  if (_watchersInit) return
  _watchersInit = true
  watch(_userPosts, (next) => saveUserPosts(next), { deep: true })
  watch(_categories, (next) => saveCategories(next), { deep: true })
  watch(_tagPool, (next) => saveTagPool(next), { deep: true })
}

/** ---------- API ---------- */

export function useBlogApi() {
  initWatchers()

  const userPosts = _userPosts
  const categories = _categories

  const builtInExtended: Ref<ExtendedBlogPost[]> = ref(
    builtInPosts.map<ExtendedBlogPost>((p) => ({
      ...p,
      content: '',
      cover: undefined,
      lastModified: p.publishedAt,
      source: 'built-in'
    }))
  )

  /** 所有文章（用户在前 → 因为更「新」，各自内部按 publishedAt 倒序） */
  const allPosts = computed<ExtendedBlogPost[]>(() => {
    const merged: ExtendedBlogPost[] = [
      ...userPosts.value
        .map<ExtendedBlogPost>((p) => ({ ...p, source: 'user' as const }))
        .sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : -1)),
      ...builtInExtended.value
    ]
    return merged
  })

  /** 只返回满足 BlogPost 类型（用于现有列表页消费，不感知 content） */
  const listPosts = computed<BlogPost[]>(() => allPosts.value)

  /** 总文章数（含内置） */
  const totalCount = computed(() => allPosts.value.length)

  /** 重新封装的 readingMinutes（兼容 widget 等消费端） */
  const totalReading = computed(() =>
    allPosts.value.reduce((acc, p) => acc + readingMinutes(p.wordCount), 0)
  )

  function getBySlug(slug: string): ExtendedBlogPost | undefined {
    return allPosts.value.find((p) => p.slug === slug)
  }

  function existsSlug(slug: string): boolean {
    return allPosts.value.some((p) => p.slug === slug)
  }

  /** 新建文章 */
  function createPost(input: NewPostInput): ExtendedBlogPost {
    const slug = ensureUniqueSlug(
      input.slug?.trim() ? slugify(input.slug.trim()) : slugify(input.title),
      allPosts.value.map((p) => p.slug)
    )
    const content = input.content ?? ''
    const wordCount = countWords(content)
    const excerpt = input.excerpt?.trim() || excerptFromContent(content)
    const today = new Date()
    const iso = today.toISOString()
    const publishedAt =
      input.publishedAt ||
      `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

    const post: StoredUserPost = {
      slug,
      title: input.title.trim(),
      excerpt,
      content,
      wordCount,
      publishedAt,
      category: input.category || '工程笔记',
      tags: (input.tags || []).filter((t) => t.trim().length > 0),
      featured: !!input.featured,
      cover: input.cover?.trim() || undefined,
      lastModified: iso
    }
    userPosts.value = [post, ...userPosts.value]
    return { ...post, source: 'user' }
  }

  /** 更新文章（仅用户文章可改，内置文章返回 undefined） */
  function updatePost(slug: string, patch: Partial<NewPostInput>): ExtendedBlogPost | undefined {
    const idx = userPosts.value.findIndex((p) => p.slug === slug)
    if (idx < 0) return undefined
    const cur = userPosts.value[idx]

    // 如果 title 或 slug 变了 → 重新 slugify + 唯一性校验
    let finalSlug = cur.slug
    if (patch.slug && patch.slug.trim() && patch.slug.trim() !== cur.slug) {
      finalSlug = ensureUniqueSlug(
        slugify(patch.slug.trim()),
        allPosts.value.filter((p) => p.slug !== slug).map((p) => p.slug)
      )
    } else if (patch.title && patch.title.trim() !== cur.title) {
      // 标题变了但 slug 没显式改：保持 slug 不变，避免死链接
    }

    const newContent = patch.content !== undefined ? patch.content : cur.content
    const newWordCount = countWords(newContent)
    const newTitle = (patch.title?.trim()) || cur.title
    const newExcerpt =
      (patch.excerpt?.trim() ? patch.excerpt.trim() : undefined) ??
      (patch.content !== undefined ? excerptFromContent(newContent) : cur.excerpt)

    const updated: StoredUserPost = {
      ...cur,
      slug: finalSlug,
      title: newTitle,
      excerpt: newExcerpt,
      content: newContent,
      wordCount: newWordCount,
      category: patch.category || cur.category,
      tags: patch.tags ? patch.tags.filter((t) => t.trim().length > 0) : cur.tags,
      featured: patch.featured !== undefined ? patch.featured : cur.featured,
      cover: patch.cover !== undefined ? (patch.cover?.trim() || undefined) : cur.cover,
      publishedAt: patch.publishedAt || cur.publishedAt,
      lastModified: new Date().toISOString()
    }
    const next = [...userPosts.value]
    next[idx] = updated
    userPosts.value = next
    return { ...updated, source: 'user' }
  }

  /** 删除文章（仅用户文章可删，内置文章删不掉） */
  function deletePost(slug: string): boolean {
    const before = userPosts.value.length
    userPosts.value = userPosts.value.filter((p) => p.slug !== slug)
    return userPosts.value.length < before
  }

  /** 从 Markdown 文件导入：frontmatter 解析 title/category/tags/publishedAt + 正文 */
  function importFromMarkdown(fileName: string, md: string): ExtendedBlogPost {
    let content = md
    let fmTitle: string | undefined
    let fmCategory: PostArticleCategory | undefined
    let fmTags: string[] | undefined
    let fmPublishedAt: string | undefined
    let fmSlug: string | undefined
    let fmExcerpt: string | undefined

    // 解析 front matter（yaml 风格，--- 开头和结尾，简单解析键值对即可，不引入 js-yaml）
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
          case 'title':
            fmTitle = clean
            break
          case 'slug':
          case 'id':
            fmSlug = clean
            break
          case 'category':
          case 'categories':
            if (categories.value.includes(clean)) {
              fmCategory = clean
            }
            break
          case 'tags':
            fmTags = [clean]
            break
          case 'date':
          case 'published':
          case 'publishedAt':
            fmPublishedAt = clean
            break
          case 'excerpt':
          case 'description':
            fmExcerpt = clean
            break
        }
      })
    }

    const fallbackTitle = fileName.replace(/\.(md|markdown)$/i, '') || `导入的文章`

    return createPost({
      slug: fmSlug,
      title: fmTitle || fallbackTitle,
      excerpt: fmExcerpt || '',
      content,
      category: fmCategory || '工程笔记',
      tags: fmTags || [],
      publishedAt: fmPublishedAt || new Date().toISOString().slice(0, 10),
      featured: false,
      cover: undefined
    })
  }

  /** 导出文章为 Markdown（带 front-matter） */
  function exportToMarkdown(post: ExtendedBlogPost): { fileName: string; content: string } {
    const tagsStr = post.tags.length ? `[${post.tags.map((t) => `'${t}'`).join(', ')}]` : '[]'
    const fm = [
      '---',
      `title: '${post.title.replace(/'/g, "''")}'`,
      `slug: '${post.slug}'`,
      `category: ${post.category}`,
      `tags: ${tagsStr}`,
      `publishedAt: ${post.publishedAt}`,
      `featured: ${post.featured}`,
      ...(post.cover ? [`cover: '${post.cover}'`] : []),
      `lastModified: ${post.lastModified}`,
      '---',
      ''
    ].join('\n')
    const body = post.content
    return {
      fileName: `${post.slug}.md`,
      content: `${fm}${body}`
    }
  }

  // ---------- 分类管理（可持久化，模块级单例） ----------

  /** 筛选用分类列表（含「全部」前缀） */
  const postCategories = computed<string[]>(() => ['全部', ...categories.value])

  /** 新增分类（去重，返回是否成功） */
  function addCategory(name: string): boolean {
    const trimmed = name.trim()
    if (!trimmed || categories.value.includes(trimmed)) return false
    categories.value = [...categories.value, trimmed]
    return true
  }

  /** 重命名分类（同步更新所有使用该分类的用户文章） */
  function renameCategory(oldName: string, newName: string): boolean {
    const trimmed = newName.trim()
    if (!trimmed || trimmed === oldName || categories.value.includes(trimmed)) return false
    categories.value = categories.value.map((c) => (c === oldName ? trimmed : c))
    // 同步更新用户文章
    userPosts.value = userPosts.value.map((p) =>
      p.category === oldName ? { ...p, category: trimmed, lastModified: new Date().toISOString() } : p
    )
    return true
  }

  /** 删除分类（使用该分类的用户文章迁移到 fallback 分类，默认第一个） */
  function deleteCategory(name: string, fallback?: string): boolean {
    if (!categories.value.includes(name)) return false
    if (categories.value.length <= 1) return false // 至少保留 1 个
    const target = (fallback && categories.value.includes(fallback)) ? fallback : categories.value.find((c) => c !== name)!
    categories.value = categories.value.filter((c) => c !== name)
    // 迁移用户文章
    userPosts.value = userPosts.value.map((p) =>
      p.category === name ? { ...p, category: target, lastModified: new Date().toISOString() } : p
    )
    return true
  }

  // ---------- 标签管理（直接作用于文章 tags 字段 + 标签池） ----------

  /** 所有标签 + 使用次数（统计全部文章含内置 + 标签池中的独立标签） */
  const allTagsWithCount = computed<TagWithCount[]>(() => {
    const map = new Map<string, number>()
    // 先把标签池中所有标签放进去（计数 0）
    _tagPool.value.forEach((t) => map.set(t, 0))
    // 再统计文章中的标签
    allPosts.value.forEach((p) => {
      p.tags.forEach((t) => {
        map.set(t, (map.get(t) || 0) + 1)
      })
    })
    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
  })

  /** 新增标签（加入标签池，返回是否成功） */
  function addTag(name: string): boolean {
    const trimmed = name.trim()
    if (!trimmed) return false
    // 检查是否已存在于文章 tags 或标签池
    const existsInPosts = allPosts.value.some((p) => p.tags.includes(trimmed))
    if (existsInPosts || _tagPool.value.includes(trimmed)) return false
    _tagPool.value = [..._tagPool.value, trimmed]
    return true
  }

  /** 重命名标签（仅作用于用户文章；同步更新标签池；内置文章不可改） */
  function renameTag(oldName: string, newName: string): boolean {
    const trimmed = newName.trim()
    if (!trimmed || trimmed === oldName) return false
    let changed = false
    userPosts.value = userPosts.value.map((p) => {
      if (!p.tags.includes(oldName)) return p
      changed = true
      return {
        ...p,
        tags: p.tags.map((t) => (t === oldName ? trimmed : t)),
        lastModified: new Date().toISOString()
      }
    })
    // 同步标签池
    if (_tagPool.value.includes(oldName)) {
      _tagPool.value = _tagPool.value.map((t) => (t === oldName ? trimmed : t))
      changed = true
    }
    return changed
  }

  /** 合并标签（source → target，仅作用于用户文章；同步标签池） */
  function mergeTag(sourceTag: string, targetTag: string): boolean {
    if (sourceTag === targetTag) return false
    let changed = false
    userPosts.value = userPosts.value.map((p) => {
      if (!p.tags.includes(sourceTag)) return p
      changed = true
      const tags = p.tags.filter((t) => t !== sourceTag)
      if (!tags.includes(targetTag)) tags.push(targetTag)
      return { ...p, tags, lastModified: new Date().toISOString() }
    })
    // 源标签在标签池中 → 移除
    if (_tagPool.value.includes(sourceTag)) {
      _tagPool.value = _tagPool.value.filter((t) => t !== sourceTag)
      changed = true
    }
    // 目标标签不在标签池且不在任何文章 → 加入标签池
    const targetExists = allPosts.value.some((p) => p.tags.includes(targetTag)) || _tagPool.value.includes(targetTag)
    if (!targetExists) {
      _tagPool.value = [..._tagPool.value, targetTag]
    }
    return changed
  }

  /** 删除标签（从所有用户文章中移除 + 从标签池移除） */
  function deleteTag(tagName: string): boolean {
    let changed = false
    userPosts.value = userPosts.value.map((p) => {
      if (!p.tags.includes(tagName)) return p
      changed = true
      return { ...p, tags: p.tags.filter((t) => t !== tagName), lastModified: new Date().toISOString() }
    })
    if (_tagPool.value.includes(tagName)) {
      _tagPool.value = _tagPool.value.filter((t) => t !== tagName)
      changed = true
    }
    return changed
  }

  return {
    // 列表
    listPosts,
    allPosts,
    totalCount,
    totalReading,
    // 单条
    getBySlug,
    existsSlug,
    // CRUD
    createPost,
    updatePost,
    deletePost,
    // MD 导入导出
    importFromMarkdown,
    exportToMarkdown,
    // 分类管理
    categories,
    postCategories,
    addCategory,
    renameCategory,
    deleteCategory,
    // 标签管理
    allTagsWithCount,
    addTag,
    renameTag,
    mergeTag,
    deleteTag,
    // 工具
    slugify,
    countWords,
    readingMinutes
  }
}
