import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';

type MockPrisma = {
  user: {
    findUnique: jest.Mock;
  };
  collector: {
    findUnique: jest.Mock;
  };
};

describe('AuthService', () => {
  let service: AuthService;
  let prisma: MockPrisma;
  let jwtService: JwtService;

  beforeEach(() => {
    prisma = {
      user: { findUnique: jest.fn() },
      collector: { findUnique: jest.fn() },
    };

    jwtService = {
      signAsync: jest.fn().mockResolvedValue('mock-jwt-token'),
    } as never;

    service = new AuthService(prisma as never, jwtService);
  });

  describe('login', () => {
    it('should return accessToken and user on valid credentials', async () => {
      const argon2 = require('argon2');
      const hash = await argon2.hash('password123');

      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        loginId: 'ADMIN001',
        passwordHash: hash,
        role: 'ADMIN',
        status: 'ACTIVE',
      });

      const result = await service.login('ADMIN001', 'password123');

      expect(result).toHaveProperty('accessToken', 'mock-jwt-token');
      expect(result.user).toEqual({
        id: 'user-1',
        loginId: 'ADMIN001',
        role: 'ADMIN',
        status: 'ACTIVE',
      });
      expect(jwtService.signAsync).toHaveBeenCalledWith({
        sub: 'user-1',
        loginId: 'ADMIN001',
        role: 'ADMIN',
      });
    });

    it('should throw UnauthorizedException for non-existent user', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.login('NONEXISTENT', 'password123'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for INACTIVE user', async () => {
      const argon2 = require('argon2');
      const hash = await argon2.hash('password123');

      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        loginId: 'INACTIVE_USER',
        passwordHash: hash,
        role: 'COLLECTOR',
        status: 'INACTIVE',
      });

      await expect(
        service.login('INACTIVE_USER', 'password123'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for wrong password', async () => {
      const argon2 = require('argon2');
      const hash = await argon2.hash('correctpassword');

      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        loginId: 'ADMIN001',
        passwordHash: hash,
        role: 'ADMIN',
        status: 'ACTIVE',
      });

      await expect(
        service.login('ADMIN001', 'wrongpassword'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('getProfile', () => {
    it('should return profile with qrToken for COLLECTOR role', async () => {
      prisma.user.findUnique.mockResolvedValue({
        loginId: 'COL001',
        status: 'ACTIVE',
      });
      prisma.collector.findUnique.mockResolvedValue({
        qrToken: 'QR-TOKEN-123',
      });

      const result = await service.getProfile('user-1', 'COLLECTOR');

      expect(result).toEqual({
        id: 'user-1',
        loginId: 'COL001',
        role: 'COLLECTOR',
        status: 'ACTIVE',
        qrToken: 'QR-TOKEN-123',
      });
    });

    it('should return profile without qrToken for ADMIN role', async () => {
      prisma.user.findUnique.mockResolvedValue({
        loginId: 'ADMIN001',
        status: 'ACTIVE',
      });

      const result = await service.getProfile('user-1', 'ADMIN');

      expect(result).toEqual({
        id: 'user-1',
        loginId: 'ADMIN001',
        role: 'ADMIN',
        status: 'ACTIVE',
      });
      expect(result).not.toHaveProperty('qrToken');
    });

    it('should return profile without qrToken for RIDER role', async () => {
      prisma.user.findUnique.mockResolvedValue({
        loginId: 'RIDER001',
        status: 'ACTIVE',
      });

      const result = await service.getProfile('user-1', 'RIDER');

      expect(result).toEqual({
        id: 'user-1',
        loginId: 'RIDER001',
        role: 'RIDER',
        status: 'ACTIVE',
      });
      expect(result).not.toHaveProperty('qrToken');
    });
  });
});
