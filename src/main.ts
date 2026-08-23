// 字体（通过 @fontsource 本地引入，避免 FOIT / 跨域）
// 中文仍由系统字体承担（PingFang / Microsoft YaHei），西文 Inter 与 JetBrains Mono 本地加载
import '@fontsource-variable/inter/wght.css'           /* 可变字重 100-900 */
import '@fontsource/jetbrains-mono/400.css'
import '@fontsource/jetbrains-mono/500.css'
import '@fontsource/jetbrains-mono/700.css'

import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import './styles/index.css'

const app = createApp(App)
app.use(router)
app.mount('#app')
