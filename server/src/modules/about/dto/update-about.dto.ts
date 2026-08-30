import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

/**
 * SkillGroup 子 DTO（UpdateAboutDto.skillGroups 的嵌套项）
 */
export class UpdateAboutSkillGroupDto {
  @IsString()
  @MaxLength(40)
  id!: string;

  @IsString()
  @MaxLength(50)
  @IsNotEmpty()
  title!: string;

  @IsIn(['default', 'secondary', 'outline'])
  variant!: 'default' | 'secondary' | 'outline';

  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(50, { each: true })
  items!: string[];
}

/**
 * HighlightStat 子 DTO（{label, value}）
 */
export class UpdateAboutHighlightStatDto {
  @IsString()
  @MaxLength(30)
  label!: string;

  @IsString()
  @MaxLength(20)
  value!: string;
}

/**
 * PUT /api/about 入参 DTO（管理员保存 About 展示字段）
 *
 * 注意：不包含 name（=nickname）和 avatar —— 这两个走 User 模块的
 *   POST /users/me + POST /users/avatar 单独管理，
 *   由前端 Profile 页面 Tab1「账号资料」负责。
 */
export class UpdateAboutDto {
  /* ----------- 标量 ----------- */

  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  shortBio!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  location!: string;

  @IsBoolean()
  available!: boolean;

  /* ----------- 字符串数组 ----------- */

  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(2000, { each: true })
  longBio!: string[];

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(4)
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  tags!: string[];

  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(30, { each: true })
  interests!: string[];

  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MaxLength(500, { each: true })
  nowDoing!: string[];

  /* ----------- 对象数组（嵌套 DTO） ----------- */

  @IsArray()
  @ArrayMaxSize(8)
  @Type(() => UpdateAboutHighlightStatDto)
  @ValidateNested({ each: true })
  highlightStats!: UpdateAboutHighlightStatDto[];

  @IsArray()
  @ArrayMaxSize(6)
  @Type(() => UpdateAboutSkillGroupDto)
  @ValidateNested({ each: true })
  skillGroups!: UpdateAboutSkillGroupDto[];

  /* ----------- 可选字段：为后续扩展预留（兼容 PUT 部分字段） ----------- */
  @IsOptional()
  @IsObject()
  meta?: Record<string, unknown>;
}
