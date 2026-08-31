/**
 * useToast —— 全局轻提示（Snackbar）
 * ----------------------------------------------------------
 * 设计：Vue 3 reactive 单例，任意页面/composable 调用 useToast() 都拿到同一个实例。
 * 渲染层：<AppToaster /> 组件挂在 AppLayout.vue（页面正上方居中）。
 * 支持类型：success / info / warn / danger （对应 Toast CSS 4 种变体）
 * 默认显示 3000ms，danger 4200ms。支持手动 close。
 *
 * 用法：
 *   const toast = useToast();
 *   toast.success('保存成功', 'slug=xxx 已同步到服务器');
 *   toast.danger('删除失败', e.message, { duration: 8000 });
 *   const id = toast.info('正在上传...', '10MB 图片，预计 3 秒'); toast.remove(id);
 */
import { reactive, computed, type Component } from 'vue';
import {
  CheckCircle2, Info, AlertTriangle, XCircle, XIcon,
} from 'lucide-vue-next';

export type ToastVariant = 'success' | 'info' | 'warn' | 'danger';

export interface ToastShowOptions {
  duration?: number;   // 毫秒，0 = 不自动关闭
  title?: string;
  description?: string;
}

export interface ToastItem {
  id: number;
  variant: ToastVariant;
  title: string;
  description?: string;
  duration: number;
  leaving?: boolean;     // 退场动画中
  createdAt: number;
}

// 单例 reactive state（跨页面共享）
const state = reactive<{ toasts: ToastItem[] }>({ toasts: [] });
let _idSeq = 1;

const DEFAULT_DURATION: Record<ToastVariant, number> = {
  success: 3000,
  info:    3000,
  warn:    3600,
  danger:  4400,
};

export const TOAST_ICON: Record<ToastVariant, Component> = {
  success: CheckCircle2,
  info:    Info,
  warn:    AlertTriangle,
  danger:  XCircle,
};
export const TOAST_CLOSE_ICON = XIcon;

function _show(variant: ToastVariant, titleOrOpts: string | ToastShowOptions, description?: string, extra?: Partial<ToastShowOptions>): number {
  let title: string;
  let duration: number | undefined;
  if (typeof titleOrOpts === 'string') {
    title = titleOrOpts;
  } else {
    title       = titleOrOpts.title ?? '';
    description = titleOrOpts.description;
    duration    = titleOrOpts.duration;
  }
  const d = duration ?? extra?.duration ?? DEFAULT_DURATION[variant];
  const id = _idSeq++;
  const item: ToastItem = {
    id, variant, title, description,
    duration: d,
    createdAt: Date.now(),
  };
  state.toasts.push(item);

  if (d > 0) {
    setTimeout(() => remove(id), d);
  }
  return id;
}

export function remove(id: number): void {
  const idx = state.toasts.findIndex(t => t.id === id);
  if (idx < 0) return;
  const t = state.toasts[idx];
  if (t.leaving) return;
  t.leaving = true;
  // 配合 CSS 的 toast-out 动画 220ms，动画结束再真正从数组移除
  setTimeout(() => {
    const j = state.toasts.findIndex(x => x.id === id);
    if (j >= 0) state.toasts.splice(j, 1);
  }, 260);
}

export function clearAll(): void {
  [...state.toasts].forEach(t => remove(t.id));
}

export interface ToastApi {
  toasts: readonly ToastItem[];
  success(title: string, description?: string, opts?: Partial<ToastShowOptions>): number;
  info(title: string, description?: string, opts?: Partial<ToastShowOptions>): number;
  warn(title: string, description?: string, opts?: Partial<ToastShowOptions>): number;
  danger(title: string, description?: string, opts?: Partial<ToastShowOptions>): number;
  show(variant: ToastVariant, titleOrOpts: string | ToastShowOptions, description?: string, opts?: Partial<ToastShowOptions>): number;
  remove(id: number): void;
  clearAll(): void;
}

let _api: ToastApi | null = null;

export function useToast(): ToastApi {
  if (_api) return _api;
  const toastsRO = computed(() => state.toasts as readonly ToastItem[]);
  // Proxy to reactive array (readonly computed to avoid accidental mutation by callers,
  // but we still expose the original toasts to AppToaster for list rendering via getRaw)
  _api = {
    get toasts() { return toastsRO.value; },
    success: (t, d, o) => _show('success', t, d, o),
    info:    (t, d, o) => _show('info',    t, d, o),
    warn:    (t, d, o) => _show('warn',    t, d, o),
    danger:  (t, d, o) => _show('danger',  t, d, o),
    show:    (v, t, d, o) => _show(v, t, d, o),
    remove,
    clearAll,
  };
  return _api;
}

/** 仅 <AppToaster /> 使用：取 mutable 引用（便于 TransitionGroup 渲染） */
export function __getToastsRaw(): ToastItem[] { return state.toasts; }
