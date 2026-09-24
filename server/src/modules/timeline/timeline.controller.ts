import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Result } from '@/common/result';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TimelineService } from './timeline.service';
import {
  CreateTimelineNodeDto,
  UpdateTimelineNodeDto,
  TimelineNodeRsp,
  TimelineMetaRsp,
} from './dto/timeline.dto';

/**
 * Timeline 模块 Controller（经历时间线）
 *
 * 路由前缀 /api/timeline
 *   · GET    /             公开，返回 visible=true 的经历（按时间倒序）
 *   · GET    /admin/list    JWT，返回全部经历（含 visible=false）
 *   · GET    /admin/meta    JWT，编辑器候选标签（去重）
 *   · POST   /              JWT，新建经历
 *   · PUT    /:id           JWT，更新经历
 *   · DELETE /:id           JWT，删除经历
 *
 * 路由顺序注意：
 *   · GET  /admin/list、/admin/meta 必须在任何 /:id 捕获路由之前声明
 *   · 本模块无公开详情接口（时间线是一整页，不需要单条详情页）
 */
@ApiTags('经历时间线 Timeline')
@Controller('timeline')
export class TimelineController {
  constructor(private readonly timelineService: TimelineService) {}

  /* ========== GET /api/timeline —— 公开，经历列表 ========== */

  @Get()
  @ApiOperation({ summary: '获取公开经历列表（visible=true，按开始时间倒序）' })
  async getPublicNodes(): Promise<Result<TimelineNodeRsp[]>> {
    const data = await this.timelineService.getPublicNodes();
    return Result.ok(data);
  }

  /* ========== GET /api/timeline/admin/list —— 管理员，全部经历 ========== */

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('admin/list')
  @ApiOperation({ summary: '获取全部经历（含已隐藏，admin 用）' })
  async getAdminNodes(): Promise<Result<TimelineNodeRsp[]>> {
    const data = await this.timelineService.getAdminNodes();
    return Result.ok(data);
  }

  /* ========== GET /api/timeline/admin/meta —— 管理员，编辑器元数据 ========== */

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('admin/meta')
  @ApiOperation({ summary: '获取编辑器候选标签（全表去重，按频次降序）' })
  async getMeta(): Promise<Result<TimelineMetaRsp>> {
    const data = await this.timelineService.getMeta();
    return Result.ok(data);
  }

  /* ========== POST /api/timeline —— 管理员，新建经历 ========== */

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post()
  @ApiOperation({ summary: '新建经历条目' })
  async createNode(
    @Body() dto: CreateTimelineNodeDto,
  ): Promise<Result<TimelineNodeRsp>> {
    const data = await this.timelineService.createNode(dto);
    return Result.ok(data);
  }

  /* ========== PUT /api/timeline/:id —— 管理员，更新经历 ========== */

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Put(':id')
  @ApiOperation({ summary: '更新经历条目（仅更新传入字段）' })
  async updateNode(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTimelineNodeDto,
  ): Promise<Result<TimelineNodeRsp>> {
    const data = await this.timelineService.updateNode(id, dto);
    return Result.ok(data);
  }

  /* ========== DELETE /api/timeline/:id —— 管理员，删除经历 ========== */

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  @ApiOperation({ summary: '删除经历条目（物理删除）' })
  async deleteNode(@Param('id', ParseIntPipe) id: number): Promise<Result<null>> {
    await this.timelineService.deleteNode(id);
    return Result.ok(null);
  }
}
