import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/**
 * Common 模块：全局共享基础设施。
 * 用 @Global() 注解后，其他 feature 模块无需 imports 即可使用。
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class CommonModule {}
