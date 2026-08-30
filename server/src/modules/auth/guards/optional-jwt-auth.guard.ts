import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * 可选 JWT 守卫（游客+登录用户均放行）
 *
 * 与 JwtAuthGuard 区别：
 *   · JwtAuthGuard = 强制 JWT，无/非法 Token 直接抛 401
 *   · OptionalJwtAuthGuard = 有合法 Token → req.user = { id, username, ... }
 *                            无 Token / Token 非法 → 放行，req.user = undefined
 *
 * 适用场景：公开读接口（About / Contribution Site 等）需要区分游客/博主，
 *          但无 Token 时不阻断，给一个默认 userId=1（个人博客只有一个博主）。
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  /**
   * 拦截 Passport 的错误处理：JWT 校验失败（含"无 Authorization 头"）时
   * 不抛错、不阻断，直接放行，由 Controller 侧用 req.user?.id ?? 1 兜底。
   */
  handleRequest<TUser = any>(
    err: any,
    user: any,
    _info: any,
  ): TUser | null {
    if (err) return null;
    return user ?? null;
  }
}
