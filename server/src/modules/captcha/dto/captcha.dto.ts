/**
 * 滑块验证码响应结构
 * 与前端 SlideCaptcha.vue 组件字段完全一致
 */
export interface CaptchaResponse {
  /** 验证码唯一 ID（前端提交时回传） */
  captchaId: string;
  /** 背景图（带缺口阴影），base64 data URI */
  bgImage: string;
  /** 拼图块图片，base64 data URI */
  puzzleImage: string;
  /** 画布宽度 */
  canvasWidth: number;
  /** 画布高度 */
  canvasHeight: number;
  /** 拼图块尺寸（正方形边长） */
  puzzleSize: number;
  /** 拼图块的 Y 坐标（前端用于把拼图块放到缺口同一高度） */
  puzzleY: number;
}
