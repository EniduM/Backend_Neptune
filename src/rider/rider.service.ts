import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { timingSafeEqual } from 'crypto';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CompleteCollectionRequestDto } from './dto/complete-collection-request.dto';

const requestSelect = {
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
} as const;

const collectionSelect = {
  id: true,
  collectionRequestId: true,
  collectorId: true,
  riderId: true,
  vehicleId: true,
  weightKg: true,
  collectedAt: true,
  createdAt: true,
  updatedAt: true,
  vehicle: {
    select: {
      id: true,
      vehicleCode: true,
      vehicleType: true,
    },
  },
} as const;

@Injectable()
export class RiderService {
  constructor(private readonly prisma: PrismaService) {}

  async findPendingRequests(userId: string) {
    await this.resolveRider(userId);

    return this.prisma.collectionRequest.findMany({
      where: { status: 'PENDING' },
      select: requestSelect,
      orderBy: { requestedAt: 'asc' },
    });
  }

  async acceptRequest(userId: string, requestId: string) {
    const rider = await this.resolveRider(userId);
    const request = await this.prisma.collectionRequest.findUnique({
      where: { id: requestId },
      select: { id: true, status: true },
    });

    if (!request) {
      throw new NotFoundException('Collection request not found');
    }
    if (request.status !== 'PENDING') {
      throw new ConflictException('Only pending requests can be accepted');
    }

    const acceptedAt = new Date();
    const result = await this.prisma.collectionRequest.updateMany({
      where: { id: requestId, status: 'PENDING' },
      data: { riderId: rider.id, status: 'ACCEPTED', acceptedAt },
    });

    if (result.count === 0) {
      throw new ConflictException('Only pending requests can be accepted');
    }

    const acceptedRequest = await this.prisma.collectionRequest.findUnique({
      where: { id: requestId },
      select: requestSelect,
    });

    if (!acceptedRequest) {
      throw new NotFoundException('Collection request not found');
    }

    return acceptedRequest;
  }

  async findMyRequests(userId: string) {
    const rider = await this.resolveRider(userId);

    return this.prisma.collectionRequest.findMany({
      where: { riderId: rider.id },
      select: requestSelect,
      orderBy: { requestedAt: 'desc' },
    });
  }

  async findMyRequest(userId: string, requestId: string) {
    const rider = await this.resolveRider(userId);
    const request = await this.prisma.collectionRequest.findFirst({
      where: { id: requestId, riderId: rider.id },
      select: requestSelect,
    });

    if (!request) {
      throw new NotFoundException('Collection request not found');
    }

    return request;
  }

  async completeRequest(
    userId: string,
    requestId: string,
    dto: CompleteCollectionRequestDto,
  ) {
    const rider = await this.resolveRider(userId);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const request = await tx.collectionRequest.findUnique({
          where: { id: requestId },
          select: {
            id: true,
            collectorId: true,
            riderId: true,
            status: true,
            qrVerified: true,
          },
        });

        if (!request) {
          throw new NotFoundException('Collection request not found');
        }
        if (request.riderId !== rider.id) {
          throw new ForbiddenException(
            'This request was not accepted by the authenticated rider',
          );
        }
        if (request.status !== 'ACCEPTED') {
          throw new ConflictException(
            'Only accepted requests can be completed',
          );
        }
        if (!request.qrVerified) {
          throw new ConflictException(
            'QR verification is required before completing a collection request',
          );
        }

        const vehicle = await tx.vehicle.findUnique({
          where: { id: dto.vehicleId },
          select: { id: true, status: true },
        });

        if (!vehicle) {
          throw new NotFoundException('Vehicle not found');
        }
        if (vehicle.status !== 'ACTIVE') {
          throw new ConflictException('Vehicle is inactive');
        }

        const completedAt = new Date();
        const collection = await tx.collection.create({
          data: {
            collectionRequestId: request.id,
            collectorId: request.collectorId,
            riderId: rider.id,
            vehicleId: vehicle.id,
            weightKg: dto.weightKg,
            collectedAt: completedAt,
          },
          select: collectionSelect,
        });

        const completedRequest = await tx.collectionRequest.update({
          where: { id: request.id },
          data: { status: 'COMPLETED', completedAt },
          select: requestSelect,
        });

        return { request: completedRequest, collection };
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'Collection request has already been completed',
        );
      }

      throw error;
    }
  }

  async verifyQrToken(userId: string, requestId: string, qrToken: string) {
    const rider = await this.resolveRider(userId);

    const request = await this.prisma.collectionRequest.findUnique({
      where: { id: requestId },
      select: { id: true, collectorId: true, riderId: true, status: true },
    });

    if (!request) {
      throw new NotFoundException('Collection request not found');
    }
    if (request.riderId !== rider.id) {
      throw new ForbiddenException(
        'This request was not accepted by the authenticated rider',
      );
    }
    if (request.status !== 'ACCEPTED') {
      throw new ConflictException('QR verification requires ACCEPTED status');
    }

    const collector = await this.prisma.collector.findUnique({
      where: { id: request.collectorId },
      select: { qrToken: true },
    });

    if (!collector || !this.qrTokensMatch(collector.qrToken, qrToken)) {
      throw new ConflictException(
        'QR token does not match the collector for this request',
      );
    }

    const verifiedRequest = await this.prisma.collectionRequest.update({
      where: { id: requestId },
      data: { qrVerified: true },
      select: {
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
          select: { id: true, fullName: true, mobile: true },
        },
      },
    });

    return verifiedRequest;
  }

  async findVehicles() {
    return this.prisma.vehicle.findMany({
      where: { status: 'ACTIVE' },
      select: {
        id: true,
        vehicleCode: true,
        vehicleType: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { vehicleCode: 'asc' },
    });
  }

  private qrTokensMatch(expected: string, submitted: string): boolean {
    const expectedBuffer = Buffer.from(expected);
    const submittedBuffer = Buffer.from(submitted);
    if (expectedBuffer.length !== submittedBuffer.length) {
      return false;
    }
    return timingSafeEqual(expectedBuffer, submittedBuffer);
  }

  private async resolveRider(userId: string) {
    const rider = await this.prisma.rider.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!rider) {
      throw new NotFoundException('Rider not found');
    }

    return rider;
  }
}
