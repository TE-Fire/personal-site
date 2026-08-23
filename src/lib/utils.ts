import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * shadcn-vue 官方同款类名合并工具。
 * 功能：
 *   1) clsx 解析「字符串/数组/对象/条件」多种类名写法；
 *   2) tailwind-merge 消除同类冲突（比如同时传 "p-4 p-2" 以更后者为准，不会出现在最终 class 中重复）。
 * 组件中每一处需要合并 props.class 与默认类的地方都要走 cn()。
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
