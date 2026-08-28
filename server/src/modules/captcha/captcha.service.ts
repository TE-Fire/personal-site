import { Injectable, Logger } from '@nestjs/common';
import * as path from 'path';
import * as fs from 'fs';
import { randomUUID } from 'crypto';
import sharp from 'sharp';
import { RedisService } from '../redis/redis.service';
import { CaptchaResponse } from './dto/captcha.dto';

/**
 * 滑块验证码 Service
 *
 * 生成流程：
 *   1. 从 public/captcha-bg/ 随机读取一张背景图
 *   2. resize 到 300×180
 *   3. 随机选取拼图位置 (targetX, targetY)
 *   4. 从背景图裁剪 48×48 拼图块
 *   5. 在背景图上叠加半透明阴影矩形（模拟"缺口"）
 *   6. captchaId → targetX 存入 Redis（TTL 5min）
 *   7. 返回两张 base64 图 + 尺寸参数
 */
@Injectable()
export class CaptchaService {
  private readonly logger = new Logger(CaptchaService.name);

  /** 画布尺寸 */
  private readonly CANVAS_W = 300;
  private readonly CANVAS_H = 180;
  /** 拼图块边长 */
  private readonly PUZZLE_SIZE = 48;
  /** 验证容差（像素） */
  private readonly TOLERANCE = 5;
  /** Redis TTL */
  private readonly CAPTCHA_TTL = 300; // 5 分钟
  /** 背景图目录 */
  private readonly BG_DIR = path.join(process.cwd(), 'public', 'captcha-bg');

  /** 内存 fallback（Redis 不可用时） */
  private readonly memoryStore = new Map<string, number>();

  constructor(private readonly redis: RedisService) {}

  /**
   * 生成滑块验证码
   */
  async generate(): Promise<CaptchaResponse> {
    // 1. 读取随机背景图
    const bgPath = this.pickRandomBg();
    if (!bgPath) {
      throw new Error('未找到验证码背景图，请将图片放入 server/public/captcha-bg/');
    }

    // 2. resize 到标准尺寸
    const bgBuffer = await sharp(bgPath)
      .resize(this.CANVAS_W, this.CANVAS_H, { fit: 'cover' })
      .jpeg({ quality: 90 })
      .toBuffer();

    // 3. 随机拼图位置
    const targetX = this.randomInt(
      this.PUZZLE_SIZE + 10,
      this.CANVAS_W - this.PUZZLE_SIZE - 10,
    );
    const targetY = this.randomInt(
      10,
      this.CANVAS_H - this.PUZZLE_SIZE - 10,
    );

    // 4. 裁剪拼图块
    const puzzleBuffer = await sharp(bgBuffer)
      .extract({
        left: targetX,
        top: targetY,
        width: this.PUZZLE_SIZE,
        height: this.PUZZLE_SIZE,
      })
      .png()
      .toBuffer();

    // 5. 在背景图上叠加缺口阴影
    const shadowSvg = this.buildShadowSvg(
      targetX,
      targetY,
      this.PUZZLE_SIZE,
    );
    const bgWithHole = await sharp(bgBuffer)
      .composite([
        {
          input: Buffer.from(shadowSvg),
          top: 0,
          left: 0,
        },
      ])
      .jpeg({ quality: 90 })
      .toBuffer();

    // 6. 存储 captchaId → targetX
    const captchaId = randomUUID();
    const redisKey = `captcha:${captchaId}`;
    try {
      await this.redis.set(redisKey, String(targetX), this.CAPTCHA_TTL);
    } catch {
      this.logger.warn('Redis 不可用，降级到内存存储');
      this.memoryStore.set(captchaId, targetX);
      setTimeout(
        () => this.memoryStore.delete(captchaId),
        this.CAPTCHA_TTL * 1000,
      );
    }

    // 7. 返回
    return {
      captchaId,
      bgImage: `data:image/jpeg;base64,${bgWithHole.toString('base64')}`,
      puzzleImage: `data:image/png;base64,${puzzleBuffer.toString('base64')}`,
      canvasWidth: this.CANVAS_W,
      canvasHeight: this.CANVAS_H,
      puzzleSize: this.PUZZLE_SIZE,
      puzzleY: targetY, // 拼图块的 Y 坐标（前端用于对齐缺口高度）
    };
  }

  /**
   * 校验滑块位置
   * @returns true=校验通过
   */
  async verify(captchaId: string, slideX: number): Promise<boolean> {
    const redisKey = `captcha:${captchaId}`;

    // 取出 targetX
    let targetX: number | undefined;
    try {
      const raw = await this.redis.get(redisKey);
      targetX = raw ? Number(raw) : undefined;
    } catch {
      targetX = this.memoryStore.get(captchaId);
    }

    if (targetX === undefined) {
      return false; // 验证码不存在或已过期
    }

    // 一次性消费：无论成功失败都删除
    try {
      await this.redis.del(redisKey);
    } catch {
      this.memoryStore.delete(captchaId);
    }

    // 校验容差
    return Math.abs(slideX - targetX) <= this.TOLERANCE;
  }

  /* ---------- 内部方法 ---------- */

  /** 从背景图目录随机选取一张 */
  private pickRandomBg(): string | null {
    if (!fs.existsSync(this.BG_DIR)) {
      this.logger.error(`背景图目录不存在: ${this.BG_DIR}`);
      return null;
    }

    const files = fs
      .readdirSync(this.BG_DIR)
      .filter((f) => /\.(jpg|jpeg|png)$/i.test(f));

    if (files.length === 0) {
      this.logger.error('背景图目录为空，请添加图片');
      return null;
    }

    const pick = files[this.randomInt(0, files.length)];
    return path.join(this.BG_DIR, pick);
  }

  /** 构建缺口阴影 SVG（覆盖在背景图上） */
  private buildShadowSvg(
    x: number,
    y: number,
    size: number,
  ): string {
    return `<svg width="${this.CANVAS_W}" height="${this.CANVAS_H}" xmlns="http://www.w3.org/2000/svg">
  <rect x="${x}" y="${y}" width="${size}" height="${size}"
        fill="rgba(0,0,0,0.55)" rx="4" ry="4"/>
  <rect x="${x}" y="${y}" width="${size}" height="${size}"
        fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="1" rx="4" ry="4"/>
</svg>`;
  }

  /** 随机整数 [min, max) */
  private randomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min)) + min;
  }
}
