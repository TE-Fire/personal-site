import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * JWT 守卫：标注在 Controller/方法上，强制校验 Authorization: Bearer xxx
 *
 * 目前 passort-jwt 策略还没实现，等 JwtStrategy 接入后即可生效。
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
