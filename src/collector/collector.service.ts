import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCollectionRequestDto } from './dto/create-collection-request.dto';

const assignmentSelect = {
  id: true,
  assignmentDate: true,
  createdAt: true,
  updatedAt: true,
  collector: {
    select: {
      id: true,
      fullName: true,
      mobile: true,
      user: {
        select: {
          loginId: true,
        },
      },
    },
  },
} as const;

const collectionRequestSelect = {
  id: true,
  collectorId: true,
  riderId: true,
  latitude: true,
  longitude: true,
  status: true,
  qrVerified: true,
  requestedAt: true,
  acceptedAt: true,
  completedAt: true,
  cancelledAt: true,
  createdAt: true,
  updatedAt: true,
  collector: {
    select: {
      id: true,
      fullName: true,
      mobile: true,
    },
  },
  rider: {
    select: {
      id: true,
      fullName: true,
      mobile: true,
    },
  },
} as const;

const collectionRequestHistorySelect = {
  id: true,
  collectorId: true,
  riderId: true,
  latitude: true,
  longitude: true,
  status: true,
  qrVerified: true,
  requestedAt: true,
  acceptedAt: true,
  completedAt: true,
  cancelledAt: true,
  createdAt: true,
  updatedAt: true,
  collector: {
    select: {
      id: true,
      fullName: true,
      mobile: true,
    },
  },
  rider: {
    select: {
      id: true,
      fullName: true,
      mobile: true,
    },
  },
} as const;

@Injectable()
export class CollectorService {
  constructor(private readonly prisma: PrismaService) {}

  async findTodayAssignment(userId: string) {
    const collector = await this.prisma.collector.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!collector) {
      throw new NotFoundException('Collector not found');
    }

    const assignment = await this.prisma.dailyAssignment.findFirst({
      where: {
        collectorId: collector.id,
        assignmentDate: this.todayAsCalendarDate(),
      },
      select: assignmentSelect,
    });

    if (!assignment) {
      throw new NotFoundException('No assignment found for today');
    }

    return assignment;
  }

  async createCollectionRequest(
    userId: string,
    dto: CreateCollectionRequestDto,
  ) {
    const collector = await this.prisma.collector.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!collector) {
      throw new NotFoundException('Collector not found');
    }

    const request = await this.prisma.collectionRequest.create({
      data: {
        collectorId: collector.id,
        latitude: dto.latitude,
        longitude: dto.longitude,
        status: 'PENDING',
      },
      select: collectionRequestSelect,
    });

    return this.serializeCollectionRequest(request);
  }

  async findCollectionRequests(userId: string) {
    const collector = await this.resolveCollector(userId);

    const requests = await this.prisma.collectionRequest.findMany({
      where: { collectorId: collector.id },
      select: collectionRequestHistorySelect,
      orderBy: { requestedAt: 'desc' },
    });

    return requests.map((request) => this.serializeCollectionRequest(request));
  }

  async findCollectionRequest(userId: string, requestId: string) {
    const collector = await this.resolveCollector(userId);
    const request = await this.prisma.collectionRequest.findFirst({
      where: { id: requestId, collectorId: collector.id },
      select: collectionRequestHistorySelect,
    });

    if (!request) {
      throw new NotFoundException('Collection request not found');
    }

    return this.serializeCollectionRequest(request);
  }

  async cancelCollectionRequest(userId: string, requestId: string) {
    const collector = await this.resolveCollector(userId);
    const request = await this.prisma.collectionRequest.findFirst({
      where: { id: requestId, collectorId: collector.id },
      select: { id: true, status: true },
    });

    if (!request) {
      throw new NotFoundException('Collection request not found');
    }
    if (request.status !== 'PENDING') {
      throw new ConflictException('Only pending requests can be cancelled');
    }

    const result = await this.prisma.collectionRequest.updateMany({
      where: { id: request.id, collectorId: collector.id, status: 'PENDING' },
      data: { status: 'CANCELLED', cancelledAt: new Date() },
    });

    if (result.count === 0) {
      throw new ConflictException('Only pending requests can be cancelled');
    }

    const updatedRequest = await this.prisma.collectionRequest.findFirst({
      where: { id: request.id, collectorId: collector.id },
      select: collectionRequestHistorySelect,
    });

    if (!updatedRequest) {
      throw new NotFoundException('Collection request not found');
    }

    return this.serializeCollectionRequest(updatedRequest);
  }

  async getLeaderboard(userId: string, period: string) {
    await this.resolveCollector(userId);

    const normalizedPeriod = this.normalizePeriod(period);
    const now = new Date();
    const since =
      normalizedPeriod === 'month'
        ? new Date(now.getFullYear(), now.getMonth(), 1)
        : undefined;

    const grouped = await this.prisma.collection.groupBy({
      by: ['collectorId'],
      where: since
        ? {
            collectedAt: {
              gte: since,
            },
          }
        : undefined,
      _sum: {
        weightKg: true,
      },
      _count: {
        collectorId: true,
      },
    });

    const collectorIds = grouped.map((entry) => entry.collectorId);
    const collectors = collectorIds.length
      ? await this.prisma.collector.findMany({
          where: { id: { in: collectorIds } },
          select: { id: true, fullName: true },
        })
      : [];

    const byName = new Map(
      collectors.map((collector) => [collector.id, collector.fullName]),
    );

    const leaderboard = grouped
      .map((entry) => ({
        collectorId: entry.collectorId,
        fullName: byName.get(entry.collectorId) ?? 'Unknown Collector',
        totalWeightKg: this.toNumber(entry._sum.weightKg ?? 0),
        totalCollections: entry._count.collectorId ?? 0,
      }))
      .sort(
        (a, b) =>
          b.totalWeightKg - a.totalWeightKg ||
          b.totalCollections - a.totalCollections ||
          a.collectorId.localeCompare(b.collectorId),
      )
      .map((entry, index) => ({
        ...entry,
        rank: index + 1,
      }));

    return leaderboard;
  }

  private serializeCollectionRequest<
    T extends {
      id: string;
      collectorId: string | null;
      riderId: string | null;
      latitude: number | string | { toString(): string } | null;
      longitude: number | string | { toString(): string } | null;
      status: string;
      requestedAt: Date | string | null;
      acceptedAt: Date | string | null;
      completedAt: Date | string | null;
      cancelledAt: Date | string | null;
      createdAt?: Date | string | null;
      updatedAt?: Date | string | null;
      collector?: { id: string; fullName: string; mobile: string } | null;
      rider?: { id: string; fullName: string; mobile: string } | null;
    },
  >(request: T) {
    return {
      ...request,
      collectorId: request.collectorId ?? null,
      riderId: request.riderId ?? null,
      latitude: this.toNumber(request.latitude),
      longitude: this.toNumber(request.longitude),
      collector: request.collector ?? null,
      rider: request.rider ?? null,
      requestedAt: request.requestedAt ?? null,
      acceptedAt: request.acceptedAt ?? null,
      completedAt: request.completedAt ?? null,
      cancelledAt: request.cancelledAt ?? null,
      createdAt: request.createdAt ?? null,
      updatedAt: request.updatedAt ?? null,
    };
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

  private normalizePeriod(period?: string): 'month' | 'all' {
    const normalized = String(period ?? 'all').toLowerCase();
    return normalized === 'month' ? 'month' : 'all';
  }

  private async resolveCollector(userId: string) {
    const collector = await this.prisma.collector.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!collector) {
      throw new NotFoundException('Collector not found');
    }

    return collector;
  }

  private todayAsCalendarDate(): Date {
    const now = new Date();
    return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  }
}
