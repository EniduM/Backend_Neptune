import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { randomBytes } from 'crypto';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCollectorDto } from './dto/create-collector.dto';
import { UpdateCollectorDto } from './dto/update-collector.dto';
import { UpdateCollectorStatusDto } from './dto/update-collector-status.dto';
import { CreateRiderDto } from './dto/create-rider.dto';
import { UpdateRiderDto } from './dto/update-rider.dto';
import { UpdateRiderStatusDto } from './dto/update-rider-status.dto';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';
import { UpdateVehicleStatusDto } from './dto/update-vehicle-status.dto';
import { CreateAssignmentDto } from './dto/create-assignment.dto';
import { UpdateAssignmentDto } from './dto/update-assignment.dto';

const collectorSelect = {
  id: true,
  fullName: true,
  nic: true,
  mobile: true,
  address: true,
  guardianName: true,
  guardianMobile: true,
  qrToken: true,
  createdAt: true,
  updatedAt: true,
  user: {
    select: {
      id: true,
      loginId: true,
      role: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    },
  },
} as const;

const riderSelect = {
  id: true,
  fullName: true,
  nic: true,
  mobile: true,
  address: true,
  vehicleId: true,
  createdAt: true,
  updatedAt: true,
  vehicle: {
    select: {
      id: true,
      vehicleCode: true,
      vehicleType: true,
      status: true,
    },
  },
  user: {
    select: {
      id: true,
      loginId: true,
      role: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    },
  },
} as const;

const vehicleSelect = {
  id: true,
  vehicleCode: true,
  vehicleType: true,
  status: true,
  createdAt: true,
  updatedAt: true,
} as const;

const assignmentSelect = {
  id: true,
  collectorId: true,
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
      nic: true,
      mobile: true,
      address: true,
      user: {
        select: {
          id: true,
          loginId: true,
          role: true,
          status: true,
        },
      },
    },
  },
  rider: {
    select: {
      id: true,
      fullName: true,
      nic: true,
      mobile: true,
      address: true,
      user: {
        select: {
          id: true,
          loginId: true,
          role: true,
          status: true,
        },
      },
    },
  },
  collection: {
    select: {
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
          status: true,
        },
      },
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
  collector: {
    select: {
      id: true,
      fullName: true,
      nic: true,
      mobile: true,
      address: true,
      user: {
        select: {
          id: true,
          loginId: true,
          role: true,
          status: true,
        },
      },
    },
  },
  rider: {
    select: {
      id: true,
      fullName: true,
      nic: true,
      mobile: true,
      address: true,
      user: {
        select: {
          id: true,
          loginId: true,
          role: true,
          status: true,
        },
      },
    },
  },
  vehicle: {
    select: {
      id: true,
      vehicleCode: true,
      vehicleType: true,
      status: true,
    },
  },
  collectionRequest: {
    select: {
      id: true,
      status: true,
      qrVerified: true,
      requestedAt: true,
    },
  },
} as const;

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async createCollector(dto: CreateCollectorDto) {
    try {
      const passwordHash = await argon2.hash(dto.password);
      return await this.prisma.user.create({
        data: {
          loginId: dto.loginId,
          passwordHash,
          role: 'COLLECTOR',
          status: 'ACTIVE',
          collector: {
            create: {
              fullName: dto.fullName,
              nic: dto.nic,
              mobile: dto.mobile,
              address: dto.address,
              guardianName: dto.guardianName,
              guardianMobile: dto.guardianMobile,
              qrToken: dto.qrToken ?? this.generateQrToken(),
            },
          },
        },
        select: {
          id: true,
          loginId: true,
          role: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          collector: { select: collectorSelect },
        },
      });
    } catch (error) {
      this.handleDatabaseError(error, 'Collector');
    }
  }

  private generateQrToken(): string {
    return `QR-${randomBytes(6).toString('hex').toUpperCase()}`;
  }

  async findAllCollectors() {
    return this.prisma.collector.findMany({
      select: collectorSelect,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findCollector(id: string) {
    const collector = await this.prisma.collector.findUnique({
      where: { id },
      select: collectorSelect,
    });

    if (!collector) {
      throw new NotFoundException('Collector not found');
    }

    return collector;
  }

  async updateCollector(id: string, dto: UpdateCollectorDto) {
    await this.ensureCollectorExists(id);
    const { loginId, password, ...collectorData } = dto;

    try {
      const passwordHash = password ? await argon2.hash(password) : undefined;
      const hasUserUpdate = loginId !== undefined || passwordHash !== undefined;

      return await this.prisma.collector.update({
        where: { id },
        data: {
          ...collectorData,
          ...(hasUserUpdate
            ? {
                user: {
                  update: {
                    ...(loginId !== undefined ? { loginId } : {}),
                    ...(passwordHash !== undefined ? { passwordHash } : {}),
                  },
                },
              }
            : {}),
        },
        select: collectorSelect,
      });
    } catch (error) {
      this.handleDatabaseError(error, 'Collector');
    }
  }

  async updateCollectorStatus(id: string, dto: UpdateCollectorStatusDto) {
    const collector = await this.ensureCollectorExists(id);

    return this.prisma.user.update({
      where: { id: collector.userId },
      data: { status: dto.status },
      select: {
        id: true,
        loginId: true,
        role: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        collector: { select: collectorSelect },
      },
    });
  }

  async deleteCollector(id: string) {
    const collector = await this.ensureCollectorExists(id);

    return this.prisma.$transaction(async (tx) => {
      const requests = await tx.collectionRequest.findMany({
        where: { collectorId: id },
        select: { id: true },
      });
      const requestIds = requests.map((request) => request.id);

      await tx.collection.deleteMany({
        where: {
          OR: [
            { collectorId: id },
            ...(requestIds.length > 0
              ? [{ collectionRequestId: { in: requestIds } }]
              : []),
          ],
        },
      });
      await tx.collectionRequest.deleteMany({ where: { collectorId: id } });
      await tx.dailyAssignment.deleteMany({ where: { collectorId: id } });

      return tx.user.delete({
        where: { id: collector.userId },
        select: {
          id: true,
          loginId: true,
          role: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          collector: { select: collectorSelect },
        },
      });
    });
  }

  async createRider(dto: CreateRiderDto) {
    if (dto.vehicleId !== undefined && dto.vehicleId !== null) {
      await this.validateAssignableVehicle(dto.vehicleId);
    }

    try {
      const passwordHash = await argon2.hash(dto.password);

      return await this.prisma.$transaction((tx) =>
        tx.user.create({
          data: {
            loginId: dto.loginId,
            passwordHash,
            role: 'RIDER',
            status: 'ACTIVE',
            rider: {
              create: {
                fullName: dto.fullName,
                nic: dto.nic,
                mobile: dto.mobile,
                address: dto.address,
                vehicleId: dto.vehicleId ?? null,
              },
            },
          },
          select: {
            id: true,
            loginId: true,
            role: true,
            status: true,
            createdAt: true,
            updatedAt: true,
            rider: { select: riderSelect },
          },
        }),
      );
    } catch (error) {
      this.handleDatabaseError(error, 'Rider');
    }
  }

  async findAllRiders() {
    return this.prisma.rider.findMany({
      select: riderSelect,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findRider(id: string) {
    const rider = await this.prisma.rider.findUnique({
      where: { id },
      select: riderSelect,
    });

    if (!rider) {
      throw new NotFoundException('Rider not found');
    }

    return rider;
  }

  async updateRider(id: string, dto: UpdateRiderDto) {
    await this.ensureRiderExists(id);
    const { loginId, password, vehicleId, ...riderData } = dto;

    if (vehicleId !== undefined && vehicleId !== null) {
      await this.validateAssignableVehicle(vehicleId, id);
    }

    try {
      const passwordHash = password ? await argon2.hash(password) : undefined;
      const hasUserUpdate = loginId !== undefined || passwordHash !== undefined;

      const data: Prisma.RiderUpdateInput = {
        ...riderData,
        ...(vehicleId !== undefined
          ? {
              vehicle:
                vehicleId === null
                  ? { disconnect: true }
                  : { connect: { id: vehicleId } },
            }
          : {}),
        ...(hasUserUpdate
          ? {
              user: {
                update: {
                  ...(loginId !== undefined ? { loginId } : {}),
                  ...(passwordHash !== undefined ? { passwordHash } : {}),
                },
              },
            }
          : {}),
      };

      return await this.prisma.rider.update({
        where: { id },
        data,
        select: riderSelect,
      });
    } catch (error) {
      this.handleDatabaseError(error, 'Rider');
    }
  }

  async updateRiderStatus(id: string, dto: UpdateRiderStatusDto) {
    const rider = await this.ensureRiderExists(id);

    return this.prisma.user.update({
      where: { id: rider.userId },
      data: { status: dto.status },
      select: {
        id: true,
        loginId: true,
        role: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        rider: { select: riderSelect },
      },
    });
  }

  async deleteRider(id: string) {
    await this.ensureRiderExists(id);

    return this.prisma.$transaction(async (tx) => {
      const requests = await tx.collectionRequest.findMany({
        where: { riderId: id },
        select: { id: true },
      });
      const requestIds = requests.map((request) => request.id);

      await tx.collection.deleteMany({
        where: {
          OR: [
            { riderId: id },
            ...(requestIds.length > 0
              ? [{ collectionRequestId: { in: requestIds } }]
              : []),
          ],
        },
      });
      await tx.collectionRequest.deleteMany({ where: { riderId: id } });

      return tx.rider.delete({
        where: { id },
        select: riderSelect,
      });
    });
  }

  async createVehicle(dto: CreateVehicleDto) {
    try {
      return await this.prisma.vehicle.create({
        data: {
          vehicleCode: dto.vehicleCode,
          vehicleType: dto.vehicleType,
        },
        select: vehicleSelect,
      });
    } catch (error) {
      this.handleDatabaseError(error, 'Vehicle');
    }
  }

  async findAllVehicles() {
    return this.prisma.vehicle.findMany({
      select: vehicleSelect,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findVehicle(id: string) {
    const vehicle = await this.prisma.vehicle.findUnique({
      where: { id },
      select: vehicleSelect,
    });

    if (!vehicle) {
      throw new NotFoundException('Vehicle not found');
    }

    return vehicle;
  }

  async updateVehicle(id: string, dto: UpdateVehicleDto) {
    await this.ensureVehicleExists(id);

    try {
      return await this.prisma.vehicle.update({
        where: { id },
        data: dto,
        select: vehicleSelect,
      });
    } catch (error) {
      this.handleDatabaseError(error, 'Vehicle');
    }
  }

  async updateVehicleStatus(id: string, dto: UpdateVehicleStatusDto) {
    await this.ensureVehicleExists(id);

    return this.prisma.vehicle.update({
      where: { id },
      data: { status: dto.status },
      select: vehicleSelect,
    });
  }

  async deleteVehicle(id: string) {
    await this.ensureVehicleExists(id);

    return this.prisma.$transaction(async (tx) => {
      await tx.collection.deleteMany({ where: { vehicleId: id } });
      return tx.vehicle.delete({
        where: { id },
        select: vehicleSelect,
      });
    });
  }

  async createAssignment(dto: CreateAssignmentDto) {
    await this.ensureCollectorExists(dto.collectorId);

    try {
      return await this.prisma.dailyAssignment.create({
        data: {
          collectorId: dto.collectorId,
          assignmentDate: this.toAssignmentDate(dto.assignmentDate),
        },
        select: assignmentSelect,
      });
    } catch (error) {
      this.handleDatabaseError(error, 'Assignment');
    }
  }

  async findAllAssignments() {
    return this.prisma.dailyAssignment.findMany({
      select: assignmentSelect,
      orderBy: { assignmentDate: 'desc' },
    });
  }

  async findAssignment(id: string) {
    const assignment = await this.prisma.dailyAssignment.findUnique({
      where: { id },
      select: assignmentSelect,
    });

    if (!assignment) {
      throw new NotFoundException('Assignment not found');
    }

    return assignment;
  }

  async updateAssignment(id: string, dto: UpdateAssignmentDto) {
    await this.ensureAssignmentExists(id);

    if (dto.collectorId !== undefined) {
      await this.ensureCollectorExists(dto.collectorId);
    }

    try {
      return await this.prisma.dailyAssignment.update({
        where: { id },
        data: {
          ...(dto.collectorId !== undefined
            ? { collectorId: dto.collectorId }
            : {}),
          ...(dto.assignmentDate !== undefined
            ? { assignmentDate: this.toAssignmentDate(dto.assignmentDate) }
            : {}),
        },
        select: assignmentSelect,
      });
    } catch (error) {
      this.handleDatabaseError(error, 'Assignment');
    }
  }

  async deleteAssignment(id: string) {
    await this.ensureAssignmentExists(id);

    return this.prisma.dailyAssignment.delete({
      where: { id },
      select: assignmentSelect,
    });
  }

  async findAllCollectionRequests() {
    const requests = await this.prisma.collectionRequest.findMany({
      select: collectionRequestSelect,
      orderBy: { requestedAt: 'desc' },
    });

    return requests.map((request) => this.serializeCollectionRequest(request));
  }

  async findCollectionRequest(id: string) {
    const request = await this.prisma.collectionRequest.findUnique({
      where: { id },
      select: collectionRequestSelect,
    });

    if (!request) {
      throw new NotFoundException('Collection request not found');
    }

    return this.serializeCollectionRequest(request);
  }

  async deleteCollectionRequest(id: string) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const request = await tx.collectionRequest.findUnique({
          where: { id },
          select: { id: true, collection: { select: { id: true } } },
        });

        if (!request) {
          throw new NotFoundException('Collection request not found');
        }

        if (request.collection) {
          throw new ConflictException(
            'Collection request cannot be deleted because it has related collection data',
          );
        }

        return tx.collectionRequest.delete({
          where: { id },
          select: collectionRequestSelect,
        });
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2003'
      ) {
        throw new ConflictException(
          'Collection request cannot be deleted because it has related collection data',
        );
      }

      throw error;
    }
  }

  async findAllCollections() {
    const collections = await this.prisma.collection.findMany({
      select: collectionSelect,
      orderBy: { collectedAt: 'desc' },
    });

    return collections.map((collection) => this.serializeCollection(collection));
  }

  async findCollection(id: string) {
    const collection = await this.prisma.collection.findUnique({
      where: { id },
      select: collectionSelect,
    });

    if (!collection) {
      throw new NotFoundException('Collection not found');
    }

    return this.serializeCollection(collection);
  }

  private serializeCollection<T extends { weightKg: number | string | { toString(): string } }>(
    collection: T,
  ) {
    return {
      ...collection,
      weightKg: this.toNumber(collection.weightKg),
    };
  }

  private async ensureCollectorExists(id: string) {
    const collector = await this.prisma.collector.findUnique({
      where: { id },
      select: { userId: true },
    });

    if (!collector) {
      throw new NotFoundException('Collector not found');
    }

    return collector;
  }

  private async ensureRiderExists(id: string) {
    const rider = await this.prisma.rider.findUnique({
      where: { id },
      select: { userId: true },
    });

    if (!rider) {
      throw new NotFoundException('Rider not found');
    }

    return rider;
  }

  private async ensureVehicleExists(id: string) {
    const vehicle = await this.prisma.vehicle.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!vehicle) {
      throw new NotFoundException('Vehicle not found');
    }
  }

  private async validateAssignableVehicle(vehicleId: string, riderId?: string) {
    const vehicle = await this.prisma.vehicle.findUnique({
      where: { id: vehicleId },
      select: { id: true, status: true },
    });

    if (!vehicle) {
      throw new NotFoundException('Vehicle not found');
    }
    if (vehicle.status !== 'ACTIVE') {
      throw new ConflictException('Only ACTIVE vehicles can be assigned');
    }

    const assignedRider = riderId
      ? await this.prisma.rider.findFirst({
          where: { vehicleId, id: { not: riderId } },
          select: { id: true },
        })
      : await this.prisma.rider.findFirst({
          where: { vehicleId },
          select: { id: true },
        });

    if (assignedRider) {
      throw new ConflictException(
        'Vehicle is already assigned to another rider',
      );
    }
  }

  private async ensureAssignmentExists(id: string) {
    const assignment = await this.prisma.dailyAssignment.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!assignment) {
      throw new NotFoundException('Assignment not found');
    }
  }

  private toAssignmentDate(value: string): Date {
    return new Date(`${value}T00:00:00.000Z`);
  }

  private serializeCollectionRequest<
    T extends {
      latitude: number | string | { toString(): string } | null;
      longitude: number | string | { toString(): string } | null;
      rider: unknown;
      collection:
        | {
            weightKg: number | string | { toString(): string } | null;
          }
        | null;
    },
  >(request: T) {
    return {
      ...request,
      latitude: this.toNumber(request.latitude),
      longitude: this.toNumber(request.longitude),
      rider: request.rider ?? null,
      collection: request.collection
        ? {
            ...request.collection,
            weightKg: this.toNumber(request.collection.weightKg),
          }
        : null,
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

  async getDashboardStatistics() {
    const totalCollections = await this.prisma.collection.count();

    return { totalCollections };
  }

  async getLeaderboard(period?: string, date?: string) {
    const normalizedPeriod = this.normalizePeriod(period);
    const now = new Date();
    const dateRange =
      normalizedPeriod === 'date'
        ? this.parseBusinessDate(date)
        : undefined;
    const since =
      normalizedPeriod === 'month'
        ? new Date(now.getFullYear(), now.getMonth(), 1)
        : undefined;

    const grouped = await this.prisma.collection.groupBy({
      by: ['collectorId'],
      where: dateRange
        ? {
            collectedAt: {
              gte: dateRange.start,
              lt: dateRange.end,
            },
          }
        : since
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

  private normalizePeriod(period?: string): 'month' | 'date' | 'all' {
    const normalized = String(period ?? 'all').toLowerCase();
    if (normalized === 'month') {
      return 'month';
    }
    if (normalized === 'date') {
      return 'date';
    }
    return 'all';
  }

  private parseBusinessDate(
    date?: string,
  ): { start: Date; end: Date } | undefined {
    if (!date) {
      throw new BadRequestException('date is required when period=date');
    }

    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
    if (!match) {
      throw new BadRequestException('date must be in YYYY-MM-DD format');
    }

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);

    const start = new Date(Date.UTC(year, month - 1, day));
    if (
      start.getUTCFullYear() !== year ||
      start.getUTCMonth() !== month - 1 ||
      start.getUTCDate() !== day
    ) {
      throw new BadRequestException('date is not a valid calendar date');
    }

    return {
      start,
      end: new Date(Date.UTC(year, month - 1, day + 1)),
    };
  }

  private handleDatabaseError(
    error: unknown,
    entity: 'Collector' | 'Rider' | 'Vehicle' | 'Assignment',
  ): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      const target = Array.isArray(error.meta?.target)
        ? error.meta.target.join(',')
        : String(error.meta?.target ?? '');

      if (target.includes('login')) {
        throw new ConflictException('loginId already exists');
      }
      if (target.includes('nic')) {
        throw new ConflictException('NIC already exists');
      }
      if (target.includes('qr')) {
        throw new ConflictException('qrToken already exists');
      }
      if (target.includes('vehicle')) {
        throw new ConflictException('vehicleCode already exists');
      }
      if (
        entity === 'Assignment' &&
        (target.includes('assignment') ||
          (target.includes('collector') && target.includes('date')))
      ) {
        throw new ConflictException(
          'An assignment already exists for this collector and date',
        );
      }

      throw new ConflictException(
        `A ${entity.toLowerCase()} with these details already exists`,
      );
    }

    throw error;
  }
}
