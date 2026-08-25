<script setup lang="ts">
/**
 * MarkdownEditor.vue · 稳定的分栏 Markdown 编辑器
 * 依赖：marked（解析）+ highlight.js（代码块高亮）
 * 功能：
 *   - 左编辑 / 右预览 分栏（可切换为只编辑 / 只预览）
 *   - 工具栏：加粗 / 斜体 / 代码 / 引用 / 标题 H1-H3 / 有序 / 无序 / 链接 / 图片 / 表格 / 分割线 / 撤销重做
 *   - Tab 键缩进 2 空格，支持多行选中整块缩进（Shift+Tab 反向）
 *   - 字号控制（14/16/18）
 *   - 紫色主题对齐 highlight.js 代码块
 *   - 导入 .md 文件（按钮调用 openFile）、导出 .md（按钮调用 getValue）
 * 发出事件：update:modelValue / change / import（文件内容交给父级解析 front-matter）
 */
import { computed, ref, watch } from 'vue'
import type { FunctionalComponent } from 'vue'
import {
  Bold, Italic, Code, Quote, Heading1, Heading2, Heading3,
  List, ListOrdered, Link, Image, Table, Minus,
  Undo2, Redo2, LayoutGrid, Eye, PencilLine, Plus, Minus as MinusIcon
} from 'lucide-vue-next'
import type { LucideProps } from 'lucide-vue-next'
import { marked } from 'marked'
import { markedHighlight } from 'marked-highlight'
import hljs from 'highlight.js/lib/common'

// marked config + 代码高亮（marked v12+ 语法：通过 use/扩展注册）
marked.use(
  markedHighlight({
    langPrefix: 'hljs language-',
    highlight(code, lang) {
      try {
        if (lang && hljs.getLanguage(lang)) {
          return hljs.highlight(code, { language: lang, ignoreIllegals: true }).value
        }
        return hljs.highlightAuto(code).value
      } catch {
        return code
      }
    }
  })
)
marked.setOptions({
  gfm: true,
  breaks: true
})

const props = withDefaults(defineProps<{
  modelValue: string
  /** 编辑区字号 px，默认 15 */
  fontSize?: number
}>(), {
  modelValue: '',
  fontSize: 15
})

const emit = defineEmits<{
  (e: 'update:modelValue', v: string): void
  (e: 'change', v: string): void
  /** 用户点击「导入 MD 文件」按钮后，父级决定如何处理 front-matter 等 */
  (e: 'import-request'): void
}>()

const textareaEl = ref<HTMLTextAreaElement | null>(null)

const internalValue = ref(props.modelValue)
watch(() => props.modelValue, (v) => {
  if (v !== internalValue.value) internalValue.value = v
})

function update(v: string) {
  internalValue.value = v
  emit('update:modelValue', v)
  emit('change', v)
}

/* -------------- 分栏模式 -------------- */
type LayoutMode = 'split' | 'editor' | 'preview'
const layout = ref<LayoutMode>('split')

const showEditor = computed(() => layout.value === 'split' || layout.value === 'editor')
const showPreview = computed(() => layout.value === 'split' || layout.value === 'preview')

const localFontSize = ref(props.fontSize)

/* -------------- HTML 渲染输出 -------------- */
const renderedHtml = computed(() => marked.parse(internalValue.value || '') as string)

/* -------------- 历史栈（撤销 / 重做） -------------- */
const history = ref<string[]>([internalValue.value || ''])
const historyIdx = ref(0)
let historyFrozen = false

function pushHistory(v: string) {
  if (historyFrozen) return
  if (history.value[historyIdx.value] === v) return
  // 截断当前指针之后的
  history.value = history.value.slice(0, historyIdx.value + 1)
  history.value.push(v)
  if (history.value.length > 200) history.value.shift()
  historyIdx.value = history.value.length - 1
}

// 记录到 history 的节奏：输入停止后 400ms 快照一次
let debounceTimer: ReturnType<typeof setTimeout> | null = null
function handleInput() {
  update(textareaEl.value!.value)
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    pushHistory(internalValue.value)
  }, 400)
}

function onBlur() {
  pushHistory(internalValue.value)
}

function doUndo() {
  if (historyIdx.value <= 0) return
  historyFrozen = true
  historyIdx.value--
  update(history.value[historyIdx.value])
  setTimeout(() => { historyFrozen = false }, 10)
}

function doRedo() {
  if (historyIdx.value >= history.value.length - 1) return
  historyFrozen = true
  historyIdx.value++
  update(history.value[historyIdx.value])
  setTimeout(() => { historyFrozen = false }, 10)
}

/* -------------- 工具栏：文本封装 / 插入 -------------- */
function getSel(): [number, number] {
  const t = textareaEl.value!
  return [t.selectionStart, t.selectionEnd]
}

function setSel(start: number, end: number) {
  const t = textareaEl.value!
  t.setSelectionRange(start, end)
  t.focus()
}

function wrapSelection(before: string, after = before, placeholder = '') {
  const t = textareaEl.value!
  const [s, e] = getSel()
  const val = t.value
  const sel = val.slice(s, e) || placeholder
  const next = val.slice(0, s) + before + sel + after + val.slice(e)
  update(next)
  pushHistory(next)
  setSel(s + before.length, s + before.length + sel.length)
}

function prefixLines(prefix: string, useSpaceAfter: boolean = true) {
  const t = textareaEl.value!
  const [s, e] = getSel()
  const val = t.value
  // 扩展到行首
  let lineStart = s
  while (lineStart > 0 && val[lineStart - 1] !== '\n') lineStart--
  let lineEnd = e
  while (lineEnd < val.length && val[lineEnd] !== '\n') lineEnd++
  const prefixStr = prefix + (useSpaceAfter && prefix.length > 0 ? ' ' : '')
  const block = val.slice(lineStart, lineEnd)
  const replaced = block
    .split('\n')
    .map((l) => `${prefixStr}${l}`)
    .join('\n')
  const next = val.slice(0, lineStart) + replaced + val.slice(lineEnd)
  update(next)
  pushHistory(next)
  setSel(lineStart, lineStart + replaced.length)
}

function insertAtCursor(text: string, caretOffset = 0) {
  const t = textareaEl.value!
  const [s, e] = getSel()
  const val = t.value
  const next = val.slice(0, s) + text + val.slice(e)
  update(next)
  pushHistory(next)
  const pos = s + caretOffset || s + text.length
  setSel(pos, pos)
}

type ToolbarItem =
  | {
      readonly id: string
      readonly label: string
      readonly icon: FunctionalComponent<LucideProps>
      readonly action: () => void
    }
  | { readonly id: `sep-${string}` }

const toolbar: ToolbarItem[] = [
  { id: 'h1', label: '标题 1', icon: Heading1, action: () => prefixLines('#') },
  { id: 'h2', label: '标题 2', icon: Heading2, action: () => prefixLines('##') },
  { id: 'h3', label: '标题 3', icon: Heading3, action: () => prefixLines('###') },
  { id: 'sep-1' } as const,
  { id: 'bold', label: '加粗', icon: Bold, action: () => wrapSelection('**', '**', '加粗文本') },
  { id: 'italic', label: '斜体', icon: Italic, action: () => wrapSelection('*', '*', '斜体文本') },
  { id: 'code', label: '行内代码', icon: Code, action: () => wrapSelection('`', '`', 'code') },
  { id: 'quote', label: '引用', icon: Quote, action: () => prefixLines('>') },
  { id: 'sep-2' } as const,
  { id: 'ul', label: '无序列表', icon: List, action: () => prefixLines('-') },
  { id: 'ol', label: '有序列表', icon: ListOrdered, action: () => {
    // 每行加「1. 」
    const t = textareaEl.value!
    const [s, e] = getSel()
    const val = t.value
    let lineStart = s
    while (lineStart > 0 && val[lineStart - 1] !== '\n') lineStart--
    let lineEnd = e
    while (lineEnd < val.length && val[lineEnd] !== '\n') lineEnd++
    const block = val.slice(lineStart, lineEnd)
    const replaced = block
      .split('\n')
      .map((l, i) => `${i + 1}. ${l}`)
      .join('\n')
    const next = val.slice(0, lineStart) + replaced + val.slice(lineEnd)
    update(next)
    pushHistory(next)
    setSel(lineStart, lineStart + replaced.length)
  } },
  { id: 'sep-3' },
  { id: 'link', label: '链接', icon: Link, action: () => wrapSelection('[', '](https://)', '链接文本') },
  { id: 'image', label: '图片', icon: Image, action: () => insertAtCursor('![Alt 文本](https://)', 2) },
  { id: 'table', label: '表格', icon: Table, action: () => insertAtCursor(
`| 列 1 | 列 2 | 列 3 |
| --- | --- | --- |
| 左对齐 | 居中 | 右对齐 |
| 内容 | 内容 | 内容 |
`) },
  { id: 'hr', label: '分割线', icon: Minus, action: () => insertAtCursor('\n\n---\n\n') },
  { id: 'sep-3' } as const
]

/* -------------- Tab 缩进处理 -------------- */
function onKeyDown(ev: KeyboardEvent) {
  if (ev.key === 'Tab') {
    ev.preventDefault()
    const t = textareaEl.value!
    const [s, e] = getSel()
    const val = t.value
    const isShift = ev.shiftKey

    // 多行选中 → 每行行首加/去缩进
    if (s !== e) {
      let lineStart = s
      while (lineStart > 0 && val[lineStart - 1] !== '\n') lineStart--
      const block = val.slice(lineStart, e)
      let replaced: string
      if (isShift) {
        replaced = block
          .split('\n')
          .map((l) => l.startsWith('  ') ? l.slice(2) : (l.startsWith('\t') ? l.slice(1) : l))
          .join('\n')
      } else {
        replaced = block
          .split('\n')
          .map((l) => `  ${l}`)
          .join('\n')
      }
      const next = val.slice(0, lineStart) + replaced + val.slice(e)
      update(next)
      pushHistory(next)
      setSel(lineStart, lineStart + replaced.length)
      return
    }

    // 单行光标 → 插入 2 空格
    insertAtCursor('  ', 2)
    return
  }
  // 撤销 / 重做（Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y）
  const ctrl = ev.ctrlKey || ev.metaKey
  if (ctrl && ev.key.toLowerCase() === 'z') {
    if (ev.shiftKey) {
      ev.preventDefault()
      doRedo()
    } else {
      ev.preventDefault()
      doUndo()
    }
    return
  }
  if (ctrl && ev.key.toLowerCase() === 'y') {
    ev.preventDefault()
    doRedo()
  }
}

/* -------------- 字号 -------------- */
function bumpFontSize(delta: number) {
  localFontSize.value = Math.min(22, Math.max(13, localFontSize.value + delta))
}

/* -------------- 对外方法 -------------- */
defineExpose({
  /** 插入到光标处 */
  insert: insertAtCursor,
  /** 触发导入（由父级处理 file input） */
  triggerImport: () => emit('import-request'),
  /** 当前 Markdown 值 */
  getValue: () => internalValue.value,
  /** 设置值（会清历史） */
  setValue(v: string) {
    internalValue.value = v
    history.value = [v]
    historyIdx.value = 0
    emit('update:modelValue', v)
    emit('change', v)
  }
})
</script>

<template>
  <div class="md-editor-root rounded-2xl border border-border/70 overflow-hidden bg-surface-elevated/40 shadow-sm flex flex-col">
    <!-- 工具栏 -->
    <div class="flex flex-wrap items-center gap-1 px-3 py-2 border-b border-border/60 bg-surface/60">
      <template v-for="(item, _) in toolbar" :key="item.id">
        <div v-if="'label' in item === false" class="w-px self-stretch bg-border/60 mx-1" />
        <button
          v-else
          type="button"
          class="group relative rounded-lg px-2 py-1.5 text-text-muted hover:text-text hover:bg-brand/10 transition-colors"
          :title="item.label"
          @click="item.action"
        >
          <component :is="item.icon" class="size-[17px]" />
        </button>
      </template>

      <div class="w-px self-stretch bg-border/60 mx-2" />

      <!-- 撤销/重做 -->
      <button
        type="button"
        class="rounded-lg px-2 py-1.5 text-text-muted hover:text-text hover:bg-surface transition"
        title="撤销 (Ctrl+Z)"
        :disabled="historyIdx <= 0"
        @click="doUndo"
      >
        <Undo2 class="size-[17px]" />
      </button>
      <button
        type="button"
        class="rounded-lg px-2 py-1.5 text-text-muted hover:text-text hover:bg-surface transition"
        title="重做 (Ctrl+Y / Ctrl+Shift+Z)"
        :disabled="historyIdx >= history.length - 1"
        @click="doRedo"
      >
        <Redo2 class="size-[17px]" />
      </button>

      <div class="w-px self-stretch bg-border/60 mx-2" />

      <!-- 字号控制 -->
      <div class="flex items-center gap-0.5 rounded-lg border border-border/60 bg-surface overflow-hidden">
        <button
          type="button"
          class="p-1.5 text-text-muted hover:text-text hover:bg-surface"
          title="减小字号"
          @click="bumpFontSize(-1)"
        >
          <MinusIcon class="size-4" />
        </button>
        <span class="text-xs font-medium px-1.5 min-w-[32px] text-center tabular-nums">{{ localFontSize }}px</span>
        <button
          type="button"
          class="p-1.5 text-text-muted hover:text-text hover:bg-surface"
          title="增大字号"
          @click="bumpFontSize(1)"
        >
          <Plus class="size-4" />
        </button>
      </div>

      <div class="flex-1" />

      <!-- 分栏切换 -->
      <div class="flex items-center rounded-lg border border-border/60 bg-surface overflow-hidden p-0.5">
        <button
          type="button"
          class="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition"
          :class="layout === 'editor' ? 'bg-brand text-brand-on shadow' : 'text-text-muted hover:text-text'"
          title="只显示编辑区"
          @click="layout = 'editor'"
        >
          <PencilLine class="size-3.5" />
          编辑
        </button>
        <button
          type="button"
          class="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition"
          :class="layout === 'split' ? 'bg-brand text-brand-on shadow' : 'text-text-muted hover:text-text'"
          title="分栏（编辑 + 预览）"
          @click="layout = 'split'"
        >
          <LayoutGrid class="size-3.5" />
          分栏
        </button>
        <button
          type="button"
          class="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition"
          :class="layout === 'preview' ? 'bg-brand text-brand-on shadow' : 'text-text-muted hover:text-text'"
          title="只显示预览区"
          @click="layout = 'preview'"
        >
          <Eye class="size-3.5" />
          预览
        </button>
      </div>
    </div>

    <!-- 主体：分栏 -->
    <div class="relative flex-1 flex min-h-[480px] max-h-[72vh]">
      <!-- 编辑区 -->
      <div
        v-show="showEditor"
        class="relative flex-1 min-w-0 flex flex-col"
        :class="{ 'border-r border-border/60': showEditor && showPreview }"
      >
        <textarea
          ref="textareaEl"
          spellcheck="false"
          class="w-full h-full resize-none outline-none bg-transparent text-text font-mono leading-relaxed p-4 focus-within:ring-0 focus:ring-0"
          :style="{ fontSize: `${localFontSize}px`, lineHeight: '1.7' }"
          :value="internalValue"
          placeholder="在这里用 Markdown 写下你的想法…（Ctrl+Z 撤销 / Ctrl+Shift+Z 重做 / Tab 缩进）"
          @input="handleInput"
          @blur="onBlur"
          @keydown="onKeyDown"
        />
      </div>

      <!-- 预览区 -->
      <div
        v-show="showPreview"
        class="relative flex-1 min-w-0 overflow-auto p-4 md-preview markdown-body"
        v-html="renderedHtml"
      />
    </div>
  </div>
</template>

<style>
/* 预览 Markdown 样式（全局，避免 scoped 下的样式穿透问题）—— .md-preview.markdown-body */
.md-preview.markdown-body {
  color: hsl(var(--text));
  line-height: 1.75;
  word-break: break-word;
}
.md-preview.markdown-body > * + * {
  margin-top: 1em;
}
.md-preview.markdown-body h1,
.md-preview.markdown-body h2,
.md-preview.markdown-body h3,
.md-preview.markdown-body h4,
.md-preview.markdown-body h5,
.md-preview.markdown-body h6 {
  font-weight: 700;
  letter-spacing: -0.01em;
  line-height: 1.25;
  margin-top: 1.8em;
  margin-bottom: 0.6em;
}
.md-preview.markdown-body h1 { font-size: 1.95em; }
.md-preview.markdown-body h2 { font-size: 1.55em; padding-bottom: 0.3em; border-bottom: 1px solid hsl(var(--border) / 0.6); }
.md-preview.markdown-body h3 { font-size: 1.28em; }
.md-preview.markdown-body h4 { font-size: 1.1em; }

.md-preview.markdown-body p { margin: 0.6em 0; }

.md-preview.markdown-body a {
  color: hsl(var(--brand));
  text-decoration: underline;
  text-decoration-thickness: 1px;
  text-underline-offset: 3px;
}
.md-preview.markdown-body a:hover { color: hsl(var(--accent)); }

.md-preview.markdown-body strong { color: hsl(var(--text)); }
.md-preview.markdown-body em { color: inherit; }

.md-preview.markdown-body blockquote {
  margin: 1em 0;
  padding: 0.4em 1em;
  border-left: 4px solid hsl(var(--brand));
  background: hsl(var(--brand) / 0.06);
  color: hsl(var(--text-secondary, var(--text-muted)));
  border-radius: 0 0.5rem 0.5rem 0;
}

.md-preview.markdown-body ul,
.md-preview.markdown-body ol {
  padding-left: 1.6em;
  margin: 0.6em 0;
}
.md-preview.markdown-body ul { list-style: disc; }
.md-preview.markdown-body ol { list-style: decimal; }
.md-preview.markdown-body li + li { margin-top: 0.3em; }
.md-preview.markdown-body li ul,
.md-preview.markdown-body li ol { margin: 0.4em 0; }

.md-preview.markdown-body table {
  width: 100%;
  border-collapse: collapse;
  margin: 1em 0;
  font-size: 0.95em;
}
.md-preview.markdown-body th,
.md-preview.markdown-body td {
  border: 1px solid hsl(var(--border) / 0.8);
  padding: 0.55em 0.9em;
  text-align: left;
}
.md-preview.markdown-body th {
  background: hsl(var(--brand) / 0.08);
  font-weight: 600;
}
.md-preview.markdown-body tr:nth-child(2n) td { background: hsl(var(--surface) / 0.4); }

.md-preview.markdown-body hr {
  border: none;
  border-top: 2px dashed hsl(var(--border));
  margin: 2em 0;
}

.md-preview.markdown-body img {
  max-width: 100%;
  border-radius: 0.75rem;
  border: 1px solid hsl(var(--border) / 0.6);
}

.md-preview.markdown-body code {
  font-family: var(--font-mono), 'JetBrains Mono', Consolas, monospace;
  font-size: 0.92em;
  padding: 0.15em 0.4em;
  background: hsl(var(--brand) / 0.10);
  color: hsl(var(--accent));
  border-radius: 0.35rem;
}

.md-preview.markdown-body pre {
  margin: 1em 0;
  padding: 1em 1.1em;
  background: hsl(var(--color-bg, 0 0% 6%));
  border: 1px solid hsl(var(--border) / 0.8);
  border-radius: 0.85rem;
  overflow: auto;
  font-size: 0.88em;
  line-height: 1.65;
}
.md-preview.markdown-body pre code {
  background: transparent;
  padding: 0;
  color: inherit;
  font-size: inherit;
  border-radius: 0;
}

/* hljs 紫色主题（跟站点设计系统对齐） */
.md-preview.markdown-body .hljs {
  background: transparent;
  color: hsl(0 0% 88%);
}
.md-preview.markdown-body .hljs-comment,
.md-preview.markdown-body .hljs-quote {
  color: hsl(263 15% 60%);
  font-style: italic;
}
.md-preview.markdown-body .hljs-keyword,
.md-preview.markdown-body .hljs-selector-tag,
.md-preview.markdown-body .hljs-literal,
.md-preview.markdown-body .hljs-name,
.md-preview.markdown-body .hljs-tag {
  color: hsl(263 85% 75%);
}
.md-preview.markdown-body .hljs-built_in,
.md-preview.markdown-body .hljs-type,
.md-preview.markdown-body .hljs-class,
.md-preview.markdown-body .hljs-number {
  color: hsl(190 80% 65%);
}
.md-preview.markdown-body .hljs-string,
.md-preview.markdown-body .hljs-attr,
.md-preview.markdown-body .hljs-regexp {
  color: hsl(330 85% 72%);
}
.md-preview.markdown-body .hljs-variable,
.md-preview.markdown-body .hljs-template-variable {
  color: hsl(50 100% 65%);
}
.md-preview.markdown-body .hljs-function,
.md-preview.markdown-body .hljs-title.function_ {
  color: hsl(145 65% 60%);
}
.md-preview.markdown-body .hljs-title,
.md-preview.markdown-body .hljs-section {
  color: hsl(263 90% 85%);
  font-weight: 600;
}
.md-preview.markdown-body .hljs-operator,
.md-preview.markdown-body .hljs-punctuation {
  color: hsl(220 30% 75%);
}
.md-preview.markdown-body .hljs-meta {
  color: hsl(263 70% 60%);
}
.md-preview.markdown-body .hljs-params {
  color: hsl(25 90% 65%);
}

/* 浅色模式下，背景提亮 */
html:not(.dark) .md-preview.markdown-body pre {
  background: hsl(263 40% 96%);
}
html:not(.dark) .md-preview.markdown-body .hljs { color: hsl(263 40% 18%); }
html:not(.dark) .md-preview.markdown-body .hljs-comment { color: hsl(263 15% 45%); }
html:not(.dark) .md-preview.markdown-body .hljs-keyword { color: hsl(263 70% 45%); }
html:not(.dark) .md-preview.markdown-body .hljs-built_in,
html:not(.dark) .md-preview.markdown-body .hljs-number { color: hsl(190 95% 32%); }
html:not(.dark) .md-preview.markdown-body .hljs-string,
html:not(.dark) .md-preview.markdown-body .hljs-attr { color: hsl(330 78% 42%); }
html:not(.dark) .md-preview.markdown-body .hljs-function { color: hsl(145 70% 30%); }
html:not(.dark) .md-preview.markdown-body .hljs-title { color: hsl(263 75% 30%); }
html:not(.dark) .md-preview.markdown-body .hljs-meta { color: hsl(263 70% 50%); }

/* textarea 字号滚动条美化 */
.md-editor-root textarea::-webkit-scrollbar,
.md-preview::-webkit-scrollbar {
  width: 10px;
  height: 10px;
}
.md-editor-root textarea::-webkit-scrollbar-thumb,
.md-preview::-webkit-scrollbar-thumb {
  background: hsl(var(--brand) / 0.35);
  border-radius: 999px;
  border: 2px solid transparent;
  background-clip: padding-box;
}
.md-editor-root textarea::-webkit-scrollbar-thumb:hover,
.md-preview::-webkit-scrollbar-thumb:hover {
  background: hsl(var(--brand) / 0.6);
  background-clip: padding-box;
  border: 2px solid transparent;
}
</style>
