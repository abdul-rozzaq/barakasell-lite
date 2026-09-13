import { Injectable, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import argon2 from 'argon2';
import { PrismaService } from '../../common/prisma/prisma.service.js';

interface AccessTokenPayload {
  sub: string;
  role: 'ADMIN' | 'CASHIER';
}

interface PinConfirmPayload {
  sub: string;
  purpose: 'pin-confirm';
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async loginAdmin(login: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { login } });
    if (!user || user.role !== 'ADMIN' || !user.passwordHash) {
      throw new UnauthorizedException('Login yoki parol noto\'g\'ri');
    }
    if (user.status !== 'ACTIVE') {
      throw new ForbiddenException('Foydalanuvchi bloklangan');
    }
    const valid = await argon2.verify(user.passwordHash, password);
    if (!valid) {
      throw new UnauthorizedException('Login yoki parol noto\'g\'ri');
    }
    return this.issueAccessToken(user.id, user.role);
  }

  async loginPin(userId: string, pin: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.role !== 'CASHIER' || !user.pinHash) {
      throw new UnauthorizedException('Noto\'g\'ri PIN kod');
    }
    if (user.status !== 'ACTIVE') {
      throw new ForbiddenException('Foydalanuvchi bloklangan');
    }
    const valid = await argon2.verify(user.pinHash, pin);
    if (!valid) {
      throw new UnauthorizedException('Noto\'g\'ri PIN kod');
    }
    return this.issueAccessToken(user.id, user.role);
  }

  async confirmPin(userId: string, pin: string): Promise<{ confirmationToken: string }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    const hash = user?.role === 'ADMIN' ? user.passwordHash : user?.pinHash;
    if (!user || !hash) {
      throw new UnauthorizedException('Noto\'g\'ri PIN kod');
    }
    const valid = await argon2.verify(hash, pin);
    if (!valid) {
      throw new UnauthorizedException('Noto\'g\'ri PIN kod');
    }
    const payload: PinConfirmPayload = { sub: userId, purpose: 'pin-confirm' };
    const confirmationToken = await this.jwt.signAsync(payload, { expiresIn: '60s' });
    return { confirmationToken };
  }

  listCashiers() {
    return this.prisma.user.findMany({
      where: { role: 'CASHIER', status: 'ACTIVE' },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, role: true, status: true },
    });
    if (!user) throw new UnauthorizedException();
    return user;
  }

  private async issueAccessToken(userId: string, role: 'ADMIN' | 'CASHIER') {
    const payload: AccessTokenPayload = { sub: userId, role };
    const accessToken = await this.jwt.signAsync(payload, { expiresIn: '12h' });
    return { accessToken, role, userId };
  }
}
