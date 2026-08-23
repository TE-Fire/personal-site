import type { Config } from 'tailwindcss'

export default {
  darkMode: 'class',
  content: [
    './index.html',
    './src/**/*.{vue,js,ts,jsx,tsx}'
  ],
  theme: {
    extend: {
      // T02 会在这里扩展完整的设计系统 token（颜色、字体、间距、圆角）
      // T01 先留空，保证 Tailwind 能解析默认类即可
      fontFamily: {
        sans: [
          '"SF Pro Text"',
          '"PingFang SC"',
          'system-ui',
          '-apple-system',
          '"Segoe UI"',
          'Roboto',
          'sans-serif'
        ],
        mono: [
          '"JetBrains Mono"',
          'ui-monospace',
          '"SF Mono"',
          'Menlo',
          'Consolas',
          'monospace'
        ]
      }
    }
  },
  plugins: []
} satisfies Config
