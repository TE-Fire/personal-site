/**
 * life.ts · 生活碎片 Mock 数据（照片 / 音乐 / 随笔 三类）。
 * 照片使用渐变色块占位，后续可替换为真实图片 URL 或 OSS 链接。
 */

/** 碎片类型 */
export type MomentType = 'photo' | 'music' | 'essay'

/** 心情标签 */
export type Mood = '治愈' | '灵感' | '深夜' | '日常' | '旅行' | '美食' | '释然' | '兴奋'

/** 照片碎片 */
export type PhotoMoment = {
  id: string
  type: 'photo'
  date: string          // YYYY.MM.DD
  title: string
  /** 渐变色块占位（from / to 为 hex 色值），后续可替换为 imageUrl */
  gradient: { from: string; to: string }
  mood: Mood
  /** 照片在瀑布流中的跨列数（1=正常, 2=宽卡） */
  span?: 1 | 2
  /** 照片在瀑布流中的行高（用于不规则排布） */
  height: 'sm' | 'md' | 'lg' | 'xl'
}

/** 音乐碎片 */
export type MusicMoment = {
  id: string
  type: 'music'
  date: string
  title: string
  artist: string
  /** 循环次数 */
  playCount: number
  /** 外链（网易云/QQ音乐等） */
  link?: string
  /** 封面色 */
  coverColor: string
  mood: Mood
  /** 一句话点评 */
  comment?: string
}

/** 随笔碎片 */
export type EssayMoment = {
  id: string
  type: 'essay'
  date: string
  content: string
  mood: Mood
  /** 随笔配图的渐变色（可选） */
  gradient?: { from: string; to: string }
}

/** 统一碎片类型 */
export type LifeMoment = PhotoMoment | MusicMoment | EssayMoment

// ─── 照片数据 ──────────────────────────────────────
export const photoMoments: PhotoMoment[] = [
  {
    id: 'p-001',
    type: 'photo',
    date: '2026.08.20',
    title: '城市黄昏',
    gradient: { from: '#7c3aed', to: '#f59e0b' },
    mood: '灵感',
    span: 2,
    height: 'lg'
  },
  {
    id: 'p-002',
    type: 'photo',
    date: '2026.08.18',
    title: '咖啡店角落',
    gradient: { from: '#92400e', to: '#fbbf24' },
    mood: '日常',
    height: 'md'
  },
  {
    id: 'p-003',
    type: 'photo',
    date: '2026.08.15',
    title: '周末徒步',
    gradient: { from: '#059669', to: '#34d399' },
    mood: '旅行',
    height: 'sm'
  },
  {
    id: 'p-004',
    type: 'photo',
    date: '2026.08.12',
    title: '深夜书桌',
    gradient: { from: '#1e1b4b', to: '#6366f1' },
    mood: '深夜',
    span: 2,
    height: 'xl'
  },
  {
    id: 'p-005',
    type: 'photo',
    date: '2026.08.08',
    title: '巷口的猫',
    gradient: { from: '#831843', to: '#f472b6' },
    mood: '治愈',
    height: 'md'
  },
  {
    id: 'p-006',
    type: 'photo',
    date: '2026.08.03',
    title: '海边日落',
    gradient: { from: '#0c4a6e', to: '#38bdf8' },
    mood: '释然',
    height: 'lg'
  },
  {
    id: 'p-007',
    type: 'photo',
    date: '2026.07.28',
    title: '早餐合集',
    gradient: { from: '#fde68a', to: '#f97316' },
    mood: '美食',
    height: 'sm'
  },
  {
    id: 'p-008',
    type: 'photo',
    date: '2026.07.22',
    title: '雨后玻璃',
    gradient: { from: '#64748b', to: '#0ea5e9' },
    mood: '日常',
    height: 'md'
  }
]

// ─── 音乐数据 ──────────────────────────────────────
export const musicMoments: MusicMoment[] = [
  {
    id: 'm-001',
    type: 'music',
    date: '2026.08.21',
    title: '晴天',
    artist: '周杰伦',
    playCount: 12,
    link: 'https://music.163.com/song?id=186016',
    coverColor: '#7c3aed',
    mood: '治愈',
    comment: '前奏一响，就回到了那个夏天'
  },
  {
    id: 'm-002',
    type: 'music',
    date: '2026.08.19',
    title: '夜空中最亮的星',
    artist: '逃跑计划',
    playCount: 8,
    link: 'https://music.163.com/song?id=254574',
    coverColor: '#06b6d4',
    mood: '深夜',
    comment: '凌晨写代码的 BGM，循环到天亮'
  },
  {
    id: 'm-003',
    type: 'music',
    date: '2026.08.16',
    title: 'Hotel California',
    artist: 'Eagles',
    playCount: 5,
    link: 'https://music.163.com/song?id=259867',
    coverColor: '#ec4899',
    mood: '灵感',
    comment: '吉他 Solo 每次听都起鸡皮疙瘩'
  },
  {
    id: 'm-004',
    type: 'music',
    date: '2026.08.10',
    title: 'Merry Christmas Mr. Lawrence',
    artist: '坂本龍一',
    playCount: 6,
    link: 'https://music.163.com/song?id=257733',
    coverColor: '#f59e0b',
    mood: '释然',
    comment: '大师走后，曲子反而更亮了'
  },
  {
    id: 'm-005',
    type: 'music',
    date: '2026.08.05',
    title: 'Valder Fields',
    artist: 'Tamas Wells',
    playCount: 4,
    link: 'https://music.163.com/song?id=202568',
    coverColor: '#10b981',
    mood: '日常',
    comment: '适合发呆时单曲循环'
  }
]

// ─── 随笔数据 ──────────────────────────────────────
export const essayMoments: EssayMoment[] = [
  {
    id: 'e-001',
    type: 'essay',
    date: '2026.08.20',
    content: '今天的晚霞是紫色的，像极了我配不出的那个渐变色值。#f0 #9d',
    mood: '灵感',
    gradient: { from: '#7c3aed', to: '#f59e0b' }
  },
  {
    id: 'e-002',
    type: 'essay',
    date: '2026.08.18',
    content: '凌晨三点写完了最后一个 bug，窗外第一缕光打在屏幕上，像极了 deploy 成功的绿色。',
    mood: '深夜'
  },
  {
    id: 'e-003',
    type: 'essay',
    date: '2026.08.15',
    content: '老巷口的猫又来了，它蹲在窗台上看我敲代码的样子，像在做 code review。',
    mood: '治愈',
    gradient: { from: '#831843', to: '#f472b6' }
  },
  {
    id: 'e-004',
    type: 'essay',
    date: '2026.08.10',
    content: '海风很咸，浪声很白。坐在礁石上放空了两个小时，脑子里一个 var 都没有。',
    mood: '释然',
    gradient: { from: '#0c4a6e', to: '#38bdf8' }
  },
  {
    id: 'e-005',
    type: 'essay',
    date: '2026.08.06',
    content: '新买了一盆绿萝，放在显示器旁边。写代码写到卡壳时就看看它，它也不急，绿油油的。',
    mood: '日常'
  },
  {
    id: 'e-006',
    type: 'essay',
    date: '2026.07.30',
    content: '今天煮了一碗面，放了两个荷包蛋。幸福有时候就是多加一个蛋这么简单。',
    mood: '美食',
    gradient: { from: '#fde68a', to: '#f97316' }
  }
]

// ─── 聚合导出 ──────────────────────────────────────
export const allMoments: LifeMoment[] = [
  ...photoMoments,
  ...musicMoments,
  ...essayMoments
]

/** 获取按日期降序排列的全部碎片 */
export function getMomentsSorted(): LifeMoment[] {
  return [...allMoments].sort((a, b) => b.date.localeCompare(a.date))
}

/** 获取所有出现过的月份（格式 YYYY.MM），降序 */
export function getMonths(): string[] {
  const months = new Set<string>()
  allMoments.forEach((m) => {
    months.add(m.date.slice(0, 7)) // YYYY.MM
  })
  return [...months].sort((a, b) => b.localeCompare(a))
}

/** 心情 emoji 映射 */
export const moodEmoji: Record<Mood, string> = {
  '治愈': '🌿',
  '灵感': '✨',
  '深夜': '🌙',
  '日常': '☕',
  '旅行': '🧳',
  '美食': '🍜',
  '释然': '🍃',
  '兴奋': '🎆'
}
