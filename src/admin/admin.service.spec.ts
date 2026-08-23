import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { AdminService } from './admin.service';

describe('AdminService – dashboard statistics', () => {
  let service: AdminService;
  let prisma: {
    collection: { count: jest.Mock; aggregate: jest.Mock };
    collector: { count: jest.Mock };
    rider: { count: jest.Mock };
    vehicle: { count: jest.Mock };
    collectionRequest: { count: jest.Mock };
  };

  beforeEach(() => {
    prisma = {
      collection: { count: jest.fn(), aggregate: jest.fn() },
      collector: { count: jest.fn() },
      rider: { count: jest.fn() },
      vehicle: { count: jest.fn() },
      collectionRequest: { count: jest.fn() },
    };
    service = new AdminService(prisma as never);
  });

  it('returns the live dashboard statistics, including totalCollectedWeightKg', async () => {
    prisma.collection.count.mockResolvedValue(8);
    prisma.collector.count.mockResolvedValue(14);
    prisma.rider.count.mockResolvedValue(2);
    prisma.vehicle.count.mockResolvedValue(1);
    prisma.collectionRequest.count.mockResolvedValue(1);
    prisma.collection.aggregate.mockResolvedValue({
      _sum: { weightKg: { toString: () => '125.6' } },
    });

    const result = await service.getDashboardStatistics();

    expect(prisma.collection.count).toHaveBeenCalledTimes(1);
    expect(prisma.collector.count).toHaveBeenCalledTimes(1);
    expect(prisma.rider.count).toHaveBeenCalledTimes(1);
    expect(prisma.vehicle.count).toHaveBeenCalledWith({
      where: { status: 'ACTIVE' },
    });
    expect(prisma.collectionRequest.count).toHaveBeenCalledWith({
      where: { status: 'PENDING' },
    });
    expect(prisma.collection.aggregate).toHaveBeenCalledWith({
      _sum: { weightKg: true },
      where: { collectionRequest: { status: 'COMPLETED' } },
    });
    expect(result).toEqual({
      totalCollections: 8,
      totalCollectors: 14,
      totalRiders: 2,
      activeVehicles: 1,
      pendingRequests: 1,
      totalCollectedWeightKg: 125.6,
    });
  });

  it('returns 0 totalCollectedWeightKg when there are no completed collections', async () => {
    prisma.collection.count.mockResolvedValue(0);
    prisma.collector.count.mockResolvedValue(14);
    prisma.rider.count.mockResolvedValue(2);
    prisma.vehicle.count.mockResolvedValue(1);
    prisma.collectionRequest.count.mockResolvedValue(0);
    prisma.collection.aggregate.mockResolvedValue({
      _sum: { weightKg: null },
    });

    const result = await service.getDashboardStatistics();
    expect(result.totalCollectedWeightKg).toBe(0);
  });

  it('reflects database changes in the count', async () => {
    prisma.collection.count.mockResolvedValueOnce(25).mockResolvedValueOnce(26);
    prisma.collector.count.mockResolvedValue(14);
    prisma.rider.count.mockResolvedValue(2);
    prisma.vehicle.count.mockResolvedValue(1);
    prisma.collectionRequest.count.mockResolvedValue(1);
    prisma.collection.aggregate.mockResolvedValue({
      _sum: { weightKg: { toString: () => '0' } },
    });

    expect((await service.getDashboardStatistics()).totalCollections).toBe(25);
    expect((await service.getDashboardStatistics()).totalCollections).toBe(26);
  });
});

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

  it('filters to exact UTC day when period=date', async () => {
    prisma.collection.groupBy.mockResolvedValue([]);
    prisma.collector.findMany.mockResolvedValue([]);

    await service.getLeaderboard('date', '2026-08-19');

    expect(prisma.collection.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          collectedAt: {
            gte: new Date('2026-08-19T00:00:00.000Z'),
            lt: new Date('2026-08-20T00:00:00.000Z'),
          },
        },
      }),
    );
  });

  it('rejects period=date without a date', async () => {
    await expect(service.getLeaderboard('date')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.collection.groupBy).not.toHaveBeenCalled();
  });

  it('rejects malformed dates', async () => {
    await expect(
      service.getLeaderboard('date', '19-08-2026'),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.getLeaderboard('date', '2026/08/19'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects invalid calendar dates', async () => {
    await expect(
      service.getLeaderboard('date', '2026-13-40'),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.getLeaderboard('date', '2026-02-30'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('returns an empty leaderboard for a date with no collections', async () => {
    prisma.collection.groupBy.mockResolvedValue([]);

    const result = await service.getLeaderboard('date', '2026-08-19');

    expect(result).toEqual({ date: '2026-08-19', data: [] });
    expect(prisma.collector.findMany).not.toHaveBeenCalled();
  });

  it('filters by date when date param is sent without period=date', async () => {
    prisma.collection.groupBy.mockResolvedValue([]);

    await service.getLeaderboard(undefined, '2026-08-24');

    expect(prisma.collection.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          collectedAt: {
            gte: new Date('2026-08-24T00:00:00.000Z'),
            lt: new Date('2026-08-25T00:00:00.000Z'),
          },
        },
      }),
    );
  });

  it('returns wrapped {date, data} when date is provided', async () => {
    prisma.collection.groupBy.mockResolvedValue([
      {
        collectorId: 'c1',
        _count: { collectorId: 1 },
        _sum: { weightKg: { toString: () => '5' } },
      },
    ]);
    prisma.collector.findMany.mockResolvedValue([
      { id: 'c1', fullName: 'Alice' },
    ]);

    const result = await service.getLeaderboard(undefined, '2026-08-24');

    expect(result).toEqual({
      date: '2026-08-24',
      data: [
        {
          collectorId: 'c1',
          fullName: 'Alice',
          totalWeightKg: 5,
          totalCollections: 1,
          rank: 1,
        },
      ],
    });
  });

  it('does not return all-time data when date param is a future date with no records', async () => {
    prisma.collection.groupBy.mockResolvedValue([]);

    const result = await service.getLeaderboard(undefined, '2099-12-31');

    expect(result).toEqual({ date: '2099-12-31', data: [] });
    expect(prisma.collection.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          collectedAt: {
            gte: new Date('2099-12-31T00:00:00.000Z'),
            lt: new Date('2100-01-01T00:00:00.000Z'),
          },
        },
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
    prisma.$transaction.mockImplementation(
      async (callback: (tx: typeof prisma) => Promise<unknown>) =>
        callback(prisma),
    );
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

  it('allows a vehicle already assigned to another rider to be shared', async () => {
    prisma.rider.findUnique.mockResolvedValue({ id: 'r1', userId: 'u1' });
    prisma.vehicle.findUnique.mockResolvedValue({ id: 'v1', status: 'ACTIVE' });
    prisma.rider.update = jest.fn().mockResolvedValue({ id: 'r1' });

    const result = await service.updateRider('r1', { vehicleId: 'v1' });

    expect(prisma.rider.findFirst).not.toHaveBeenCalled();
    expect(prisma.rider.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          vehicle: { connect: { id: 'v1' } },
        }),
      }),
    );
    expect(result).toEqual({ id: 'r1' });
  });

  it('creates a rider with a vehicle shared with another rider', async () => {
    prisma.vehicle.findUnique.mockResolvedValue({ id: 'v1', status: 'ACTIVE' });
    prisma.user.create.mockResolvedValue({ id: 'r2' });

    const dto: CreateRiderDto = {
      loginId: 'r2',
      password: 'password',
      fullName: 'Rider Two',
      nic: '200012345678',
      mobile: '0777777222',
      address: 'Addr',
      vehicleId: 'v1',
    };

    const result = await service.createRider(dto);

    expect(prisma.rider.findFirst).not.toHaveBeenCalled();
    expect(prisma.user.create).toHaveBeenCalled();
    expect(result).toEqual({ id: 'r2' });
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
    collectionRequest: {
      findMany: jest.Mock;
      deleteMany: jest.Mock;
      findUnique: jest.Mock;
      delete: jest.Mock;
    };
    collection: { deleteMany: jest.Mock; update: jest.Mock };
    dailyAssignment: { deleteMany: jest.Mock };
    user: { delete: jest.Mock };
    $transaction: jest.Mock;
  };

  beforeEach(() => {
    prisma = {
      collector: { findUnique: jest.fn() },
      rider: { findUnique: jest.fn(), delete: jest.fn() },
      vehicle: { findUnique: jest.fn(), delete: jest.fn() },
      collectionRequest: {
        findMany: jest.fn(),
        deleteMany: jest.fn(),
        findUnique: jest.fn(),
        delete: jest.fn(),
      },
      collection: { deleteMany: jest.fn(), update: jest.fn() },
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

  describe('deleteCollectionRequest', () => {
    it('returns 404 when the collection request does not exist', async () => {
      prisma.collectionRequest.findUnique.mockResolvedValue(null);

      await expect(
        service.deleteCollectionRequest('missing'),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.collectionRequest.delete).not.toHaveBeenCalled();
    });

    it('detaches the related collection and deletes the request, preserving the collection', async () => {
      prisma.collectionRequest.findUnique.mockResolvedValue({
        id: 'cr1',
        collection: { id: 'col1' },
      });
      prisma.collection.update.mockResolvedValue({
        id: 'col1',
        collectionRequestId: null,
      });
      prisma.collectionRequest.delete.mockResolvedValue({ id: 'cr1' });

      const result = await service.deleteCollectionRequest('cr1');

      expect(prisma.collection.update).toHaveBeenCalledWith({
        where: { id: 'col1' },
        data: { collectionRequestId: null },
      });
      expect(prisma.collectionRequest.delete).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'cr1' } }),
      );
      expect(prisma.collection.deleteMany).not.toHaveBeenCalled();
      expect(result).toEqual({ id: 'cr1' });
    });

    it('deletes a request with no related collection data', async () => {
      prisma.collectionRequest.findUnique.mockResolvedValue({
        id: 'cr1',
        collection: null,
      });
      prisma.collectionRequest.delete.mockResolvedValue({ id: 'cr1' });

      const result = await service.deleteCollectionRequest('cr1');

      expect(prisma.collectionRequest.delete).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'cr1' } }),
      );
      expect(prisma.collection.deleteMany).not.toHaveBeenCalled();
      expect(result).toEqual({ id: 'cr1' });
    });

    it('rolls back safely when detaching the collection fails', async () => {
      prisma.collectionRequest.findUnique.mockResolvedValue({
        id: 'cr1',
        collection: { id: 'col1' },
      });
      prisma.collection.update.mockRejectedValue(new Error('db down'));

      await expect(
        service.deleteCollectionRequest('cr1'),
      ).rejects.toThrow('db down');
      expect(prisma.collectionRequest.delete).not.toHaveBeenCalled();
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

describe('AdminService – university CRUD', () => {
  let service: AdminService;
  let prisma: {
    university: {
      create: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
    collector: { count: jest.Mock };
  };

  beforeEach(() => {
    prisma = {
      university: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      collector: { count: jest.fn() },
    };
    service = new AdminService(prisma as never);
  });

  it('creates a university', async () => {
    prisma.university.create.mockResolvedValue({
      id: 'u1',
      name: 'AIBT',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await service.createUniversity({ name: 'AIBT' });
    expect(result.name).toBe('AIBT');
    expect(prisma.university.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: { name: 'AIBT' } }),
    );
  });

  it('trims whitespace from university name', async () => {
    prisma.university.create.mockResolvedValue({
      id: 'u1',
      name: 'Peradeniya',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await service.createUniversity({ name: '  Peradeniya  ' });
    expect(prisma.university.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: { name: 'Peradeniya' } }),
    );
  });

  it('throws ConflictException for duplicate university name', async () => {
    const error = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
      code: 'P2002',
      clientVersion: '0.0.0',
      meta: { target: ['name'] },
    });
    prisma.university.create.mockRejectedValue(error);

    await expect(
      service.createUniversity({ name: 'AIBT' }),
    ).rejects.toThrow(ConflictException);
  });

  it('lists all universities sorted by name', async () => {
    prisma.university.findMany.mockResolvedValue([]);
    await service.findAllUniversities();
    expect(prisma.university.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { name: 'asc' } }),
    );
  });

  it('finds a university by id', async () => {
    prisma.university.findUnique.mockResolvedValue({
      id: 'u1',
      name: 'AIBT',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const result = await service.findUniversity('u1');
    expect(result.id).toBe('u1');
  });

  it('throws NotFoundException for missing university', async () => {
    prisma.university.findUnique.mockResolvedValue(null);
    await expect(service.findUniversity('missing')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('updates a university', async () => {
    prisma.university.findUnique.mockResolvedValue({ id: 'u1' });
    prisma.university.update.mockResolvedValue({
      id: 'u1',
      name: 'AIBT Updated',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await service.updateUniversity('u1', {
      name: 'AIBT Updated',
    });
    expect(result.name).toBe('AIBT Updated');
  });

  it('deletes a university with no linked collectors', async () => {
    prisma.university.findUnique.mockResolvedValue({ id: 'u1' });
    prisma.collector.count.mockResolvedValue(0);
    prisma.university.delete.mockResolvedValue({
      id: 'u1',
      name: 'AIBT',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await service.deleteUniversity('u1');
    expect(result.id).toBe('u1');
  });

  it('throws ConflictException when deleting university linked to collectors', async () => {
    prisma.university.findUnique.mockResolvedValue({ id: 'u1' });
    prisma.collector.count.mockResolvedValue(5);

    await expect(service.deleteUniversity('u1')).rejects.toThrow(
      ConflictException,
    );
  });
});

describe('AdminService – university distribution', () => {
  let service: AdminService;
  let prisma: {
    collection: { findMany: jest.Mock };
    university: { findMany: jest.Mock };
  };

  beforeEach(() => {
    prisma = {
      collection: { findMany: jest.fn() },
      university: { findMany: jest.fn() },
    };
    service = new AdminService(prisma as never);
  });

  it('throws BadRequestException when date is missing', async () => {
    await expect(
      service.getUniversityDistribution(undefined as never),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws BadRequestException for invalid date format', async () => {
    await expect(
      service.getUniversityDistribution('not-a-date'),
    ).rejects.toThrow(BadRequestException);
  });

  it('returns empty distribution when no collections exist for the date', async () => {
    prisma.collection.findMany.mockResolvedValue([]);

    const result = await service.getUniversityDistribution('2026-08-23');
    expect(result).toEqual({
      date: '2026-08-23',
      total: 0,
      distribution: [],
    });
  });

  it('calculates distribution grouped by university', async () => {
    prisma.collection.findMany.mockResolvedValue([
      { collector: { universityId: 'u1' } },
      { collector: { universityId: 'u1' } },
      { collector: { universityId: 'u2' } },
      { collector: { universityId: null } },
    ]);
    prisma.university.findMany.mockResolvedValue([
      { id: 'u1', name: 'AIBT' },
      { id: 'u2', name: 'Peradeniya' },
    ]);

    const result = await service.getUniversityDistribution('2026-08-23');
    expect(result.total).toBe(4);
    expect(result.distribution).toHaveLength(3);
    expect(result.distribution[0]).toEqual({
      universityId: 'u1',
      universityName: 'AIBT',
      count: 2,
      percentage: 50,
    });
    expect(result.distribution[1]).toEqual({
      universityId: 'u2',
      universityName: 'Peradeniya',
      count: 1,
      percentage: 25,
    });
    expect(result.distribution[2]).toEqual({
      universityId: null,
      universityName: 'Unassigned',
      count: 1,
      percentage: 25,
    });
  });
});
