import { UnauthorizedException } from '@nestjs/common';
import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let prisma: { user: { findUnique: jest.Mock } };

  beforeAll(() => {
    process.env.JWT_SECRET = 'test-secret';
  });

  beforeEach(() => {
    prisma = {
      user: {
        findUnique: jest.fn(),
      },
    };
    strategy = new JwtStrategy(prisma as never);
  });

  it('returns the user payload for an active account', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      loginId: 'CT01',
      role: 'COLLECTOR',
      status: 'ACTIVE',
    });

    await expect(
      strategy.validate({ sub: 'u1', loginId: 'CT01', role: 'COLLECTOR' }),
    ).resolves.toEqual({
      id: 'u1',
      loginId: 'CT01',
      role: 'COLLECTOR',
      status: 'ACTIVE',
    });
  });

  it('rejects a deactivated account even with a valid token', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      loginId: 'CT01',
      role: 'COLLECTOR',
      status: 'INACTIVE',
    });

    await expect(
      strategy.validate({ sub: 'u1', loginId: 'CT01', role: 'COLLECTOR' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects a user that no longer exists', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(
      strategy.validate({ sub: 'ghost', loginId: 'X', role: 'RIDER' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});