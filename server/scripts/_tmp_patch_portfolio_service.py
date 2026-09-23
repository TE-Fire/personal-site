"""一次性脚本：给 portfolio.service.ts 注入 coverImage 支持 + 封面文件清理。"""
p = 'src/modules/portfolio/portfolio.service.ts'
s = open(p, encoding='utf-8').read()

reps = [
    ("  cover: string;\n  tags: Prisma.JsonValue;",
     "  cover: string;\n  coverImage: string | null;\n  tags: Prisma.JsonValue;"),
    ("          cover: dto.cover ?? '',\n          tags: dto.tags,",
     "          cover: dto.cover ?? '',\n          coverImage: dto.coverImage ?? null,\n          tags: dto.tags,"),
    ("    if (dto.cover !== undefined) data.cover = dto.cover;",
     "    if (dto.cover !== undefined) data.cover = dto.cover;\n"
     "    if (dto.coverImage !== undefined) data.coverImage = dto.coverImage;"),
    ("      cover: row.cover || '',\n      tags:",
     "      cover: row.cover || '',\n      coverImage: row.coverImage || null,\n      tags:"),
    ("      select: { slug: true },",
     "      select: { slug: true, coverImage: true },"),
    ("    // ③ 删列表 + 详情缓存\n    await this.invalidateListCache();\n"
     "    await this.invalidateDetailCache(existing.slug);\n  }",
     "    // ③ 清理封面图本地文件（外链由 storageService 自行跳过）\n"
     "    if (existing.coverImage) {\n      this.storageService.delete(existing.coverImage);\n    }\n\n"
     "    // ④ 删列表 + 详情缓存\n    await this.invalidateListCache();\n"
     "    await this.invalidateDetailCache(existing.slug);\n  }"),
]

for a, b in reps:
    assert a in s, a[:60]
    s = s.replace(a, b, 1)

# 注入 storageService 依赖
if 'WorkCoverStorageService' not in s:
    s = s.replace(
        "} from './dto/portfolio.dto';",
        "} from './dto/portfolio.dto';\nimport { WorkCoverStorageService } from './work-cover-storage.service';",
        1,
    )
    s = s.replace(
        "  constructor(",
        "  constructor(\n    private readonly storageService: WorkCoverStorageService,",
        1,
    )

open(p, 'w', encoding='utf-8', newline='\n').write(s)
print('ok')
