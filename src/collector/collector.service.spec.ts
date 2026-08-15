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

    service = new CollectorService(prisma as never);
  });

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

  it('ranks collectors by completed weight across the requested period', async () => {
    prisma.collection.groupBy.mockResolvedValue([
      {
        collectorId: 'collector-1',
        _count: { collectorId: 2 },
        _sum: { weightKg: { toString: () => '75.50' } },
      },
      {
        collectorId: 'collector-2',
        _count: { collectorId: 1 },
        _sum: { weightKg: { toString: () => '30.00' } },
      },
    ]);
    prisma.collector.findMany.mockResolvedValue([
      { id: 'collector-1', fullName: 'Jane Collector' },
      { id: 'collector-2', fullName: 'John Collector' },
    ]);

    const result = await service.getLeaderboard('user-1', 'all');

    expect(result).toEqual([
      {
        collectorId: 'collector-1',
        fullName: 'Jane Collector',
        totalWeightKg: 75.5,
        totalCollections: 2,
        rank: 1,
      },
      {
        collectorId: 'collector-2',
        fullName: 'John Collector',
        totalWeightKg: 30,
        totalCollections: 1,
        rank: 2,
      },
    ]);
  });
});
