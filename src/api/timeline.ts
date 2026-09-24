/**
 * Timeline 模块前端 API 封装（经历时间线）
 *
 * 与后端 TimelineController 路由对齐：
 *   GET    /api/timeline            公开经历列表（visible=true，按时间倒序）
 *   GET    /api/timeline/admin/list 管理端列表（含已隐藏，需登录）
 *   GET    /api/timeline/admin/meta 编辑器候选标签（需登录）
 *   POST   /api/timeline            新建经历（需登录）
 *   PUT    /api/timeline/:id        更新经历（需登录）
 *   DELETE /api/timeline/:id        删除经历（需登录）
 *
 * axios 响应拦截器已自动解包 ApiResult.data，这里 request<T> 直接返回业务 data。
 */
import { request } from '@/lib/axios';

/* ============================================================
 *  类型定义
 * ============================================================ */

/**
 * 前端使用的节点类型（kebab-case，与 src/data/timeline.ts 的 mock 类型保持一致，
 * 便于「接口失败回退 mock」时代码零分支）。
 * 后端返回大写下划线形式，由本模块负责双向转换。
 */
export type TimelineKindLower = 'work' | 'education' | 'open-source' | 'milestone';

/** 后端枚举值 */
type TimelineKindUpper = 'WORK' | 'EDUCATION' | 'OPEN_SOURCE' | 'MILESTONE';

const KIND_TO_UPPER: Record<TimelineKindLower, TimelineKindUpper> = {
  work: 'WORK',
  education: 'EDUCATION',
  'open-source': 'OPEN_SOURCE',
  milestone: 'MILESTONE',
};

const KIND_TO_LOWER: Record<TimelineKindUpper, TimelineKindLower> = {
  WORK: 'work',
  EDUCATION: 'education',
  OPEN_SOURCE: 'open-source',
  MILESTONE: 'milestone',
};

/** 经历条目（前端视图模型，kind 为 kebab-case） */
export interface TimelineNodeData {
  id: number;
  kind: TimelineKindLower;
  title: string;
  subTitle: string;
  /** YYYY-MM */
  startedAt: string;
  /** YYYY-MM，空串表示未填 */
  endedAt: string;
  ongoing: boolean;
  description: string;
  tags: string[];
  /** 是否在公开页展示 */
  visible: boolean;
  updatedAt: string;
}

/** 后端返回的原始结构（kind 为大写枚举） */
interface TimelineNodeRaw
  extends Omit<TimelineNodeData, 'kind' | 'updatedAt'> {
  kind: TimelineKindUpper;
  updatedAt: string;
}

/** 新建 / 更新入参（kind 用 kebab-case，交由本模块转大写） */
export interface TimelineNodePayload {
  kind: TimelineKindLower;
  title: string;
  subTitle?: string;
  startedAt: string;
  endedAt?: string;
  ongoing?: boolean;
  description: string;
  tags?: string[];
  visible?: boolean;
}

/** 编辑器元数据 */
export interface TimelineMeta {
  tags: string[];
}

/* ============================================================
 *  内部工具
 * ============================================================ */

/** 后端行 → 前端视图模型 */
function toView(raw: TimelineNodeRaw): TimelineNodeData {
  return {
    ...raw,
    kind: KIND_TO_LOWER[raw.kind] ?? 'milestone',
  };
}

/** 前端入参 → 后端入参 */
function toPayload(payload: Partial<TimelineNodePayload>) {
  const { kind, ...rest } = payload;
  return {
    ...rest,
    ...(kind ? { kind: KIND_TO_UPPER[kind] } : {}),
  };
}

/* ============================================================
 *  公开接口
 * ============================================================ */

/** 获取公开经历列表（游客可看） */
export async function fetchTimeline(): Promise<TimelineNodeData[]> {
  const rows = await request<TimelineNodeRaw[]>({
    method: 'GET',
    url: '/timeline',
  });
  return rows.map(toView);
}

/* ============================================================
 *  管理端接口（需 JWT）
 * ============================================================ */

/** 管理端：获取全部经历（含已隐藏） */
export async function getAdminTimeline(): Promise<TimelineNodeData[]> {
  const rows = await request<TimelineNodeRaw[]>({
    method: 'GET',
    url: '/timeline/admin/list',
  });
  return rows.map(toView);
}

/** 管理端：编辑器候选标签（全表去重） */
export async function getTimelineMeta(): Promise<TimelineMeta> {
  return request<TimelineMeta>({
    method: 'GET',
    url: '/timeline/admin/meta',
  });
}

/** 管理端：新建经历 */
export async function createTimelineNode(
  payload: TimelineNodePayload,
): Promise<TimelineNodeData> {
  const raw = await request<TimelineNodeRaw>({
    method: 'POST',
    url: '/timeline',
    data: toPayload(payload),
  });
  return toView(raw);
}

/** 管理端：更新经历（仅传需要变更的字段） */
export async function updateTimelineNode(
  id: number,
  payload: Partial<TimelineNodePayload>,
): Promise<TimelineNodeData> {
  const raw = await request<TimelineNodeRaw>({
    method: 'PUT',
    url: `/timeline/${id}`,
    data: toPayload(payload),
  });
  return toView(raw);
}

/** 管理端：删除经历 */
export async function deleteTimelineNode(id: number): Promise<void> {
  return request<void>({
    method: 'DELETE',
    url: `/timeline/${id}`,
  });
}

/* ============================================================
 *  展示元信息（与后端枚举一一对应，供页面渲染复用）
 * ============================================================ */

/** 编辑器下拉选项（顺序与页面展示习惯一致：工作 → 教育 → 开源 → 里程碑） */
export const TIMELINE_KIND_OPTIONS: Array<{
  value: TimelineKindLower;
  label: string;
}> = [
  { value: 'work', label: '工作经历' },
  { value: 'education', label: '教育背景' },
  { value: 'open-source', label: '开源项目' },
  { value: 'milestone', label: '里程碑' },
];
