import { ConflictException, NotFoundException } from '@nestjs/common';
import { AdminService } from './admin.service';

type MockPrisma = {
  collector: {
    findMany: jest.Mock;
    findUnique: jest.Mock;
  };
  collection: {
    groupBy: jest.Mock;
  };
};

describe('AdminService – getLeaderboard', () => {
  let service: AdminService;
  let prisma: MockPrisma;

  beforeEach(() => {
    prisma = {
      collector: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
      },
      collection: {
        groupBy: jest.fn(),
      },
    };

    service = new AdminService(prisma as never);
  });

  it('returns all-time leaderboard when period is omitted', async () => {
    prisma.collection.groupBy.mockResolvedValue([
      {
        collectorId: 'c1',
        _count: { collectorId: 3 },
        _sum: { weightKg: { toString: () => '120.00' } },
      },
      {
        collectorId: 'c2',
        _count: { collectorId: 1 },
        _sum: { weightKg: { toString: () => '45.50' } },
      },
    ]);
    prisma.collector.findMany.mockResolvedValue([
      { id: 'c1', fullName: 'Alice' },
      { id: 'c2', fullName: 'Bob' },
    ]);

    const result = await service.getLeaderboard();

    expect(prisma.collection.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({ where: undefined }),
    );
    expect(result).toEqual([
      {
        collectorId: 'c1',
        fullName: 'Alice',
        totalWeightKg: 120,
        totalCollections: 3,
        rank: 1,
      },
      {
        collectorId: 'c2',
        fullName: 'Bob',
        totalWeightKg: 45.5,
        totalCollections: 1,
        rank: 2,
      },
    ]);
  });

  it('returns all-time leaderboard when period=all', async () => {
    prisma.collection.groupBy.mockResolvedValue([]);
    prisma.collector.findMany.mockResolvedValue([]);

    await service.getLeaderboard('all');

    expect(prisma.collection.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({ where: undefined }),
    );
  });

  it('filters to current month when period=month', async () => {
    const now = new Date();
    const expectedSince = new Date(now.getFullYear(), now.getMonth(), 1);

    prisma.collection.groupBy.mockResolvedValue([]);
    prisma.collector.findMany.mockResolvedValue([]);

    await service.getLeaderboard('month');

    expect(prisma.collection.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { collectedAt: { gte: expectedSince } },
      }),
    );
  });

  it('returns empty array when no collections exist', async () => {
    prisma.collection.groupBy.mockResolvedValue([]);

    const result = await service.getLeaderboard();

    expect(result).toEqual([]);
    expect(prisma.collector.findMany).not.toHaveBeenCalled();
  });

  it('falls back to Unknown Collector for missing collector records', async () => {
    prisma.collection.groupBy.mockResolvedValue([
      {
        collectorId: 'orphan',
        _count: { collectorId: 1 },
        _sum: { weightKg: { toString: () => '10' } },
      },
    ]);
    prisma.collector.findMany.mockResolvedValue([]);

    const result = await service.getLeaderboard();

    expect(result[0].fullName).toBe('Unknown Collector');
  });

  it('breaks ties by totalCollections then collectorId', async () => {
    prisma.collection.groupBy.mockResolvedValue([
      {
        collectorId: 'c-b',
        _count: { collectorId: 2 },
        _sum: { weightKg: { toString: () => '50' } },
      },
      {
        collectorId: 'c-a',
        _count: { collectorId: 3 },
        _sum: { weightKg: { toString: () => '50' } },
      },
    ]);
    prisma.collector.findMany.mockResolvedValue([
      { id: 'c-a', fullName: 'Alpha' },
      { id: 'c-b', fullName: 'Beta' },
    ]);

    const result = await service.getLeaderboard();

    expect(result[0].collectorId).toBe('c-a');
    expect(result[0].rank).toBe(1);
    expect(result[1].collectorId).toBe('c-b');
    expect(result[1].rank).toBe(2);
  });
});

describe('AdminService – vehicle assignment', () => {
  let service: AdminService;
  let prisma: {
    vehicle: { findUnique: jest.Mock };
    rider: { findFirst: jest.Mock; findUnique: jest.Mock };
    user: { create: jest.Mock };
    $transaction: jest.Mock;
  };

  beforeEach(() => {
    prisma = {
      vehicle: { findUnique: jest.fn() },
      rider: { findFirst: jest.fn(), findUnique: jest.fn() },
      user: { create: jest.fn() },
      $transaction: jest.fn(),
    };
    service = new AdminService(prisma as never);
  });

  it('rejects assigning a nonexistent vehicle with 404', async () => {
    prisma.vehicle.findUnique.mockResolvedValue(null);

    await expect(
      service.updateRider('r1', { vehicleId: 'missing' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects assigning an inactive vehicle with 409', async () => {
    prisma.rider.findUnique.mockResolvedValue({ id: 'r1', userId: 'u1' });
    prisma.vehicle.findUnique.mockResolvedValue({
      id: 'v1',
      status: 'INACTIVE',
    });

    await expect(
      service.updateRider('r1', { vehicleId: 'v1' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects assigning a vehicle already owned by another rider with 409', async () => {
    prisma.rider.findUnique.mockResolvedValue({ id: 'r1', userId: 'u1' });
    prisma.vehicle.findUnique.mockResolvedValue({ id: 'v1', status: 'ACTIVE' });
    prisma.rider.findFirst.mockResolvedValue({ id: 'r2' });

    await expect(
      service.updateRider('r1', { vehicleId: 'v1' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('allows a rider to keep their own already-assigned vehicle', async () => {
    prisma.vehicle.findUnique.mockResolvedValue({ id: 'v1', status: 'ACTIVE' });
    prisma.rider.findFirst.mockResolvedValue(null);
    prisma.rider.findUnique.mockResolvedValue({ id: 'r1', userId: 'u1' });
    prisma.rider.update = jest.fn().mockResolvedValue({ id: 'r1' });

    const result = await service.updateRider('r1', { vehicleId: 'v1' });

    expect(prisma.rider.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          vehicle: { connect: { id: 'v1' } },
        }),
      }),
    );
    expect(result).toEqual({ id: 'r1' });
  });

  it('removes the assigned vehicle when vehicleId is null', async () => {
    prisma.rider.findUnique.mockResolvedValue({ id: 'r1', userId: 'u1' });
    prisma.rider.update = jest.fn().mockResolvedValue({ id: 'r1' });

    const result = await service.updateRider('r1', { vehicleId: null });

    expect(prisma.vehicle.findUnique).not.toHaveBeenCalled();
    expect(prisma.rider.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ vehicle: { disconnect: true } }),
      }),
    );
    expect(result).toEqual({ id: 'r1' });
  });
});
