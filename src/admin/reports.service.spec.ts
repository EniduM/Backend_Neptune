import { ReportsService } from './reports.service';

type DecimalLike = { toString(): string };

type MockPrisma = {
  collection: {
    findMany: jest.Mock;
    aggregate: jest.Mock;
    groupBy: jest.Mock;
  };
  collectionRequest: {
    findMany: jest.Mock;
    aggregate: jest.Mock;
    groupBy: jest.Mock;
  };
  collector: { findMany: jest.Mock };
  rider: { findMany: jest.Mock };
  vehicle: { findMany: jest.Mock };
  dailyAssignment: { findMany: jest.Mock };
};

const decimal = (value: string): DecimalLike => ({
  toString: () => value,
});

const DAY = (date: string) => new Date(`${date}T00:00:00.000Z`);

function createPrisma(): MockPrisma {
  return {
    collection: {
      findMany: jest.fn(),
      aggregate: jest.fn(),
      groupBy: jest.fn(),
    },
    collectionRequest: {
      findMany: jest.fn(),
      aggregate: jest.fn(),
      groupBy: jest.fn(),
    },
    collector: { findMany: jest.fn() },
    rider: { findMany: jest.fn() },
    vehicle: { findMany: jest.fn() },
    dailyAssignment: { findMany: jest.fn() },
  };
}

describe('ReportsService – collections report', () => {
  let service: ReportsService;
  let prisma: MockPrisma;

  beforeEach(() => {
    prisma = createPrisma();
    service = new ReportsService(prisma as never);
  });

  it('returns real rows and aggregates from the database', async () => {
    prisma.collection.findMany.mockResolvedValue([
      {
        id: 'col1',
        collectionRequestId: 'cr1',
        collectorId: 'c1',
        riderId: 'r1',
        vehicleId: 'v1',
        weightKg: decimal('12.50'),
        collectedAt: DAY('2026-08-10'),
        collector: { id: 'c1', fullName: 'Alice' },
        rider: { id: 'r1', fullName: 'Bob' },
        vehicle: { id: 'v1', vehicleCode: 'Tuk 1', vehicleType: 'Tuk' },
      },
    ]);
    prisma.collection.aggregate.mockResolvedValue({
      _count: 1,
      _sum: { weightKg: decimal('12.50') },
      _avg: { weightKg: decimal('12.50') },
    });

    const result = await service.getCollectionsReport({});

    expect(result.data[0].weightKg).toBe(12.5);
    expect(result.data[0].collectorId).toBe('c1');
    expect(result.data[0].riderId).toBe('r1');
    expect(result.data[0].vehicleId).toBe('v1');
    expect(result.summary).toEqual({
      totalCount: 1,
      totalWeightKg: 12.5,
      averageWeightKg: 12.5,
    });
  });

  it('filters collectedAt to the UTC day range using from/to', async () => {
    prisma.collection.findMany.mockResolvedValue([]);
    prisma.collection.aggregate.mockResolvedValue({
      _count: 0,
      _sum: { weightKg: null },
      _avg: { weightKg: null },
    });

    await service.getCollectionsReport({ from: '2026-08-01', to: '2026-08-02' });

    expect(prisma.collection.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          collectedAt: { gte: DAY('2026-08-01'), lt: DAY('2026-08-03') },
        },
      }),
    );
    expect(prisma.collection.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          collectedAt: { gte: DAY('2026-08-01'), lt: DAY('2026-08-03') },
        },
      }),
    );
  });

  it('filters by collector, rider and vehicle ids', async () => {
    prisma.collection.findMany.mockResolvedValue([]);
    prisma.collection.aggregate.mockResolvedValue({
      _count: 0,
      _sum: { weightKg: null },
      _avg: { weightKg: null },
    });

    await service.getCollectionsReport({
      collectorId: 'c1',
      riderId: 'r1',
      vehicleId: 'v1',
    });

    expect(prisma.collection.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { collectorId: 'c1', riderId: 'r1', vehicleId: 'v1' },
      }),
    );
  });

  it('returns zero summaries for an empty report', async () => {
    prisma.collection.findMany.mockResolvedValue([]);
    prisma.collection.aggregate.mockResolvedValue({
      _count: 0,
      _sum: { weightKg: null },
      _avg: { weightKg: null },
    });

    const result = await service.getCollectionsReport({});

    expect(result.data).toEqual([]);
    expect(result.summary).toEqual({
      totalCount: 0,
      totalWeightKg: 0,
      averageWeightKg: 0,
    });
  });
});

describe('ReportsService – collection requests report', () => {
  let service: ReportsService;
  let prisma: MockPrisma;

  beforeEach(() => {
    prisma = createPrisma();
    service = new ReportsService(prisma as never);
  });

  it('returns rows with status counts computed from real grouping', async () => {
    prisma.collectionRequest.findMany.mockResolvedValue([
      {
        id: 'cr1',
        latitude: decimal('6.927100'),
        longitude: decimal('79.861200'),
        status: 'COMPLETED',
        qrVerified: true,
        requestedAt: DAY('2026-08-01'),
        acceptedAt: DAY('2026-08-01'),
        completedAt: DAY('2026-08-01'),
        cancelledAt: null,
        collector: { id: 'c1', fullName: 'Alice', user: { loginId: 'COL1' } },
        rider: { id: 'r1', fullName: 'Bob', user: { loginId: 'RD1' } },
      },
    ]);
    prisma.collectionRequest.aggregate
      .mockResolvedValueOnce({ _count: 3 })
      .mockResolvedValueOnce({ _count: 2 });
    prisma.collectionRequest.groupBy.mockResolvedValue([
      { status: 'COMPLETED', _count: { _all: 2 } },
      { status: 'PENDING', _count: { _all: 1 } },
    ]);

    const result = await service.getCollectionRequestsReport({});

    expect(result.data[0].latitude).toBe(6.9271);
    expect(result.data[0].longitude).toBe(79.8612);
    expect(result.summary).toEqual({
      totalCount: 3,
      qrVerifiedCount: 2,
      statusCounts: {
        PENDING: 1,
        ACCEPTED: 0,
        COMPLETED: 2,
        CANCELLED: 0,
      },
    });
  });

  it('applies status, collector, rider and requestedAt filters', async () => {
    prisma.collectionRequest.findMany.mockResolvedValue([]);
    prisma.collectionRequest.aggregate
      .mockResolvedValueOnce({ _count: 0 })
      .mockResolvedValueOnce({ _count: 0 });
    prisma.collectionRequest.groupBy.mockResolvedValue([]);

    await service.getCollectionRequestsReport({
      status: 'CANCELLED',
      collectorId: 'c1',
      riderId: 'r1',
      from: '2026-07-01',
      to: '2026-07-31',
    });

    expect(prisma.collectionRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: 'CANCELLED',
          collectorId: 'c1',
          riderId: 'r1',
          requestedAt: { gte: DAY('2026-07-01'), lt: DAY('2026-08-01') },
        },
      }),
    );
  });

  it('returns zeroed counts for an empty report', async () => {
    prisma.collectionRequest.findMany.mockResolvedValue([]);
    prisma.collectionRequest.aggregate
      .mockResolvedValueOnce({ _count: 0 })
      .mockResolvedValueOnce({ _count: 0 });
    prisma.collectionRequest.groupBy.mockResolvedValue([]);

    const result = await service.getCollectionRequestsReport({});

    expect(result.data).toEqual([]);
    expect(result.summary.statusCounts).toEqual({
      PENDING: 0,
      ACCEPTED: 0,
      COMPLETED: 0,
      CANCELLED: 0,
    });
    expect(result.summary.totalCount).toBe(0);
  });
});

describe('ReportsService – collectors report', () => {
  let service: ReportsService;
  let prisma: MockPrisma;

  beforeEach(() => {
    prisma = createPrisma();
    service = new ReportsService(prisma as never);
  });

  it('merges real collection and request activity into each collector', async () => {
    prisma.collector.findMany.mockResolvedValue([
      {
        id: 'c1',
        fullName: 'Alice',
        nic: '1',
        mobile: '077',
        address: 'Kandy',
        createdAt: DAY('2026-07-01'),
        user: { loginId: 'COL1', status: 'ACTIVE' },
      },
      {
        id: 'c2',
        fullName: 'Bob',
        nic: '2',
        mobile: '078',
        address: 'Colombo',
        createdAt: DAY('2026-07-02'),
        user: { loginId: 'COL2', status: 'ACTIVE' },
      },
    ]);
    prisma.collection.groupBy.mockResolvedValue([
      {
        collectorId: 'c1',
        _count: { collectorId: 4 },
        _sum: { weightKg: decimal('80.00') },
      },
    ]);
    prisma.collectionRequest.groupBy
      .mockResolvedValueOnce([
        { collectorId: 'c1', _count: { collectorId: 6 } },
      ])
      .mockResolvedValueOnce([
        { collectorId: 'c1', _count: { collectorId: 5 } },
      ]);

    const result = await service.getCollectorsReport({});

    expect(result.data[0]).toEqual(
      expect.objectContaining({
        id: 'c1',
        createdAt: DAY('2026-07-01'),
        totalCollections: 4,
        totalWeightKg: 80,
        totalRequests: 6,
        completedRequests: 5,
      }),
    );
    expect(result.data[1]).toEqual(
      expect.objectContaining({
        id: 'c2',
        totalCollections: 0,
        totalWeightKg: 0,
        totalRequests: 0,
        completedRequests: 0,
      }),
    );
    expect(result.summary.totalCount).toBe(2);
  });

  it('filters collectors by user status', async () => {
    prisma.collector.findMany.mockResolvedValue([]);
    prisma.collection.groupBy.mockResolvedValue([]);
    prisma.collectionRequest.groupBy.mockResolvedValue([]).mockResolvedValue([]);

    await service.getCollectorsReport({ status: 'INACTIVE' });

    expect(prisma.collector.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { user: { status: 'INACTIVE' } } }),
    );
  });

  it('passes the date window into activity grouping', async () => {
    prisma.collector.findMany.mockResolvedValue([]);
    prisma.collection.groupBy.mockResolvedValue([]);
    prisma.collectionRequest.groupBy.mockResolvedValue([]).mockResolvedValue([]);

    await service.getCollectorsReport({ from: '2026-08-01', to: '2026-08-15' });

    expect(prisma.collection.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          collectedAt: { gte: DAY('2026-08-01'), lt: DAY('2026-08-16') },
        },
      }),
    );
    expect(prisma.collectionRequest.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          requestedAt: { gte: DAY('2026-08-01'), lt: DAY('2026-08-16') },
        },
      }),
    );
  });

  it('returns an empty report when no collectors exist', async () => {
    prisma.collector.findMany.mockResolvedValue([]);
    prisma.collection.groupBy.mockResolvedValue([]);
    prisma.collectionRequest.groupBy.mockResolvedValue([]).mockResolvedValue([]);

    const result = await service.getCollectorsReport({});

    expect(result.data).toEqual([]);
    expect(result.summary.totalCount).toBe(0);
  });
});

describe('ReportsService – riders report', () => {
  let service: ReportsService;
  let prisma: MockPrisma;

  beforeEach(() => {
    prisma = createPrisma();
    service = new ReportsService(prisma as never);
  });

  it('includes the assigned vehicle and merged activity', async () => {
    prisma.rider.findMany.mockResolvedValue([
      {
        id: 'r1',
        fullName: 'Bob',
        nic: '3',
        mobile: '079',
        address: 'Galle',
        createdAt: DAY('2026-07-01'),
        vehicle: {
          id: 'v1',
          vehicleCode: 'Tuk 1',
          vehicleType: 'Tuk',
          status: 'ACTIVE',
        },
        user: { loginId: 'RD1', status: 'ACTIVE' },
      },
    ]);
    prisma.collection.groupBy.mockResolvedValue([
      {
        riderId: 'r1',
        _count: { riderId: 2 },
        _sum: { weightKg: decimal('30.00') },
      },
    ]);
    prisma.collectionRequest.groupBy
      .mockResolvedValueOnce([{ riderId: 'r1', _count: { riderId: 3 } }])
      .mockResolvedValueOnce([{ riderId: 'r1', _count: { riderId: 1 } }]);

    const result = await service.getRidersReport({});

    expect(result.data[0].vehicle.vehicleCode).toBe('Tuk 1');
    expect(result.data[0].createdAt).toEqual(DAY('2026-07-01'));
    expect(result.data[0]).toEqual(
      expect.objectContaining({
        totalCollections: 2,
        totalWeightKg: 30,
        totalRequests: 3,
        completedRequests: 1,
      }),
    );
  });

  it('filters riders by status and assigned vehicle', async () => {
    prisma.rider.findMany.mockResolvedValue([]);
    prisma.collection.groupBy.mockResolvedValue([]);
    prisma.collectionRequest.groupBy.mockResolvedValue([]).mockResolvedValue([]);

    await service.getRidersReport({ status: 'ACTIVE', vehicleId: 'v2' });

    expect(prisma.rider.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { vehicleId: 'v2', user: { status: 'ACTIVE' } },
      }),
    );
  });
});

describe('ReportsService – vehicles report', () => {
  let service: ReportsService;
  let prisma: MockPrisma;

  beforeEach(() => {
    prisma = createPrisma();
    service = new ReportsService(prisma as never);
  });

  it('includes the assigned rider and collection activity', async () => {
    prisma.vehicle.findMany.mockResolvedValue([
      {
        id: 'v1',
        vehicleCode: 'Tuk 1',
        vehicleType: 'Tuk',
        status: 'ACTIVE',
        createdAt: DAY('2026-07-01'),
        rider: { id: 'r1', fullName: 'Bob', user: { loginId: 'RD1' } },
      },
    ]);
    prisma.collection.groupBy.mockResolvedValue([
      {
        vehicleId: 'v1',
        _count: { vehicleId: 7 },
        _sum: { weightKg: decimal('140.00') },
        _max: { collectedAt: DAY('2026-08-14') },
      },
    ]);

    const result = await service.getVehiclesReport({});

    expect(result.data[0]).toEqual(
      expect.objectContaining({
        vehicleCode: 'Tuk 1',
        createdAt: DAY('2026-07-01'),
        rider: { id: 'r1', fullName: 'Bob', user: { loginId: 'RD1' } },
        totalCollections: 7,
        totalWeightKg: 140,
        lastCollectedAt: DAY('2026-08-14'),
      }),
    );
  });

  it('filters vehicles by status', async () => {
    prisma.vehicle.findMany.mockResolvedValue([]);
    prisma.collection.groupBy.mockResolvedValue([]);

    await service.getVehiclesReport({ status: 'INACTIVE' });

    expect(prisma.vehicle.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: 'INACTIVE' } }),
    );
  });

  it('returns zeros when there is no activity', async () => {
    prisma.vehicle.findMany.mockResolvedValue([
      {
        id: 'v2',
        vehicleCode: 'Bike 2',
        vehicleType: 'Bike',
        status: 'ACTIVE',
        rider: null,
      },
    ]);
    prisma.collection.groupBy.mockResolvedValue([]);

    const result = await service.getVehiclesReport({});

    expect(result.data[0]).toEqual(
      expect.objectContaining({
        totalCollections: 0,
        totalWeightKg: 0,
        lastCollectedAt: null,
      }),
    );
  });
});

describe('ReportsService – assignments report', () => {
  let service: ReportsService;
  let prisma: MockPrisma;

  beforeEach(() => {
    prisma = createPrisma();
    service = new ReportsService(prisma as never);
  });

  it('returns assignment rows and the total count', async () => {
    prisma.dailyAssignment.findMany.mockResolvedValue([
      {
        id: 'a1',
        collectorId: 'c1',
        assignmentDate: DAY('2026-08-10'),
        createdAt: DAY('2026-08-09'),
        updatedAt: DAY('2026-08-09'),
        collector: { id: 'c1', fullName: 'Alice', user: { loginId: 'COL1' } },
      },
    ]);

    const result = await service.getAssignmentsReport({});

    expect(result.data[0].collector.fullName).toBe('Alice');
    expect(result.data[0].collectorId).toBe('c1');
    expect(result.summary.totalCount).toBe(1);
  });

  it('filters by assignment date range and collector', async () => {
    prisma.dailyAssignment.findMany.mockResolvedValue([]);

    await service.getAssignmentsReport({
      collectorId: 'c1',
      from: '2026-08-01',
      to: '2026-08-02',
    });

    expect(prisma.dailyAssignment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          collectorId: 'c1',
          assignmentDate: { gte: DAY('2026-08-01'), lt: DAY('2026-08-03') },
        },
      }),
    );
  });

  it('returns an empty report when no assignments exist', async () => {
    prisma.dailyAssignment.findMany.mockResolvedValue([]);

    const result = await service.getAssignmentsReport({});

    expect(result.data).toEqual([]);
    expect(result.summary.totalCount).toBe(0);
  });
});