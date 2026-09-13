import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { Public } from '../../common/decorators/public.decorator.js';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  async check() {
    await this.prisma.$queryRaw`SELECT 1`;
    return { db: 'ok' };
  }
}
