import { NotFoundException } from '@nestjs/common';
import { CollectorService } from './collector.service';

type MockPrisma = {
  collector: {
    findUnique: jest.Mock;
    findMany: jest.Mock;
  };
  collectionRequest: {
    findMany: jest.Mock;
  };
  collection: {
    groupBy: jest.Mock;
  };
};

describe('CollectorService', () => {
  let service: CollectorService;
  let prisma: MockPrisma;

  beforeEach(() => {
    prisma = {
      collector: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
      collectionRequest: {
        findMany: jest.fn(),
      },
      collection: {
        groupBy: jest.fn(),
      },
    };

    service = new CollectorService(prisma as never, {
      notifyAllRiders: jest.fn().mockResolvedValue(undefined),
      notifyRider: jest.fn().mockResolvedValue(undefined),
    } as never);
  });

  describe('getMe', () => {
    it('returns the collector profile with qrToken', async () => {
      prisma.collector.findUnique.mockResolvedValue({
        qrToken: 'QR-TOKEN-123',
      });

      const result = await service.getMe('user-1');

      expect(prisma.collector.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-1' },
          select: { qrToken: true },
        }),
      );
      expect(result).toEqual({
        id: 'user-1',
        role: 'COLLECTOR',
        qrToken: 'QR-TOKEN-123',
      });
    });

    it('throws NotFoundException when collector does not exist', async () => {
      prisma.collector.findUnique.mockResolvedValue(null);

      await expect(service.getMe('user-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findCollectionRequests', () => {
    it('returns collector request history in the contract expected by Flutter', async () => {
      prisma.collector.findUnique.mockResolvedValue({ id: 'collector-1' });
      prisma.collectionRequest.findMany.mockResolvedValue([
        {
          id: 'req-1',
          collectorId: 'collector-1',
          riderId: 'rider-1',
          latitude: { toString: () => '6.1234567' },
          longitude: { toString: () => '80.9876543' },
          status: 'PENDING',
          requestedAt: new Date('2026-08-15T10:00:00.000Z'),
          acceptedAt: null,
          completedAt: null,
          cancelledAt: null,
          createdAt: new Date('2026-08-15T09:00:00.000Z'),
          updatedAt: new Date('2026-08-15T09:00:00.000Z'),
          collector: {
            id: 'collector-1',
            fullName: 'Jane Collector',
            mobile: '+94770000001',
          },
          rider: {
            id: 'rider-1',
            fullName: 'Rider One',
            mobile: '+94770000002',
          },
        },
      ]);

      const result = await service.findCollectionRequests('user-1');

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 'req-1',
        collectorId: 'collector-1',
        riderId: 'rider-1',
        latitude: 6.1234567,
        longitude: 80.9876543,
        status: 'PENDING',
        collector: {
          id: 'collector-1',
          fullName: 'Jane Collector',
          mobile: '+94770000001',
        },
        rider: {
          id: 'rider-1',
          fullName: 'Rider One',
          mobile: '+94770000002',
        },
      });
      expect(typeof result[0].latitude).toBe('number');
      expect(typeof result[0].longitude).toBe('number');
    });
  });

  describe('getLeaderboard', () => {
    it('returns all-time leaderboard when period is omitted', async () => {
      prisma.collector.findUnique.mockResolvedValue({ id: 'collector-1' });
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

      const result = await service.getLeaderboard('user-1');

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
      prisma.collector.findUnique.mockResolvedValue({ id: 'collector-1' });
      prisma.collection.groupBy.mockResolvedValue([]);
      prisma.collector.findMany.mockResolvedValue([]);

      await service.getLeaderboard('user-1', 'all');

      expect(prisma.collection.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({ where: undefined }),
      );
    });

    it('filters to current month when period=month', async () => {
      prisma.collector.findUnique.mockResolvedValue({ id: 'collector-1' });
      const now = new Date();
      const expectedSince = new Date(now.getFullYear(), now.getMonth(), 1);

      prisma.collection.groupBy.mockResolvedValue([]);
      prisma.collector.findMany.mockResolvedValue([]);

      await service.getLeaderboard('user-1', 'month');

      expect(prisma.collection.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { collectedAt: { gte: expectedSince } },
        }),
      );
    });

    it('returns empty array when no collections exist', async () => {
      prisma.collector.findUnique.mockResolvedValue({ id: 'collector-1' });
      prisma.collection.groupBy.mockResolvedValue([]);

      const result = await service.getLeaderboard('user-1');

      expect(result).toEqual([]);
      expect(prisma.collector.findMany).not.toHaveBeenCalled();
    });

    it('falls back to Unknown Collector for missing collector records', async () => {
      prisma.collector.findUnique.mockResolvedValue({ id: 'collector-1' });
      prisma.collection.groupBy.mockResolvedValue([
        {
          collectorId: 'orphan',
          _count: { collectorId: 1 },
          _sum: { weightKg: { toString: () => '10' } },
        },
      ]);
      prisma.collector.findMany.mockResolvedValue([]);

      const result = await service.getLeaderboard('user-1');

      expect(result[0].fullName).toBe('Unknown Collector');
    });

    it('breaks ties by totalCollections then collectorId', async () => {
      prisma.collector.findUnique.mockResolvedValue({ id: 'collector-1' });
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

      const result = await service.getLeaderboard('user-1');

      expect(result[0].collectorId).toBe('c-a');
      expect(result[0].rank).toBe(1);
      expect(result[1].collectorId).toBe('c-b');
      expect(result[1].rank).toBe(2);
    });

    it('sums multiple collections for the same collector correctly', async () => {
      prisma.collector.findUnique.mockResolvedValue({ id: 'collector-1' });
      prisma.collection.groupBy.mockResolvedValue([
        {
          collectorId: 'c1',
          _count: { collectorId: 3 },
          _sum: { weightKg: { toString: () => '45.00' } },
        },
      ]);
      prisma.collector.findMany.mockResolvedValue([
        { id: 'c1', fullName: 'Alice' },
      ]);

      const result = await service.getLeaderboard('user-1');

      expect(result).toHaveLength(1);
      expect(result[0].totalWeightKg).toBe(45);
      expect(result[0].totalCollections).toBe(3);
      expect(result[0].rank).toBe(1);
    });

    it('excludes collections outside current month when period=month', async () => {
      prisma.collector.findUnique.mockResolvedValue({ id: 'collector-1' });

      const now = new Date();
      const expectedSince = new Date(now.getFullYear(), now.getMonth(), 1);

      prisma.collection.groupBy.mockResolvedValue([
        {
          collectorId: 'c1',
          _count: { collectorId: 1 },
          _sum: { weightKg: { toString: () => '20.00' } },
        },
      ]);
      prisma.collector.findMany.mockResolvedValue([
        { id: 'c1', fullName: 'Alice' },
      ]);

      const result = await service.getLeaderboard('user-1', 'month');

      expect(prisma.collection.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { collectedAt: { gte: expectedSince } },
        }),
      );
      expect(result).toHaveLength(1);
      expect(result[0].totalWeightKg).toBe(20);
    });

    it('throws NotFoundException when collector does not exist', async () => {
      prisma.collector.findUnique.mockResolvedValue(null);

      await expect(
        service.getLeaderboard('nonexistent-user', 'all'),
      ).rejects.toThrow(NotFoundException);
    });

    it('returns correct rank ordering when collector A > B > C by weight', async () => {
      prisma.collector.findUnique.mockResolvedValue({ id: 'collector-1' });
      prisma.collection.groupBy.mockResolvedValue([
        {
          collectorId: 'c-a',
          _count: { collectorId: 5 },
          _sum: { weightKg: { toString: () => '150.00' } },
        },
        {
          collectorId: 'c-b',
          _count: { collectorId: 3 },
          _sum: { weightKg: { toString: () => '100.00' } },
        },
        {
          collectorId: 'c-c',
          _count: { collectorId: 2 },
          _sum: { weightKg: { toString: () => '75.00' } },
        },
      ]);
      prisma.collector.findMany.mockResolvedValue([
        { id: 'c-a', fullName: 'Alice' },
        { id: 'c-b', fullName: 'Bob' },
        { id: 'c-c', fullName: 'Charlie' },
      ]);

      const result = await service.getLeaderboard('user-1', 'all');

      expect(result).toHaveLength(3);
      expect(result[0]).toMatchObject({
        collectorId: 'c-a',
        rank: 1,
        totalWeightKg: 150,
      });
      expect(result[1]).toMatchObject({
        collectorId: 'c-b',
        rank: 2,
        totalWeightKg: 100,
      });
      expect(result[2]).toMatchObject({
        collectorId: 'c-c',
        rank: 3,
        totalWeightKg: 75,
      });
    });

    it('exposes only safe fields (no qrToken, password, or private data)', async () => {
      prisma.collector.findUnique.mockResolvedValue({ id: 'collector-1' });
      prisma.collection.groupBy.mockResolvedValue([
        {
          collectorId: 'c1',
          _count: { collectorId: 1 },
          _sum: { weightKg: { toString: () => '10' } },
        },
      ]);
      prisma.collector.findMany.mockResolvedValue([
        { id: 'c1', fullName: 'Alice' },
      ]);

      const result = await service.getLeaderboard('user-1');

      const entry = result[0];
      expect(entry).toHaveProperty('collectorId');
      expect(entry).toHaveProperty('fullName');
      expect(entry).toHaveProperty('totalWeightKg');
      expect(entry).toHaveProperty('totalCollections');
      expect(entry).toHaveProperty('rank');
      expect(Object.keys(entry)).toEqual([
        'collectorId',
        'fullName',
        'totalWeightKg',
        'totalCollections',
        'rank',
      ]);
    });
  });
});
