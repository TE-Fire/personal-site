<script setup lang="ts">
/**
 * TagNetwork3D.vue · 标签 3D 网状星链展示（v4 · 稳定版）
 *
 * 核心修复：
 *   - CSS2D 标签不再手动覆盖 transform，由 CSS2DRenderer 负责定位
 *   - ResizeObserver 确保容器尺寸就绪后再初始化
 *   - 多样化节点形状根据 count 分级选择
 *   - 标签可见性通过 opacity 控制（深度/hover）
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useTheme } from '@/composables/useTheme'
import OrbitLoader from '@/components/OrbitLoader.vue'

type TagInfo = { name: string; count: number }

const props = defineProps<{
  tags: TagInfo[]
  posts: { tags: string[] }[]
}>()

const emit = defineEmits<{
  (e: 'select-tag', name: string): void
}>()

const rootRef = ref<HTMLElement | null>(null)
const isReady = ref(false)
const hasWebGL = ref(true)
const hoveredTag = ref<string | null>(null)

const { resolved } = useTheme()

const C = {
  brand: { light: 0x4b3fe3, dark: 0x8b8fff },
  accent: { light: 0xec4899, dark: 0xec4899 },
  node: { light: 0x5b4ee6, dark: 0x9b9fff },
  nodeHot: { light: 0xec4899, dark: 0xff6bb5 },
  glow: { light: 0x8b8fff, dark: 0xc4b5ff },
  line: { light: 0x7b6fff, dark: 0x8b8fff },
  lineBright: { light: 0xec4899, dark: 0xff8fcf },
  bg: { light: 0xf7f7fb, dark: 0x0b0716 },
  star: { light: 0xc7ccff, dark: 0x4b3fe3 }
}

function tc(key: keyof typeof C) {
  return C[key][resolved.value === 'dark' ? 'dark' : 'light']
}

const connections = computed(() => {
  const map = new Map<string, number>()
  for (const post of props.posts) {
    const tags = post.tags
    for (let i = 0; i < tags.length; i++) {
      for (let j = i + 1; j < tags.length; j++) {
        const a = tags[i] < tags[j] ? tags[i] : tags[j]
        const b = tags[i] < tags[j] ? tags[j] : tags[i]
        const key = `${a}__${b}`
        map.set(key, (map.get(key) || 0) + 1)
      }
    }
  }
  return Array.from(map.entries()).map(([key, strength]) => {
    const [a, b] = key.split('__')
    return { a, b, strength }
  })
})

/* ---------- Three.js 引用 ---------- */
let THREE: any = null
let CSS2DRendererModule: any = null
let scene: any = null
let camera: any = null
let renderer: any = null
let labelRenderer: any = null
let raycaster: any = null
let pointer: any = null
let nodeGroups: any[] = []
let lineMesh: any = null
let lineMat: any = null
let labelObjects: any[] = []
let starField: any = null
let animationId = 0
let containerEl: HTMLElement | null = null
let resizeObserver: ResizeObserver | null = null
let initRetryCount = 0

let rotVelX = 0
let rotVelY = 0
const DAMPING = 0.94
const AUTO_SPEED = 0.003
const DRAG_SENSITIVITY = 0.0045
let isDragging = false
let lastMouseX = 0
let lastMouseY = 0
let dragMoved = false
let clickStartX = 0
let clickStartY = 0

/* ---------- 降级检测 ---------- */
function shouldUseFallback(): boolean {
  try {
    if (typeof window === 'undefined') return true
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return true
    const nav = navigator as Navigator & { deviceMemory?: number; hardwareConcurrency?: number }
    if (typeof nav.hardwareConcurrency === 'number' && nav.hardwareConcurrency <= 2) return true
    if (typeof nav.deviceMemory === 'number' && nav.deviceMemory <= 2) return true
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('webgl2') ?? canvas.getContext('webgl')
    if (!ctx) return true
    return false
  } catch {
    return true
  }
}

/* ---------- 形状选择：根据 count 选几何体（分级） ---------- */
function pickGeometry(THREE: any, count: number, size: number) {
  if (count >= 5) return new THREE.IcosahedronGeometry(size, 1)
  if (count >= 3) return new THREE.OctahedronGeometry(size, 0)
  if (count >= 2) return new THREE.DodecahedronGeometry(size, 0)
  return new THREE.SphereGeometry(size, 16, 16)
}

/* ---------- Fibonacci 球面分布 ---------- */
function fibonacciSphere(count: number, radius: number) {
  const points: { x: number; y: number; z: number }[] = []
  if (count <= 1) return [{ x: 0, y: 0, z: 0 }]
  const golden = Math.PI * (3 - Math.sqrt(5))
  for (let i = 0; i < count; i++) {
    const y = 1 - (i / (count - 1)) * 2
    const r = Math.sqrt(1 - y * y)
    const theta = golden * i
    points.push({
      x: Math.cos(theta) * r * radius,
      y: y * radius,
      z: Math.sin(theta) * r * radius
    })
  }
  return points
}

/* ---------- 创建节点（多层发光 + 多样化形状） ---------- */
function createNodeMesh(tag: TagInfo, position: { x: number; y: number; z: number }) {
  const group = new THREE.Group()
  const isHot = tag.count >= 3
  const color = isHot ? tc('nodeHot') : tc('node')
  const glowColor = tc('glow')
  const size = 0.28 + Math.min(tag.count, 6) * 0.06

  // 核心 — 多样化形状
  const coreGeo = pickGeometry(THREE, tag.count, size)
  const coreMat = new THREE.MeshPhongMaterial({
    color,
    emissive: color,
    emissiveIntensity: 0.5,
    shininess: 120,
    specular: 0xffffff,
    flatShading: tag.count < 3
  })
  const core = new THREE.Mesh(coreGeo, coreMat)
  core.userData = { tag: tag.name, count: tag.count, isNode: true }
  group.add(core)

  // 中层光环（球壳）
  const ringGeo = new THREE.SphereGeometry(size * 1.8, 16, 16)
  const ringMat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.12,
    side: THREE.BackSide,
    depthWrite: false
  })
  const ring = new THREE.Mesh(ringGeo, ringMat)
  group.add(ring)

  // 外层光晕
  const glowGeo = new THREE.SphereGeometry(size * 3.5, 16, 16)
  const glowMat = new THREE.MeshBasicMaterial({
    color: glowColor,
    transparent: true,
    opacity: 0.05,
    side: THREE.BackSide,
    depthWrite: false
  })
  const glow = new THREE.Mesh(glowGeo, glowMat)
  group.add(glow)

  group.position.set(position.x, position.y, position.z)
  group.userData = { tag: tag.name, count: tag.count, baseScale: 1 }
  return group
}

/* ---------- 创建 CSS2D 标签（简化版） ---------- */
function createCSS2DLabel(tag: TagInfo) {
  const el = document.createElement('div')
  el.className = 'three-tag-label'
  const isDark = resolved.value === 'dark'
  const brandHex = '#' + tc('brand').toString(16).padStart(6, '0')
  el.innerHTML = `
    <div class="tag-label-inner">
      <span class="tag-dot" style="background:${brandHex}"></span>
      <span class="tag-name">#${tag.name}</span>
      <span class="tag-count" style="background:${brandHex}">${tag.count}</span>
    </div>
  `
  if (isDark) el.classList.add('is-dark')
  else el.classList.add('is-light')

  const CSS2DObject = CSS2DRendererModule?.CSS2DObject
  if (!CSS2DObject) return null
  const css2d = new CSS2DObject(el)
  css2d.userData = { tag: tag.name, count: tag.count }
  return css2d
}

/* ---------- 创建连线 ---------- */
function createLineMesh(tagPositions: Map<string, { x: number; y: number; z: number }>) {
  const conns = connections.value
  if (!conns.length) return null

  const positions: number[] = []
  const colors: number[] = []
  const baseCol = new THREE.Color(tc('line'))
  const brightCol = new THREE.Color(tc('lineBright'))

  for (const conn of conns) {
    const a = tagPositions.get(conn.a)
    const b = tagPositions.get(conn.b)
    if (!a || !b) continue

    positions.push(a.x, a.y, a.z, b.x, b.y, b.z)
    const t = Math.min(conn.strength / 5, 1)
    const c = baseCol.clone().lerp(brightCol, t * 0.6)
    const alpha = 0.25 + t * 0.35
    colors.push(c.r * alpha, c.g * alpha, c.b * alpha)
    colors.push(c.r * alpha, c.g * alpha, c.b * alpha)
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))

  lineMat = new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.85,
    depthWrite: false
  })

  return new THREE.LineSegments(geo, lineMat)
}

/* ---------- 创建背景星尘 ---------- */
function createStarField(count: number, radius: number) {
  const positions = new Float32Array(count * 3)
  const isDark = resolved.value === 'dark'
  const color = new THREE.Color(tc('star'))
  const colors = new Float32Array(count * 3)

  for (let i = 0; i < count; i++) {
    const theta = Math.random() * Math.PI * 2
    const phi = Math.acos(2 * Math.random() - 1)
    const r = radius * (1.3 + Math.random() * 0.7)
    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta)
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta)
    positions[i * 3 + 2] = r * Math.cos(phi)

    const fade = isDark ? 0.3 + Math.random() * 0.5 : 0.15 + Math.random() * 0.3
    colors[i * 3] = color.r * fade
    colors[i * 3 + 1] = color.g * fade
    colors[i * 3 + 2] = color.b * fade
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))

  const mat = new THREE.PointsMaterial({
    size: 0.08,
    vertexColors: true,
    transparent: true,
    opacity: 0.8,
    depthWrite: false
  })

  return new THREE.Points(geo, mat)
}

/* ---------- 构建场景 ---------- */
function buildScene() {
  if (!THREE || !containerEl) return

  const w = containerEl.clientWidth
  const h = containerEl.clientHeight
  if (w === 0 || h === 0) {
    // 容器还没尺寸，稍后再试
    if (initRetryCount < 5) {
      initRetryCount++
      requestAnimationFrame(buildScene)
    }
    return
  }

  cleanup()
  initRetryCount = 0

  scene = new THREE.Scene()
  scene.background = new THREE.Color(tc('bg'))

  camera = new THREE.PerspectiveCamera(55, w / h, 0.1, 200)
  camera.position.set(0, 0, 40)
  camera.lookAt(0, 0, 0)

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.setSize(w, h)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setClearColor(tc('bg'), 1)
  containerEl.appendChild(renderer.domElement)

  // CSS2D Renderer
  const CSS2DRenderer = CSS2DRendererModule?.CSS2DRenderer
  if (!CSS2DRenderer) {
    console.warn('[TagNetwork3D] CSS2DRenderer module not available')
    return
  }
  labelRenderer = new CSS2DRenderer()
  labelRenderer.setSize(w, h)
  const labelDom = labelRenderer.domElement
  labelDom.style.position = 'absolute'
  labelDom.style.top = '0'
  labelDom.style.left = '0'
  labelDom.style.pointerEvents = 'none'
  containerEl.appendChild(labelDom)

  // 灯光
  const ambient = new THREE.AmbientLight(0xffffff, 0.8)
  scene.add(ambient)
  const keyLight = new THREE.DirectionalLight(0xffffff, 1.0)
  keyLight.position.set(8, 12, 6)
  scene.add(keyLight)
  const rimLight = new THREE.DirectionalLight(tc('brand'), 0.4)
  rimLight.position.set(-8, -4, -6)
  scene.add(rimLight)

  raycaster = new THREE.Raycaster()
  pointer = new THREE.Vector2(-10, -10)

  starField = createStarField(400, 30)
  scene.add(starField)

  rebuildNodes()
  animate()

  window.addEventListener('resize', onResize)
  containerEl.addEventListener('mousedown', onMouseDown)
  window.addEventListener('mousemove', onMouseMove)
  window.addEventListener('mouseup', onMouseUp)
  containerEl.addEventListener('mouseleave', onMouseLeave)
  containerEl.addEventListener('click', onClick)
  containerEl.addEventListener('touchstart', onTouchStart, { passive: true })
  containerEl.addEventListener('touchmove', onTouchMove, { passive: true })
  containerEl.addEventListener('touchend', onTouchEnd)

  isReady.value = true
}

/* ---------- 重建节点 ---------- */
function rebuildNodes() {
  if (!scene || !THREE) return

  // 清理旧节点
  for (const n of nodeGroups) {
    scene.remove(n)
    n.traverse((child: any) => {
      if (child.geometry) child.geometry.dispose()
      if (child.material) {
        if (Array.isArray(child.material)) child.material.forEach((m: any) => m.dispose())
        else child.material.dispose()
      }
    })
  }
  for (const l of labelObjects) {
    scene.remove(l)
    if (l.element && l.element.parentNode) l.element.parentNode.removeChild(l.element)
  }
  if (lineMesh) {
    scene.remove(lineMesh)
    lineMesh.geometry?.dispose?.()
    lineMat?.dispose?.()
    lineMesh = null
    lineMat = null
  }

  nodeGroups = []
  labelObjects = []

  const tags = props.tags
  if (!tags.length) return

  const radius = Math.max(10, Math.min(18, tags.length * 0.55))
  const positions = fibonacciSphere(tags.length, radius)
  const posMap = new Map<string, { x: number; y: number; z: number }>()

  tags.forEach((tag, i) => {
    const pos = positions[i]
    posMap.set(tag.name, pos)

    const group = createNodeMesh(tag, pos)
    scene.add(group)
    nodeGroups.push(group)

    // CSS2D 标签：放置在节点上方
    const label = createCSS2DLabel(tag)
    if (label) {
      const labelOffset = 2.2 + Math.min(tag.count, 5) * 0.25
      label.position.set(pos.x, pos.y + labelOffset, pos.z)
      scene.add(label)
      labelObjects.push(label)
    }
  })

  lineMesh = createLineMesh(posMap)
  if (lineMesh) scene.add(lineMesh)
}

/* ---------- 动画循环 ---------- */
function animate() {
  animationId = requestAnimationFrame(animate)

  if (!isDragging) {
    rotVelY += (AUTO_SPEED - rotVelY) * 0.02
    rotVelX *= DAMPING
    rotVelY = rotVelY * DAMPING + AUTO_SPEED * (1 - DAMPING)
  } else {
    rotVelX *= 0.98
    rotVelY *= 0.98
  }

  scene.rotation.x += rotVelX
  scene.rotation.y += rotVelY

  // 节点呼吸动画
  const time = performance.now() * 0.001
  for (const group of nodeGroups) {
    const core = group.children[0]
    const base = group.userData.baseScale || 1
    const pulse = 1 + Math.sin(time * 1.2 + group.position.x * 0.3) * 0.06
    core.scale.setScalar(base * pulse)

    const ring = group.children[1]
    if (ring) {
      ring.material.opacity = 0.08 + Math.sin(time * 0.9 + group.position.y * 0.4) * 0.05
    }
  }

  // 连线闪烁
  if (lineMat) {
    lineMat.opacity = 0.7 + Math.sin(time * 0.6) * 0.15
  }

  // CSS2D 标签：仅控制 opacity，不覆盖 transform
  for (let i = 0; i < labelObjects.length; i++) {
    const label = labelObjects[i]
    const group = nodeGroups[i]
    if (!label || !group) continue

    const isHover = hoveredTag.value === group.userData.tag

    // 根据相机距离计算深度缩放
    const worldPos = new THREE.Vector3()
    group.getWorldPosition(worldPos)
    worldPos.y += 2.2 + Math.min(group.userData.count || 0, 5) * 0.25
    const dist = camera.position.distanceTo(worldPos)
    const depthScale = Math.max(0.55, 28 / dist)

    // 只调整 opacity 和 scale（通过 class 控制）
    const el = label.element
    if (isHover) {
      el.classList.add('is-hovered')
      el.style.opacity = '1'
      el.style.transform = ''  // 让 CSS2DRenderer 处理定位
      el.style.setProperty('--label-scale', `${depthScale * 1.3}`)
    } else {
      el.classList.remove('is-hovered')
      el.style.opacity = String(Math.max(0.55, Math.min(1, depthScale)))
      el.style.transform = ''
      el.style.setProperty('--label-scale', `${depthScale}`)
    }
  }

  // 星尘缓慢旋转
  if (starField) {
    starField.rotation.y += 0.0002
    starField.rotation.x += 0.0001
  }

  renderer.render(scene, camera)
  if (labelRenderer) labelRenderer.render(scene, camera)
}

/* ---------- 交互 ---------- */
function onMouseDown(e: MouseEvent) {
  isDragging = true
  dragMoved = false
  clickStartX = e.clientX
  clickStartY = e.clientY
  lastMouseX = e.clientX
  lastMouseY = e.clientY
  if (containerEl) containerEl.style.cursor = 'grabbing'
}

function onMouseMove(e: MouseEvent) {
  if (!containerEl || !camera || !raycaster) return
  const rect = containerEl.getBoundingClientRect()

  if (isDragging) {
    const dx = e.clientX - lastMouseX
    const dy = e.clientY - lastMouseY
    lastMouseX = e.clientX
    lastMouseY = e.clientY
    if (Math.abs(e.clientX - clickStartX) > 4 || Math.abs(e.clientY - clickStartY) > 4) {
      dragMoved = true
    }
    rotVelY += dx * DRAG_SENSITIVITY
    rotVelX += dy * DRAG_SENSITIVITY
    const maxVel = 0.08
    rotVelX = Math.max(-maxVel, Math.min(maxVel, rotVelX))
    rotVelY = Math.max(-maxVel, Math.min(maxVel, rotVelY))
  }

  pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
  pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1

  raycaster.setFromCamera(pointer, camera)
  const meshes = nodeGroups.map((g) => g.children[0]).filter(Boolean)
  const intersects = raycaster.intersectObjects(meshes, false)

  // 重置 hover
  for (const group of nodeGroups) {
    const mat = group.children[0]?.material
    if (mat && 'emissiveIntensity' in mat) {
      mat.emissiveIntensity = 0.5
    }
    const ring = group.children[1]
    if (ring && ring.material) ring.material.opacity = 0.12
  }

  if (intersects.length > 0) {
    const hitMesh = intersects[0].object
    const tagName = hitMesh?.userData?.tag
    if (tagName) {
      hoveredTag.value = tagName
      const mat = hitMesh.material
      if (mat && 'emissiveIntensity' in mat) {
        mat.emissiveIntensity = 1.0
      }
      const hitGroup = hitMesh.parent
      const ring = hitGroup?.children[1]
      if (ring && ring.material) ring.material.opacity = 0.35
      if (containerEl) containerEl.style.cursor = 'pointer'
    }
  } else {
    if (!isDragging) {
      hoveredTag.value = null
      if (containerEl) containerEl.style.cursor = 'grab'
    }
  }
}

function onMouseUp() {
  isDragging = false
  if (containerEl && containerEl.style.cursor === 'grabbing') {
    containerEl.style.cursor = 'grab'
  }
}

function onMouseLeave() {
  isDragging = false
  hoveredTag.value = null
  dragMoved = false
  if (containerEl) containerEl.style.cursor = 'grab'
}

function onClick(_e: MouseEvent) {
  if (dragMoved) return
  if (hoveredTag.value) {
    emit('select-tag', hoveredTag.value)
  }
}

/* ---------- 触摸 ---------- */
function onTouchStart(e: TouchEvent) {
  if (e.touches.length === 1) {
    isDragging = true
    dragMoved = false
    clickStartX = e.touches[0].clientX
    clickStartY = e.touches[0].clientY
    lastMouseX = e.touches[0].clientX
    lastMouseY = e.touches[0].clientY
  }
}

function onTouchMove(e: TouchEvent) {
  if (e.touches.length === 1 && isDragging) {
    const dx = e.touches[0].clientX - lastMouseX
    const dy = e.touches[0].clientY - lastMouseY
    lastMouseX = e.touches[0].clientX
    lastMouseY = e.touches[0].clientY
    if (Math.abs(e.touches[0].clientX - clickStartX) > 4) dragMoved = true
    rotVelY += dx * DRAG_SENSITIVITY
    rotVelX += dy * DRAG_SENSITIVITY
    const maxVel = 0.08
    rotVelX = Math.max(-maxVel, Math.min(maxVel, rotVelX))
    rotVelY = Math.max(-maxVel, Math.min(maxVel, rotVelY))
  }
}

function onTouchEnd() {
  isDragging = false
}

/* ---------- Resize ---------- */
function onResize() {
  if (!containerEl || !camera || !renderer) return
  const w = containerEl.clientWidth
  const h = containerEl.clientHeight
  if (w === 0 || h === 0) return
  camera.aspect = w / h
  camera.updateProjectionMatrix()
  renderer.setSize(w, h)
  if (labelRenderer) labelRenderer.setSize(w, h)
}

/* ---------- 清理 ---------- */
function cleanup() {
  if (animationId) {
    cancelAnimationFrame(animationId)
    animationId = 0
  }
  if (renderer) {
    renderer.dispose()
    if (containerEl && renderer.domElement.parentNode === containerEl) {
      containerEl.removeChild(renderer.domElement)
    }
    renderer = null
  }
  if (labelRenderer) {
    if (containerEl && labelRenderer.domElement.parentNode === containerEl) {
      containerEl.removeChild(labelRenderer.domElement)
    }
    labelRenderer = null
  }
  for (const l of labelObjects) {
    if (l.element && l.element.parentNode) l.element.parentNode.removeChild(l.element)
  }
  scene = null
  camera = null
  nodeGroups = []
  labelObjects = []
  lineMesh = null
  lineMat = null
  starField = null
}

/* ---------- 主题/数据变化 → 重建 ---------- */
watch(resolved, () => {
  if (!isReady.value || !THREE) return
  if (scene) scene.background = new THREE.Color(tc('bg'))
  if (renderer) renderer.setClearColor(tc('bg'), 1)
  rebuildNodes()
})

watch(
  () => props.tags,
  () => {
    if (isReady.value && THREE) rebuildNodes()
  },
  { deep: true }
)

/* ---------- 生命周期 ---------- */
onMounted(async () => {
  if (shouldUseFallback()) {
    hasWebGL.value = false
    return
  }
  try {
    const [threeModule, css2dModule] = await Promise.all([
      import('three'),
      import('three/examples/jsm/renderers/CSS2DRenderer.js').catch(() => null)
    ])
    THREE = threeModule
    CSS2DRendererModule = css2dModule
    containerEl = rootRef.value

    if (!containerEl) {
      hasWebGL.value = false
      return
    }

    // 使用 ResizeObserver 等待容器尺寸就绪
    const tryBuild = () => {
      if (!containerEl) return
      if (containerEl.clientWidth > 0 && containerEl.clientHeight > 0) {
        if (!isReady.value) {
          buildScene()
        }
        resizeObserver?.disconnect()
        resizeObserver = null
      }
    }

    // 立即尝试一次
    await nextTick()
    requestAnimationFrame(tryBuild)

    // 如果还没尺寸，用 ResizeObserver 监听
    if (containerEl.clientWidth === 0) {
      resizeObserver = new ResizeObserver(() => {
        tryBuild()
      })
      resizeObserver.observe(containerEl)
    }
  } catch {
    hasWebGL.value = false
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize)
  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = null
  }
  cleanup()
})

defineExpose({ hoveredTag })
</script>

<template>
  <div class="tag-network-3d w-full h-full relative select-none">
    <!-- 轨道加载动画 -->
    <OrbitLoader :visible="!isReady && hasWebGL" text="初始化 3D 星链..." />
    <div
      ref="rootRef"
      v-if="hasWebGL"
      class="w-full h-full cursor-grab"
    />

    <!-- 降级：2D -->
    <div v-else class="fallback-grid w-full h-full p-8 overflow-auto">
      <div class="flex flex-wrap gap-3 justify-center items-center min-h-full">
        <button
          v-for="tag in tags"
          :key="tag.name"
          class="tag-chip px-4 py-2 rounded-full text-sm font-medium transition-all hover:scale-105"
          :style="{
            background: 'hsl(var(--brand) / 0.1)',
            color: 'hsl(var(--brand))',
            border: '1px solid hsl(var(--brand) / 0.3)'
          }"
          @click="emit('select-tag', tag.name)"
        >
          #{{ tag.name }}
          <span
            v-if="tag.count"
            class="ml-2 px-1.5 py-0.5 rounded-full text-xs text-white"
            :style="{ background: 'hsl(var(--accent))' }"
          >{{ tag.count }}</span>
        </button>
      </div>
    </div>

    <!-- Hover 提示 -->
    <Transition name="fade">
      <div
        v-if="hoveredTag && hasWebGL"
        class="absolute top-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full text-sm font-medium pointer-events-none backdrop-blur-md z-30"
        :style="{
          background: 'hsl(var(--surface-elevated) / 0.9)',
          color: 'hsl(var(--text))',
          border: '1px solid hsl(var(--border))',
          boxShadow: '0 4px 12px rgba(0,0,0,0.08)'
        }"
      >
        点击 <span class="font-semibold" style="color: hsl(var(--brand))">#{{ hoveredTag }}</span> 管理
      </div>
    </Transition>
  </div>
</template>

<style>
/* CSS2D 标签样式 — 通过 CSS 变量控制 scale */
.three-tag-label {
  --label-scale: 1;
  pointer-events: none;
  z-index: 50;
  transition: opacity 0.25s ease;
}

.three-tag-label .tag-label-inner {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 10px 5px 8px;
  border-radius: 20px;
  white-space: nowrap;
  font-family: 'Inter', system-ui, sans-serif;
  font-weight: 600;
  font-size: 13px;
  line-height: 1;
  box-shadow: 0 2px 12px rgba(0,0,0,0.12);
  backdrop-filter: blur(10px);
  transform: scale(var(--label-scale));
  transform-origin: center center;
  transition: box-shadow 0.2s ease, transform 0.2s ease;
}

.three-tag-label.is-hovered .tag-label-inner {
  box-shadow: 0 4px 20px rgba(75, 63, 227, 0.4);
  filter: brightness(1.1);
}

.three-tag-label.is-light .tag-label-inner {
  background: rgba(255, 255, 255, 0.95);
  color: #171717;
  border: 1px solid rgba(0,0,0,0.08);
}

.three-tag-label.is-dark .tag-label-inner {
  background: rgba(20, 15, 40, 0.92);
  color: #e4e4e7;
  border: 1px solid rgba(255,255,255,0.1);
}

.three-tag-label .tag-dot {
  width: 4px;
  height: 16px;
  border-radius: 2px;
}

.three-tag-label .tag-name {
  font-size: 12px;
  letter-spacing: -0.01em;
}

.three-tag-label .tag-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 9px;
  font-size: 10px;
  color: #fff;
  font-weight: 700;
}

/* Vue scoped needs :deep for nested styles */
.tag-network-3d :deep(.three-tag-label) {
  --label-scale: 1;
  pointer-events: none;
  z-index: 50;
  transition: opacity 0.25s ease;
}
.tag-network-3d :deep(.three-tag-label .tag-label-inner) {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 10px 5px 8px;
  border-radius: 20px;
  white-space: nowrap;
  font-family: 'Inter', system-ui, sans-serif;
  font-weight: 600;
  font-size: 13px;
  line-height: 1;
  box-shadow: 0 2px 12px rgba(0,0,0,0.12);
  backdrop-filter: blur(10px);
  transform: scale(var(--label-scale));
  transform-origin: center center;
}
.tag-network-3d :deep(.three-tag-label.is-hovered .tag-label-inner) {
  box-shadow: 0 4px 20px rgba(75, 63, 227, 0.4);
}
.tag-network-3d :deep(.three-tag-label.is-light .tag-label-inner) {
  background: rgba(255, 255, 255, 0.95);
  color: #171717;
  border: 1px solid rgba(0,0,0,0.08);
}
.tag-network-3d :deep(.three-tag-label.is-dark .tag-label-inner) {
  background: rgba(20, 15, 40, 0.92);
  color: #e4e4e7;
  border: 1px solid rgba(255,255,255,0.1);
}
.tag-network-3d :deep(.three-tag-label .tag-dot) {
  width: 4px;
  height: 16px;
  border-radius: 2px;
}
.tag-network-3d :deep(.three-tag-label .tag-name) {
  font-size: 12px;
  letter-spacing: -0.01em;
}
.tag-network-3d :deep(.three-tag-label .tag-count) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 9px;
  font-size: 10px;
  color: #fff;
  font-weight: 700;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
.fallback-grid {
  background: hsl(var(--surface));
}
</style>
