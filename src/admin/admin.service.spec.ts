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

describe('AdminService – delete operations (cascade)', () => {
  let service: AdminService;
  let prisma: {
    collector: { findUnique: jest.Mock };
    rider: { findUnique: jest.Mock; delete: jest.Mock };
    vehicle: { findUnique: jest.Mock; delete: jest.Mock };
    collectionRequest: { findMany: jest.Mock; deleteMany: jest.Mock };
    collection: { deleteMany: jest.Mock };
    dailyAssignment: { deleteMany: jest.Mock };
    user: { delete: jest.Mock };
    $transaction: jest.Mock;
  };

  beforeEach(() => {
    prisma = {
      collector: { findUnique: jest.fn() },
      rider: { findUnique: jest.fn(), delete: jest.fn() },
      vehicle: { findUnique: jest.fn(), delete: jest.fn() },
      collectionRequest: { findMany: jest.fn(), deleteMany: jest.fn() },
      collection: { deleteMany: jest.fn() },
      dailyAssignment: { deleteMany: jest.fn() },
      user: { delete: jest.fn() },
      $transaction: jest.fn(),
    };
    prisma.$transaction.mockImplementation(
      async (callback: (tx: typeof prisma) => Promise<unknown>) =>
        callback(prisma),
    );
    service = new AdminService(prisma as never);
  });

  describe('deleteCollector', () => {
    it('returns 404 when the collector does not exist', async () => {
      prisma.collector.findUnique.mockResolvedValue(null);

      await expect(service.deleteCollector('missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('cascades collections, requests and assignments, then deletes the user', async () => {
      prisma.collector.findUnique.mockResolvedValue({
        id: 'c1',
        userId: 'u1',
      });
      prisma.collectionRequest.findMany.mockResolvedValue([
        { id: 'cr1' },
        { id: 'cr2' },
      ]);
      prisma.collection.deleteMany.mockResolvedValue({ count: 2 });
      prisma.collectionRequest.deleteMany.mockResolvedValue({ count: 2 });
      prisma.dailyAssignment.deleteMany.mockResolvedValue({ count: 1 });
      prisma.user.delete.mockResolvedValue({ id: 'u1' });

      const result = await service.deleteCollector('c1');

      expect(prisma.collection.deleteMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { collectorId: 'c1' },
            { collectionRequestId: { in: ['cr1', 'cr2'] } },
          ],
        },
      });
      expect(prisma.collectionRequest.deleteMany).toHaveBeenCalledWith({
        where: { collectorId: 'c1' },
      });
      expect(prisma.dailyAssignment.deleteMany).toHaveBeenCalledWith({
        where: { collectorId: 'c1' },
      });
      expect(prisma.user.delete).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'u1' } }),
      );
      expect(result).toEqual({ id: 'u1' });
    });

    it('skips the request-id OR arm when the collector has no requests', async () => {
      prisma.collector.findUnique.mockResolvedValue({
        id: 'c1',
        userId: 'u1',
      });
      prisma.collectionRequest.findMany.mockResolvedValue([]);
      prisma.collection.deleteMany.mockResolvedValue({ count: 0 });
      prisma.collectionRequest.deleteMany.mockResolvedValue({ count: 0 });
      prisma.dailyAssignment.deleteMany.mockResolvedValue({ count: 0 });
      prisma.user.delete.mockResolvedValue({ id: 'u1' });

      await service.deleteCollector('c1');

      expect(prisma.collection.deleteMany).toHaveBeenCalledWith({
        where: { OR: [{ collectorId: 'c1' }] },
      });
    });
  });

  describe('deleteRider', () => {
    it('returns 404 when the rider does not exist', async () => {
      prisma.rider.findUnique.mockResolvedValue(null);

      await expect(service.deleteRider('missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('cascades collections and requests, then deletes the rider without touching vehicles', async () => {
      prisma.rider.findUnique.mockResolvedValue({ id: 'r1', userId: 'u1' });
      prisma.collectionRequest.findMany.mockResolvedValue([{ id: 'cr3' }]);
      prisma.collection.deleteMany.mockResolvedValue({ count: 1 });
      prisma.collectionRequest.deleteMany.mockResolvedValue({ count: 1 });
      prisma.rider.delete.mockResolvedValue({ id: 'r1' });

      const result = await service.deleteRider('r1');

      expect(prisma.collection.deleteMany).toHaveBeenCalledWith({
        where: {
          OR: [{ riderId: 'r1' }, { collectionRequestId: { in: ['cr3'] } }],
        },
      });
      expect(prisma.collectionRequest.deleteMany).toHaveBeenCalledWith({
        where: { riderId: 'r1' },
      });
      expect(prisma.rider.delete).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'r1' } }),
      );
      expect(prisma.vehicle.delete).not.toHaveBeenCalled();
      expect(result).toEqual({ id: 'r1' });
    });
  });

  describe('deleteVehicle', () => {
    it('returns 404 when the vehicle does not exist', async () => {
      prisma.vehicle.findUnique.mockResolvedValue(null);

      await expect(service.deleteVehicle('missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('cascades referencing collections, then deletes the vehicle without touching riders', async () => {
      prisma.vehicle.findUnique.mockResolvedValue({ id: 'v1' });
      prisma.collection.deleteMany.mockResolvedValue({ count: 3 });
      prisma.vehicle.delete.mockResolvedValue({ id: 'v1' });

      const result = await service.deleteVehicle('v1');

      expect(prisma.collection.deleteMany).toHaveBeenCalledWith({
        where: { vehicleId: 'v1' },
      });
      expect(prisma.vehicle.delete).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'v1' } }),
      );
      expect(prisma.rider.delete).not.toHaveBeenCalled();
      expect(result).toEqual({ id: 'v1' });
    });
  });
});

describe('AdminService – collections admin view', () => {
  let service: AdminService;
  let prisma: {
    collection: { findMany: jest.Mock; findUnique: jest.Mock };
  };

  beforeEach(() => {
    prisma = {
      collection: { findMany: jest.fn(), findUnique: jest.fn() },
    };
    service = new AdminService(prisma as never);
  });

  it('lists collections with the weight converted to a number', async () => {
    prisma.collection.findMany.mockResolvedValue([
      {
        id: 'col1',
        collectionRequestId: 'cr1',
        weightKg: { toString: () => '15.00' },
        collectedAt: new Date('2026-08-10T05:00:00.000Z'),
      },
    ]);

    const result = await service.findAllCollections();

    expect(prisma.collection.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { collectedAt: 'desc' } }),
    );
    expect(result[0].weightKg).toBe(15);
  });

  it('returns 404 for a missing collection', async () => {
    prisma.collection.findUnique.mockResolvedValue(null);

    await expect(service.findCollection('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('returns a single collection with weight as a number', async () => {
    prisma.collection.findUnique.mockResolvedValue({
      id: 'col1',
      collectionRequestId: 'cr1',
      weightKg: { toString: () => '22.50' },
      collectedAt: new Date('2026-08-10T05:00:00.000Z'),
    });

    const result = await service.findCollection('col1');

    expect(result.id).toBe('col1');
    expect(result.weightKg).toBe(22.5);
  });
});
