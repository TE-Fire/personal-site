<script setup lang="ts">
/**
 * ContactPage · 联系方式（骨架）。T05 补完整联系表单（姓名/邮箱/内容 + 前端校验）
 */
import { Button, Card, CardContent, CardHeader, CardTitle, CardDescription, Input, Label } from '@/components/ui'
import { Mail, MessageSquare, Github } from 'lucide-vue-next'
</script>

<template>
  <article class="grid grid-cols-1 lg:grid-cols-[0.9fr_1.1fr] gap-8 max-w-5xl mx-auto">
    <!-- 左侧：联系方式信息卡 -->
    <section class="space-y-4">
      <header class="space-y-3">
        <p class="m-0 text-xs font-mono text-brand uppercase tracking-wider">/ contact</p>
        <h1 class="m-0 text-3xl md:text-4xl font-bold tracking-tight">联系我</h1>
        <p class="m-0 text-base md:text-lg text-text-muted leading-relaxed">
          任何合作、约稿、技术咨询、或者单纯想聊聊天，都欢迎通过以下方式找到我。（T05 接邮件发送 / 第三方表单）
        </p>
      </header>

      <Card>
        <CardContent class="p-5 space-y-3 text-sm">
          <a href="mailto:hello@example.com" class="flex items-center gap-3 no-underline text-text hover:text-brand transition">
            <span class="inline-flex size-9 items-center justify-center rounded-full bg-surface-muted/60 text-text-muted">
              <Mail class="size-4.5" />
            </span>
            <div class="flex flex-col">
              <span class="font-medium">Email</span>
              <span class="text-xs text-text-muted">hello@example.com</span>
            </div>
          </a>
          <a href="https://github.com/TE-Fire" target="_blank" rel="noopener noreferrer" class="flex items-center gap-3 no-underline text-text hover:text-brand transition">
            <span class="inline-flex size-9 items-center justify-center rounded-full bg-surface-muted/60 text-text-muted">
              <Github class="size-4.5" />
            </span>
            <div class="flex flex-col">
              <span class="font-medium">GitHub</span>
              <span class="text-xs text-text-muted">@TE-Fire</span>
            </div>
          </a>
          <a href="#" class="flex items-center gap-3 no-underline text-text hover:text-brand transition">
            <span class="inline-flex size-9 items-center justify-center rounded-full bg-surface-muted/60 text-text-muted">
              <MessageSquare class="size-4.5" />
            </span>
            <div class="flex flex-col">
              <span class="font-medium">即时通讯</span>
              <span class="text-xs text-text-muted">T05 放 WeChat / Telegram 二维码</span>
            </div>
          </a>
        </CardContent>
      </Card>
    </section>

    <!-- 右侧：表单占位（T05 补校验 + 提交） -->
    <Card>
      <CardHeader>
        <CardTitle>给我留个言</CardTitle>
        <CardDescription>
          我一般在 1~2 个工作日内回复。
        </CardDescription>
      </CardHeader>
      <CardContent class="p-6 pt-0 space-y-4">
        <div class="space-y-1.5">
          <Label htmlFor="cf-name">姓名</Label>
          <Input id="cf-name" placeholder="怎么称呼你？" />
        </div>
        <div class="space-y-1.5">
          <Label htmlFor="cf-email">邮箱</Label>
          <Input id="cf-email" type="email" placeholder="name@example.com" />
        </div>
        <div class="space-y-1.5">
          <Label htmlFor="cf-msg">想聊什么？</Label>
          <textarea
            id="cf-msg"
            rows="5"
            placeholder="简单描述一下你的需求或问题..."
            class="flex w-full rounded-md border border-border bg-surface-elevated px-3 py-2 text-sm shadow-sm placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-surface transition-colors"
          />
        </div>
        <div class="pt-1 flex justify-end">
          <Button type="button" size="lg">发送消息</Button>
        </div>
      </CardContent>
    </Card>
  </article>
</template>
