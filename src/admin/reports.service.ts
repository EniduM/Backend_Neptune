import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AssignmentsReportQueryDto } from './dto/assignments-report-query.dto';
import { CollectionRequestsReportQueryDto } from './dto/collection-requests-report-query.dto';
import { CollectionsReportQueryDto } from './dto/collections-report-query.dto';
import { CollectorsReportQueryDto } from './dto/collectors-report-query.dto';
import { RidersReportQueryDto } from './dto/riders-report-query.dto';
import { VehiclesReportQueryDto } from './dto/vehicles-report-query.dto';

const collectionRowSelect = {
  id: true,
  collectionRequestId: true,
  collectorId: true,
  riderId: true,
  vehicleId: true,
  weightKg: true,
  collectedAt: true,
  collector: {
    select: {
      id: true,
      fullName: true,
      user: { select: { loginId: true } },
    },
  },
  rider: {
    select: {
      id: true,
      fullName: true,
      user: { select: { loginId: true } },
    },
  },
  vehicle: {
    select: { id: true, vehicleCode: true, vehicleType: true },
  },
} as const;

const collectionRequestRowSelect = {
  id: true,
  latitude: true,
  longitude: true,
  status: true,
  qrVerified: true,
  requestedAt: true,
  acceptedAt: true,
  completedAt: true,
  cancelledAt: true,
  collector: {
    select: {
      id: true,
      fullName: true,
      user: { select: { loginId: true } },
    },
  },
  rider: {
    select: {
      id: true,
      fullName: true,
      user: { select: { loginId: true } },
    },
  },
} as const;

const assignmentRowSelect = {
  id: true,
  collectorId: true,
  assignmentDate: true,
  createdAt: true,
  updatedAt: true,
  collector: {
    select: {
      id: true,
      fullName: true,
      user: { select: { loginId: true } },
    },
  },
} as const;

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async getCollectionsReport(query: CollectionsReportQueryDto) {
    const where: Prisma.CollectionWhereInput = this.collectionWhere(
      query.collectorId,
      query.riderId,
      query.vehicleId,
      query.from,
      query.to,
    );

    const [rows, summary] = await Promise.all([
      this.prisma.collection.findMany({
        where,
        select: collectionRowSelect,
        orderBy: { collectedAt: 'desc' },
      }),
      this.prisma.collection.aggregate({
        where,
        _count: true,
        _sum: { weightKg: true },
        _avg: { weightKg: true },
      }),
    ]);

    const totalWeightKg = this.toNumber(summary._sum.weightKg ?? 0);
    const totalCount = summary._count;

    return {
      data: rows.map((row) => ({
        ...row,
        weightKg: this.toNumber(row.weightKg),
      })),
      summary: {
        totalCount,
        totalWeightKg,
        averageWeightKg:
          totalCount === 0 ? 0 : Math.round((totalWeightKg / totalCount) * 100) / 100,
      },
    };
  }

  async getCollectionRequestsReport(query: CollectionRequestsReportQueryDto) {
    const where: Prisma.CollectionRequestWhereInput = {
      ...this.requestWhere(query.collectorId, query.riderId, query.from, query.to),
      ...(query.status ? { status: query.status } : {}),
    };

    const [rows, summary, statusGroups, qrVerifiedSummary] = await Promise.all([
      this.prisma.collectionRequest.findMany({
        where,
        select: collectionRequestRowSelect,
        orderBy: { requestedAt: 'desc' },
      }),
      this.prisma.collectionRequest.aggregate({ where, _count: true }),
      this.prisma.collectionRequest.groupBy({
        by: ['status'],
        where,
        _count: { _all: true },
      }),
      this.prisma.collectionRequest.aggregate({
        where: { ...where, qrVerified: true },
        _count: true,
      }),
    ]);

    const counts: Record<
      'PENDING' | 'ACCEPTED' | 'COMPLETED' | 'CANCELLED',
      number
    > = { PENDING: 0, ACCEPTED: 0, COMPLETED: 0, CANCELLED: 0 };
    for (const group of statusGroups) {
      counts[group.status] = group._count._all;
    }

    return {
      data: rows.map((row) => ({
        ...row,
        latitude: this.toNumber(row.latitude),
        longitude: this.toNumber(row.longitude),
      })),
      summary: {
        totalCount: summary._count,
        qrVerifiedCount: qrVerifiedSummary._count,
        statusCounts: counts,
      },
    };
  }

  async getCollectorsReport(query: CollectorsReportQueryDto) {
    const [collectors, collectionActivity, requestActivity, completedActivity] =
      await Promise.all([
        this.prisma.collector.findMany({
          where: query.status ? { user: { status: query.status } } : {},
          select: {
            id: true,
            fullName: true,
            nic: true,
            mobile: true,
            address: true,
            createdAt: true,
            user: { select: { loginId: true, status: true } },
          },
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.collection.groupBy({
          by: ['collectorId'],
          where: this.collectionActivityWhere(query.collectorId, query.from, query.to),
          _count: { collectorId: true },
          _sum: { weightKg: true },
        }),
        this.prisma.collectionRequest.groupBy({
          by: ['collectorId'],
          where: this.requestActivityWhere(query.collectorId, query.from, query.to),
          _count: { collectorId: true },
        }),
        this.prisma.collectionRequest.groupBy({
          by: ['collectorId'],
          where: {
            ...this.requestActivityWhere(query.collectorId, query.from, query.to),
            status: 'COMPLETED',
          },
          _count: { collectorId: true },
        }),
      ]);

    const collections = new Map(
      collectionActivity.map((entry) => [entry.collectorId, entry]),
    );
    const requests = new Map(
      requestActivity.map((entry) => [entry.collectorId, entry]),
    );
    const completed = new Map(
      completedActivity.map((entry) => [entry.collectorId, entry]),
    );

    return {
      data: collectors.map((collector) => ({
        ...collector,
        totalCollections: collections.get(collector.id)?._count.collectorId ?? 0,
        totalWeightKg: this.toNumber(
          collections.get(collector.id)?._sum.weightKg ?? 0,
        ),
        totalRequests: requests.get(collector.id)?._count.collectorId ?? 0,
        completedRequests: completed.get(collector.id)?._count.collectorId ?? 0,
      })),
      summary: { totalCount: collectors.length },
    };
  }

  async getRidersReport(query: RidersReportQueryDto) {
    const [riders, collectionActivity, requestActivity, completedActivity] =
      await Promise.all([
        this.prisma.rider.findMany({
          where: {
            ...(query.status ? { user: { status: query.status } } : {}),
            ...(query.vehicleId ? { vehicleId: query.vehicleId } : {}),
          },
          select: {
            id: true,
            fullName: true,
            nic: true,
            mobile: true,
            address: true,
            createdAt: true,
            vehicle: {
              select: { id: true, vehicleCode: true, vehicleType: true, status: true },
            },
            user: { select: { loginId: true, status: true } },
          },
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.collection.groupBy({
          by: ['riderId'],
          where: this.collectionActivityWhere(
            query.collectorId,
            query.from,
            query.to,
            query.vehicleId,
          ),
          _count: { riderId: true },
        }),
        this.prisma.collectionRequest.groupBy({
          by: ['riderId'],
          where: this.requestActivityWhere(query.collectorId, query.from, query.to),
          _count: { riderId: true },
        }),
        this.prisma.collectionRequest.groupBy({
          by: ['riderId'],
          where: {
            ...this.requestActivityWhere(query.collectorId, query.from, query.to),
            status: 'COMPLETED',
          },
          _count: { riderId: true },
        }),
      ]);

    const collections = new Map(
      collectionActivity.map((entry) => [entry.riderId, entry]),
    );
    const requests = new Map(
      requestActivity.map((entry) => [entry.riderId, entry]),
    );
    const completed = new Map(
      completedActivity.map((entry) => [entry.riderId, entry]),
    );

    return {
      data: riders.map((rider) => ({
        ...rider,
        totalCollections: collections.get(rider.id)?._count.riderId ?? 0,
        totalRequests: requests.get(rider.id)?._count.riderId ?? 0,
        completedRequests: completed.get(rider.id)?._count.riderId ?? 0,
      })),
      summary: { totalCount: riders.length },
    };
  }

  async getVehiclesReport(query: VehiclesReportQueryDto) {
    const [vehicles, activity] = await Promise.all([
      this.prisma.vehicle.findMany({
        where: query.status ? { status: query.status } : {},
        select: {
          id: true,
          vehicleCode: true,
          vehicleType: true,
          status: true,
          createdAt: true,
          riders: {
            select: {
              id: true,
              fullName: true,
              user: { select: { loginId: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.collection.groupBy({
        by: ['vehicleId'],
        where: {
          ...(query.from || query.to
            ? { collectedAt: this.dateRange(query.from, query.to) }
            : {}),
        },
        _count: { vehicleId: true },
        _sum: { weightKg: true },
        _max: { collectedAt: true },
      }),
    ]);

    const byId = new Map(activity.map((entry) => [entry.vehicleId, entry]));

    return {
      data: vehicles.map((vehicle) => ({
        ...vehicle,
        totalCollections: byId.get(vehicle.id)?._count.vehicleId ?? 0,
        totalWeightKg: this.toNumber(byId.get(vehicle.id)?._sum.weightKg ?? 0),
        lastCollectedAt: byId.get(vehicle.id)?._max.collectedAt ?? null,
      })),
      summary: { totalCount: vehicles.length },
    };
  }

  async getAssignmentsReport(query: AssignmentsReportQueryDto) {
    const where: Prisma.DailyAssignmentWhereInput = {
      ...(query.collectorId ? { collectorId: query.collectorId } : {}),
      ...(query.from || query.to
        ? { assignmentDate: this.dateRange(query.from, query.to) }
        : {}),
    };

    const rows = await this.prisma.dailyAssignment.findMany({
      where,
      select: assignmentRowSelect,
      orderBy: { assignmentDate: 'desc' },
    });

    return {
      data: rows,
      summary: { totalCount: rows.length },
    };
  }

  private collectionWhere(
    collectorId?: string,
    riderId?: string,
    vehicleId?: string,
    from?: string,
    to?: string,
  ): Prisma.CollectionWhereInput {
    return {
      ...(collectorId ? { collectorId } : {}),
      ...(riderId ? { riderId } : {}),
      ...(vehicleId ? { vehicleId } : {}),
      ...(from || to ? { collectedAt: this.dateRange(from, to) } : {}),
    };
  }

  private requestWhere(
    collectorId?: string,
    riderId?: string,
    from?: string,
    to?: string,
  ): Prisma.CollectionRequestWhereInput {
    return {
      ...(collectorId ? { collectorId } : {}),
      ...(riderId ? { riderId } : {}),
      ...(from || to
        ? { requestedAt: this.dateRange(from, to) }
        : {}),
    };
  }

  private collectionActivityWhere(
    collectorId?: string,
    from?: string,
    to?: string,
    vehicleId?: string,
  ): Prisma.CollectionWhereInput {
    return {
      ...(collectorId ? { collectorId } : {}),
      ...(vehicleId ? { vehicleId } : {}),
      ...(from || to ? { collectedAt: this.dateRange(from, to) } : {}),
    };
  }

  private requestActivityWhere(
    collectorId?: string,
    from?: string,
    to?: string,
  ): Prisma.CollectionRequestWhereInput {
    return {
      ...(collectorId ? { collectorId } : {}),
      ...(from || to ? { requestedAt: this.dateRange(from, to) } : {}),
    };
  }

  private dateRange(from?: string, to?: string): Prisma.DateTimeFilter {
    const range: Prisma.DateTimeFilter = {};
    if (from) {
      range.gte = new Date(`${from}T00:00:00.000Z`);
    }
    if (to) {
      const end = new Date(`${to}T00:00:00.000Z`);
      end.setUTCDate(end.getUTCDate() + 1);
      range.lt = end;
    }
    return range;
  }

  private toNumber(
    value: number | string | { toString(): string } | null | undefined,
  ): number {
    if (value === null || value === undefined) {
      return 0;
    }
    if (typeof value === 'number') {
      return Number(value);
    }
    if (typeof value === 'string') {
      return Number(value);
    }
    return Number(value.toString());
  }
}