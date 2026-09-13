import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import argon2 from 'argon2';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { CreateUserDto } from './dto/create-user.dto.js';
import { UpdateUserStatusDto } from './dto/update-user-status.dto.js';
import { UserRole } from '../../generated/prisma/client.js';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.user.findMany({
      select: { id: true, name: true, login: true, role: true, status: true, createdAt: true },
      orderBy: { name: 'asc' },
    });
  }

  async create(dto: CreateUserDto) {
    if (dto.role === UserRole.ADMIN) {
      if (!dto.login || !dto.password) {
        throw new ConflictException('Admin uchun login va parol shart');
      }
      const passwordHash = await argon2.hash(dto.password);
      return this.prisma.user.create({
        data: { name: dto.name, role: dto.role, login: dto.login, passwordHash },
        select: { id: true, name: true, login: true, role: true, status: true },
      });
    }

    if (!dto.pin) {
      throw new ConflictException('Kassir uchun PIN shart');
    }
    const pinHash = await argon2.hash(dto.pin);
    return this.prisma.user.create({
      data: { name: dto.name, role: dto.role, pinHash },
      select: { id: true, name: true, role: true, status: true },
    });
  }

  async updateStatus(id: string, dto: UpdateUserStatusDto) {
    await this.assertExists(id);
    return this.prisma.user.update({
      where: { id },
      data: { status: dto.status },
      select: { id: true, name: true, role: true, status: true },
    });
  }

  async updatePin(id: string, pin: string) {
    const user = await this.assertExists(id);
    if (user.role !== UserRole.CASHIER) {
      throw new ConflictException('Faqat kassir uchun PIN o\'rnatiladi');
    }
    const pinHash = await argon2.hash(pin);
    return this.prisma.user.update({
      where: { id },
      data: { pinHash },
      select: { id: true, name: true, role: true, status: true },
    });
  }

  private async assertExists(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Foydalanuvchi topilmadi');
    return user;
  }
}
