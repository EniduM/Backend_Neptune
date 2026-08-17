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
