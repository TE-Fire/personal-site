/**
 * shims-modules.d.ts · 为第三方非 TS 包（Vanta / Three UMD 子路径）提供最小类型声明。
 * 注意：three 0.160+ 官方自带类型，但我们的动态 import 会让 vue-tsc 有时找不到；
 *       这里用 any 级别的宽松声明，只用于让组合式函数（useVantaBackground）内的
 *       「把 three 对象作为参数传给 Vanta 工厂」这种纯透传场景能过类型检查。
 */

declare module 'three' {
  const THREE: any
  export = THREE
  export as namespace THREE
}

declare module 'vanta/dist/vanta.net.min.js' {
  type VantaOptions = { el: HTMLElement; THREE?: any; [k: string]: any }
  type VantaEffect = {
    setOptions(opts: Record<string, unknown>): void
    destroy(): void
  }
  const NET: (opts: VantaOptions) => VantaEffect
  export default NET
}
