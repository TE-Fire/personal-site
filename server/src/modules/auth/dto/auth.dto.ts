import { IsNotEmpty, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * 登录请求参数
 */
export class LoginDto {
  @ApiProperty({ description: '用户名', example: 'admin' })
  @IsString({ message: '用户名必须是字符串' })
  @IsNotEmpty({ message: '用户名不能为空' })
  username: string;

  @ApiProperty({ description: '密码', minLength: 6, example: '123456' })
  @IsString({ message: '密码必须是字符串' })
  @MinLength(6, { message: '密码至少 6 位' })
  password: string;
}

/**
 * 注册请求参数
 */
export class RegisterDto extends LoginDto {
  @ApiProperty({ description: '昵称', example: 'TE-Fire', required: false })
  @IsString()
  nickname?: string;
}

/**
 * 登录成功响应
 */
export interface TokenPayload {
  accessToken: string;
  expiresIn: number;   // 秒
  tokenType: string;   // Bearer
}
