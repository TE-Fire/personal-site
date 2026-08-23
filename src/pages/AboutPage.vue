<script setup lang="ts">
/**
 * AboutPage · 关于我（骨架）。T05 填充详细自我介绍、技能雷达、兴趣标签等。
 */
import { Badge, Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui'
</script>

<template>
  <article class="max-w-3xl mx-auto space-y-10">
    <header class="space-y-3">
      <p class="m-0 text-xs font-mono text-brand uppercase tracking-wider">/ about</p>
      <h1 class="m-0 text-3xl md:text-4xl font-bold tracking-tight">关于我</h1>
      <p class="m-0 text-base md:text-lg text-text-muted leading-relaxed">
        一份简短的自我介绍：我从哪里来，关心什么，正在做什么，以及如何与我协作。（T05 补全内容）
      </p>
    </header>

    <Card>
      <CardHeader>
        <CardTitle>现在</CardTitle>
        <CardDescription>目前正在做的事 · 状态 · 协作方式</CardDescription>
      </CardHeader>
      <CardContent class="space-y-2 text-sm text-text-muted leading-relaxed">
        <p>🪴 正在构建：个人作品集 + AI 辅助开发工作流 demo</p>
        <p>🗺️ 坐标：UTC+8 · 远程协作友好</p>
        <p>🔍 寻找：有趣的独立项目 / 开源协作 / 产品设计咨询</p>
      </CardContent>
    </Card>

    <section class="space-y-3">
      <h2 class="m-0 text-xl font-semibold tracking-tight">技能栈（主）</h2>
      <div class="flex flex-wrap gap-2">
        <Badge>Vue 3</Badge>
        <Badge variant="secondary">TypeScript</Badge>
        <Badge variant="secondary">Tailwind CSS</Badge>
        <Badge variant="outline">Vite</Badge>
        <Badge variant="outline">GSAP</Badge>
        <Badge variant="secondary">Node.js</Badge>
        <Badge>shadcn-vue</Badge>
      </div>
    </section>
  </article>
</template>
