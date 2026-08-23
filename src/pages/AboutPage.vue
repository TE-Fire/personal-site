<script setup lang="ts">
/**
 * AboutPage · 关于我（完整填充）。
 * 结构：
 *   1) 页头：标题 + 简短自我介绍（可扩展头像）
 *   2) 4 个数字统计 chip
 *   3) 2 段长文介绍
 *   4) 「现在在做什么」Card
 *   5) 3 组技能 Badge（熟练 / 熟悉 / 协作工具）
 *   6) 兴趣标签 cloud
 */
import { Badge, Card, CardContent, CardHeader, CardTitle, CardDescription, Separator } from '@/components/ui'
import { aboutMe, skillGroups } from '@/data'
import { MapPin, Briefcase, Coffee, Heart } from 'lucide-vue-next'
</script>

<template>
  <article class="max-w-4xl mx-auto space-y-14">
    <!-- 1. 页头 -->
    <header class="space-y-5">
      <p class="m-0 text-xs font-mono text-brand uppercase tracking-wider">/ about</p>
      <div class="flex flex-col md:flex-row md:items-start md:gap-8 gap-6">
        <!-- 头像占位（T05 用占位 SVG 渐变圆形，后续可替换真实照片） -->
        <div class="shrink-0 size-24 md:size-28 rounded-full ring-4 ring-brand/15 bg-gradient-to-br from-brand via-accent to-chart-c2 text-white flex items-center justify-center shadow-card">
          <span class="font-sans font-bold text-3xl md:text-4xl tracking-tight">{{ aboutMe.name.charAt(0) }}</span>
        </div>
        <div class="space-y-4 min-w-0">
          <h1 class="m-0 text-3xl md:text-4xl font-bold tracking-tight leading-tight">
            Hi, I&apos;m <span class="text-brand">{{ aboutMe.name }}</span>
          </h1>
          <p class="m-0 text-base md:text-lg text-text-muted leading-relaxed">
            {{ aboutMe.shortBio }}
          </p>
          <div class="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-text-muted">
            <span class="inline-flex items-center gap-1.5"><MapPin class="size-4" />{{ aboutMe.location }}</span>
            <span class="inline-flex items-center gap-1.5">
              <Briefcase class="size-4" />
              <span v-if="aboutMe.available" class="text-success font-medium">可接项目</span>
              <span v-else class="text-text-muted">项目排期满</span>
            </span>
            <span class="inline-flex items-center gap-1.5"><Coffee class="size-4" />喜欢在 UTC+8 的下午干活</span>
            <span class="inline-flex items-center gap-1.5"><Heart class="size-4" />长期主义</span>
          </div>
        </div>
      </div>
    </header>

    <!-- 2. 数字统计 chip -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div
        v-for="s in aboutMe.highlightStats"
        :key="s.label"
        class="rounded-lg border border-border/60 bg-surface-muted/25 px-5 py-4 flex flex-col gap-1"
      >
        <div class="font-mono text-2xl md:text-3xl font-bold tracking-tight text-text">{{ s.value }}</div>
        <div class="text-xs text-text-muted">{{ s.label }}</div>
      </div>
    </div>

    <Separator />

    <!-- 3. 长文介绍（两段） -->
    <section class="space-y-4">
      <h2 class="m-0 text-xl font-semibold tracking-tight">关于我</h2>
      <div class="space-y-3 text-[15px] md:text-base text-text leading-[1.85]">
        <p v-for="(para, idx) in aboutMe.longBio" :key="idx" class="m-0">{{ para }}</p>
      </div>
    </section>

    <!-- 4. 现在在做什么 -->
    <Card>
      <CardHeader>
        <CardTitle class="flex items-center gap-2">现在 <span class="inline-block size-2 rounded-full bg-success animate-pulse" /></CardTitle>
        <CardDescription>2026 年下半年的核心方向（每半年更新一次）。</CardDescription>
      </CardHeader>
      <CardContent class="space-y-2 text-sm md:text-[15px] text-text-muted leading-relaxed list-none p-0">
        <p class="m-0">🪴 <strong class="text-text">产品</strong>：把「AI 辅助开发工作流」做成一个可复现的模板项目，并在 Gitee / GitHub 同步更新。</p>
        <p class="m-0">📝 <strong class="text-text">写作</strong>：保持 2~3 篇 / 月的节奏，主题集中在工程笔记、踩坑复盘、读书摘要三条线。</p>
        <p class="m-0">🔍 <strong class="text-text">寻找</strong>：有趣的独立项目 / 长期开源协作 / 设计系统类咨询。</p>
        <p class="m-0">🛠️ <strong class="text-text">技能打磨</strong>：正在啃 Three.js + WebGPU 的入门教程，目标 Q4 能出一个完整的 3D 小玩具。</p>
      </CardContent>
    </Card>

    <!-- 5. 技能栈（3 组） -->
    <section class="space-y-6">
      <h2 class="m-0 text-xl font-semibold tracking-tight">技能 &amp; 工具</h2>
      <div class="space-y-6">
        <div v-for="group in skillGroups" :key="group.id" class="space-y-3">
          <h3 class="m-0 text-[15px] font-medium text-text">{{ group.title }}</h3>
          <div class="flex flex-wrap gap-2">
            <Badge v-for="skill in group.items" :key="skill" :variant="group.variant" class="text-sm !px-3 !py-1">
              {{ skill }}
            </Badge>
          </div>
        </div>
      </div>
    </section>

    <!-- 6. 兴趣标签 -->
    <section class="space-y-3">
      <h2 class="m-0 text-xl font-semibold tracking-tight">最近感兴趣</h2>
      <div class="flex flex-wrap gap-2">
        <span
          v-for="topic in aboutMe.interests"
          :key="topic"
          class="inline-flex items-center rounded-full border border-brand/30 bg-brand/5 px-3 py-1 text-xs font-medium text-brand"
        >
          <Heart class="size-3 mr-1.5" />
          {{ topic }}
        </span>
      </div>
    </section>
  </article>
</template>
