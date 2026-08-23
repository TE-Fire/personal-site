import type { Config } from 'tailwindcss'

/**
 * Tailwind 主题配置 · 与 src/styles/tokens.css + typography.css 中的 CSS 变量一一对应。
 * 颜色直接引用 CSS 变量（不做运行时透明度拆分；如需半透明改用 tokens 中预定义的 *-soft / *-100 等档位，
 * 或用 Tailwind 任意值语法 bg-[var(--brand)/70%]，后者需要浏览器支持 CSS Color Module 5）。
 */
export default {
  darkMode: 'class',
  content: [
    './index.html',
    './src/**/*.{vue,js,ts,jsx,tsx}'
  ],
  theme: {
    screens: {
      // 保持 Tailwind 默认断点：sm/md/lg/xl/2xl（与 PROJECT_PLAN §3.4 一致）
      sm: '640px',
      md: '768px',
      lg: '1024px',
      xl: '1280px',
      '2xl': '1536px'
    },
    extend: {
      // ---------- 颜色：对应 tokens.css 档位 ----------
      colors: {
        surface: {
          DEFAULT: 'var(--surface)',
          muted: 'var(--surface-muted)',
          elevated: 'var(--surface-elevated)',
          overlay: 'var(--surface-overlay)'
        },
        text: {
          DEFAULT: 'var(--text)',
          muted: 'var(--text-muted)',
          subtle: 'var(--text-subtle)',
          'on-brand': 'var(--text-on-brand)'
        },
        border: {
          DEFAULT: 'var(--border)',
          strong: 'var(--border-strong)'
        },
        ring: {
          DEFAULT: 'var(--ring)'
        },

        // 紫色品牌色（8 档，核心色 = brand = 600）
        brand: {
          50: 'var(--brand-50)',
          100: 'var(--brand-100)',
          200: 'var(--brand-200)',
          300: 'var(--brand-300)',
          400: 'var(--brand-400)',
          500: 'var(--brand-500)',
          DEFAULT: 'var(--brand)',
          700: 'var(--brand-700)',
          800: 'var(--brand-800)',
          900: 'var(--brand-900)',
          // 快速语义别名
          soft: 'var(--brand-soft)',
          'soft-strong': 'var(--brand-soft-strong)',
          text: 'var(--brand-text)',
          on: 'var(--brand-on)'
        },

        // 次强调色（青绿）
        accent: {
          DEFAULT: 'var(--accent)',
          soft: 'var(--accent-soft)',
          text: 'var(--accent-text)'
        },

        // 语义色
        success: 'var(--success)',
        warning: 'var(--warning)',
        danger: 'var(--danger)',

        // 图表序列
        chart: {
          s1: 'var(--chart-series-1)',
          s2: 'var(--chart-series-2)',
          s3: 'var(--chart-series-3)',
          s4: 'var(--chart-series-4)',
          other: 'var(--chart-other)'
        }
      },

      // ---------- 字体：对应 typography.css ----------
      fontFamily: {
        sans: ['var(--font-sans)', { fontFeatureSettings: '"cv02", "cv03", "cv04", "cv11"' }],
        metric: ['var(--font-metric)'],
        mono: ['var(--font-mono)']
      },

      // ---------- 字号：严格对齐排版系统（不提供 18/20/24 等 ad-hoc 字号） ----------
      fontSize: {
        caption: ['var(--text-caption)', { lineHeight: 'var(--text-caption-leading)' }],
        sm: ['0.8125rem', { lineHeight: '1.25rem' }], // 13px 辅助
        base: ['var(--text-body)', { lineHeight: 'var(--text-body-leading)' }],
        code: ['var(--text-code)', { lineHeight: 'var(--text-code-leading)' }],
        lg: ['0.9375rem', { lineHeight: '1.5rem' }], // 15px，仅限少量强调场景
        title: ['var(--text-title)', { lineHeight: 'var(--text-title-leading)' }]
      },

      // ---------- 间距：4/8/12/16/20/24/32/40/48/64（其余按需用任意值 p-[10]） ----------
      spacing: {
        4: '4px',
        8: '8px',
        12: '12px',
        16: '16px',
        20: '20px',
        24: '24px',
        32: '32px',
        40: '40px',
        48: '48px',
        56: '56px',
        64: '64px',
        72: '72px',
        80: '80px',
        96: '96px',
        128: '128px'
      },

      // ---------- 圆角：三档制（与 PROJECT_PLAN §3.3 对齐） ----------
      borderRadius: {
        DEFAULT: '8px',   // --radius，组件
        sm: '6px',
        md: '8px',
        lg: '12px',       // --radius-card，卡片/面板
        xl: '16px',
        full: '999px'     // 胶囊/圆形
      },

      // ---------- 投影：3 档（克制使用，详见 tokens.css） ----------
      boxShadow: {
        sm: 'var(--shadow-sm)',
        DEFAULT: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
        ring: 'var(--shadow-ring)',
        // 覆盖 Tailwind 默认的大投影，避免随手用 shadow-xl 破坏视觉克制
        xl: 'var(--shadow-lg)',
        '2xl': 'var(--shadow-lg)',
        none: 'none'
      },

      // ---------- 内容最大宽度（大屏阅读区不过宽） ----------
      maxWidth: {
        prose: '65ch',
        content: '72rem',   // 1152px
        'content-narrow': '56rem'
      },

      // ---------- 动效 ----------
      transitionTimingFunction: {
        'out-quad': 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
        'out-cubic': 'cubic-bezier(0.33, 1, 0.68, 1)',
        'brand': 'cubic-bezier(0.4, 0, 0.2, 1)'
      },
      transitionDuration: {
        120: '120ms',
        180: '180ms',
        240: '240ms',
        360: '360ms'
      }
    }
  },
  plugins: []
} satisfies Config
