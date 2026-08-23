import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async login(loginId: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: {
        loginId,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid login credentials');
    }

    const passwordValid = await argon2.verify(user.passwordHash, password);

    if (!passwordValid) {
      throw new UnauthorizedException('Invalid login credentials');
    }

    const payload = {
      sub: user.id,
      loginId: user.loginId,
      role: user.role,
    };

    const accessToken = await this.jwtService.signAsync(payload);

    return {
      accessToken,
      user: {
        id: user.id,
        loginId: user.loginId,
        role: user.role,
        status: user.status,
      },
    };
  }

  async getProfile(userId: string, role: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { loginId: true, status: true },
    });

    const base = {
      id: userId,
      loginId: user?.loginId ?? null,
      role,
      status: user?.status ?? null,
    };

    if (role === 'COLLECTOR') {
      const collector = await this.prisma.collector.findUnique({
        where: { userId },
        select: { qrToken: true },
      });

      return {
        ...base,
        qrToken: collector?.qrToken ?? null,
      };
    }

    return base;
  }
}
