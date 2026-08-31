import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const r1 = await prisma.tag.deleteMany({ where: { name: { contains: '测试标签' } } });
const r2 = await prisma.category.deleteMany({ where: { name: { contains: '测试分类' } } });
console.log(`清理脏数据: tag=${r1.count} category=${r2.count}`);
await prisma.$disconnect();
