import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { UpdateSettingsDto } from './dto/update-settings.dto.js';

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  get() {
    return this.prisma.settings.upsert({
      where: { id: 1 },
      create: { id: 1 },
      update: {},
    });
  }

  async update(dto: UpdateSettingsDto) {
    await this.get();
    return this.prisma.settings.update({ where: { id: 1 }, data: dto });
  }
}
