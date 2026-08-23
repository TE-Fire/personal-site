/**
 * contact.ts · 联系方式 Mock 数据（Email/GitHub/Gitee/Telegram/微信/掘金等）。
 */
import { Mail, Github, MessageCircle, GripVertical, Coffee } from 'lucide-vue-next'
import type { Component } from 'vue'

export type ContactChannel = {
  id: string
  /** 对外展示名称 */
  label: string
  /** 次级文案（比如邮箱地址 / @ 用户名 / 二维码说明） */
  hint: string
  /** 跳转 href；若为 null 表示需要点击后展开二维码 / 复制号码 */
  href: string | null
  /** 是否需要点击后「复制到剪贴板」（替代 href 跳转） */
  copyValue?: string
  /** Lucide 图标组件 */
  icon: Component
  /** 展示顺序（从 1 开始递增） */
  order: number
}

export const contactChannels: ContactChannel[] = [
  {
    id: 'email',
    label: 'Email',
    hint: 'hello@trae.dev（推荐，工作日 24h 内回复）',
    href: 'mailto:hello@trae.dev',
    copyValue: 'hello@trae.dev',
    icon: Mail,
    order: 1
  },
  {
    id: 'github',
    label: 'GitHub',
    hint: '@TE-Fire · 看代码、提 Issue、PR 协作都欢迎',
    href: 'https://github.com/TE-Fire',
    icon: Github,
    order: 2
  },
  {
    id: 'gitee',
    label: 'Gitee',
    hint: '@TE-Fire · 国内镜像仓库 + 学习打卡项目主仓',
    href: 'https://gitee.com/TE-Fire',
    icon: GripVertical,
    order: 3
  },
  {
    id: 'telegram',
    label: 'Telegram',
    hint: '@trae_dev · 优先用于即时讨论',
    href: 'https://t.me/trae_dev',
    icon: MessageCircle,
    order: 4
  },
  {
    id: 'wechat',
    label: '微信',
    hint: '扫码添加 · T05 之后补二维码（附来意通过更快）',
    href: null,
    order: 5,
    icon: Coffee
  }
] as const

export type ContactFormField = 'name' | 'email' | 'message'

export type ContactFormErrors = Partial<Record<ContactFormField, string>>

/** 简单校验（T05 不接后端，仅做前端友好提示） */
export function validateContactForm(values: Record<ContactFormField, string>): ContactFormErrors {
  const errors: ContactFormErrors = {}
  if (!values.name.trim()) errors.name = '请填写你的称呼或姓名'
  if (!values.email.trim()) {
    errors.email = '请填写邮箱，我才能回复你～'
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) {
    errors.email = '邮箱格式看起来不太对，检查一下？'
  }
  if (!values.message.trim()) {
    errors.message = '说点什么吧，哪怕只是一个 Hi 👋'
  } else if (values.message.trim().length < 6) {
    errors.message = '消息太短啦，多写两句？（至少 6 个字符）'
  }
  return errors
}
