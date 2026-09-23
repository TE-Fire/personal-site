/**
 * contact.ts · 联系方式数据（Email/GitHub/微信）。
 * 每个渠道点击后展开详细面板，展示具体联系信息。
 */
import { Mail, Github, Coffee } from 'lucide-vue-next'
import type { Component } from 'vue'

export type ContactChannelDetail = {
  /** 展开后显示的主要内容（邮箱地址 / GitHub 链接 / 微信号等） */
  value: string
  /** 内容的描述说明 */
  description: string
  /** 可复制的值（若提供，展示"复制"按钮） */
  copyValue?: string
  /** 可跳转的链接（若提供，展示"访问"按钮） */
  linkUrl?: string
  /** 链接按钮文字 */
  linkText?: string
  /** 二维码图片路径（微信用，后续可上传） */
  qrCode?: string | null
}

export type ContactChannel = {
  id: string
  /** 对外展示名称 */
  label: string
  /** 次级文案 */
  hint: string
  /** Lucide 图标组件 */
  icon: Component
  /** 展示顺序 */
  order: number
  /** 展开后显示的详细信息 */
  detail: ContactChannelDetail
}

export const contactChannels: ContactChannel[] = [
  {
    id: 'email',
    label: 'Email',
    hint: '工作日 24h 内回复，推荐用于合作 / 咨询',
    icon: Mail,
    order: 1,
    detail: {
      value: 'hello@trae.dev',
      description: '发邮件给我，工作日通常 24 小时内回复。适合合作洽谈、技术咨询等需要归档的场景。',
      copyValue: 'hello@trae.dev',
      linkUrl: 'mailto:hello@trae.dev',
      linkText: '发送邮件',
    },
  },
  {
    id: 'github',
    label: 'GitHub',
    hint: '看代码、提 Issue、PR 协作都欢迎',
    icon: Github,
    order: 2,
    detail: {
      value: 'github.com/TE-Fire',
      description: '我的开源项目和个人代码仓库都在这里，欢迎 Star、提 Issue 或直接 PR。',
      linkUrl: 'https://github.com/TE-Fire',
      linkText: '访问主页',
    },
  },
  {
    id: 'wechat',
    label: '微信',
    hint: '扫码添加，注明来意通过更快',
    icon: Coffee,
    order: 3,
    detail: {
      value: 'TE-Fire',
      description: '扫码或搜索微信号添加好友。请务必备注来意（如"合作咨询"、"技术交流"），会更快通过。',
      copyValue: 'TE-Fire',
      qrCode: null,
    },
  },
] as const
