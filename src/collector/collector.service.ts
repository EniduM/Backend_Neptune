import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
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
  riderId: true,
  latitude: true,
  longitude: true,
  status: true,
  requestedAt: true,
  createdAt: true,
  updatedAt: true,
  collector: {
    select: {
      id: true,
      fullName: true,
      mobile: true,
    },
  },
} as const;

const collectionRequestHistorySelect = {
  id: true,
  latitude: true,
  longitude: true,
  status: true,
  requestedAt: true,
  acceptedAt: true,
  completedAt: true,
  cancelledAt: true,
  createdAt: true,
  updatedAt: true,
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

    return this.prisma.collectionRequest.create({
      data: {
        collectorId: collector.id,
        latitude: dto.latitude,
        longitude: dto.longitude,
        status: 'PENDING',
      },
      select: collectionRequestSelect,
    });
  }

  async findCollectionRequests(userId: string) {
    const collector = await this.resolveCollector(userId);

    return this.prisma.collectionRequest.findMany({
      where: { collectorId: collector.id },
      select: collectionRequestHistorySelect,
      orderBy: { requestedAt: 'desc' },
    });
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

    return request;
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

    return this.prisma.collectionRequest.findFirst({
      where: { id: request.id, collectorId: collector.id },
      select: collectionRequestHistorySelect,
    });
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
    return new Date(
      Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()),
    );
  }
}
