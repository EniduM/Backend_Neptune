import {
  BadRequestException,
  ValidationPipe,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { ROLES_KEY } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CollectionRequestsReportQueryDto } from './dto/collection-requests-report-query.dto';
import { CollectionsReportQueryDto } from './dto/collections-report-query.dto';
import { ReportsQueryDto } from './dto/reports-query.dto';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

describe('ReportsController – authentication and authorization', () => {
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
  });

  it('requires the ADMIN role at controller level', () => {
    expect(
      reflector.getAllAndOverride<string[]>(ROLES_KEY, [ReportsController]),
    ).toEqual(['ADMIN']);
  });

  it('applies the JWT and role guards to every report endpoint', () => {
    const guards = reflector.getAllAndOverride<
      Array<{ new (...args: unknown[]): unknown }>
    >('__guards__', [ReportsController]);

    expect(guards).toEqual([JwtAuthGuard, RolesGuard]);
  });

  it('allows ADMIN users through the role guard', () => {
    const guard = new RolesGuard(reflector);
    const context = {
      getHandler: () => ReportsController.prototype.collectionsReport,
      getClass: () => ReportsController,
      switchToHttp: () => ({
        getRequest: () => ({ user: { role: 'ADMIN' } }),
      }),
    } as never;

    expect(guard.canActivate(context)).toBe(true);
  });

  it('blocks collector and rider users from report endpoints', () => {
    const guard = new RolesGuard(reflector);

    for (const role of ['COLLECTOR', 'RIDER']) {
      const context = {
        getHandler: () => ReportsController.prototype.collectionsReport,
        getClass: () => ReportsController,
        switchToHttp: () => ({
          getRequest: () => ({ user: { role } }),
        }),
      } as never;

      expect(guard.canActivate(context)).toBe(false);
    }
  });

  it('blocks unauthenticated requests', () => {
    const guard = new RolesGuard(reflector);
    const context = {
      getHandler: () => ReportsController.prototype.collectionsReport,
      getClass: () => ReportsController,
      switchToHttp: () => ({ getRequest: () => ({}) }),
    } as never;

    expect(guard.canActivate(context)).toBe(false);
  });
});

describe('ReportsController – query validation', () => {
  let pipe: ValidationPipe;
  let service: { getCollectionsReport: jest.Mock };

  beforeEach(() => {
    pipe = new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    });
    service = {
      getCollectionsReport: jest.fn().mockResolvedValue({ data: [], summary: {} }),
    };
  });

  it('rejects an invalid UUID filter', async () => {
    await expect(
      pipe.transform(
        { vehicleId: 'not-a-uuid' },
        { type: 'query', metatype: CollectionsReportQueryDto },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects an invalid status filter', async () => {
    await expect(
      pipe.transform(
        { status: 'BOGUS' },
        { type: 'query', metatype: CollectionRequestsReportQueryDto },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects an invalid date filter', async () => {
    await expect(
      pipe.transform(
        { from: '2026-13-99' },
        { type: 'query', metatype: CollectionRequestsReportQueryDto },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects unknown query parameters', async () => {
    await expect(
      pipe.transform(
        { area: 'Kandy' },
        { type: 'query', metatype: CollectionsReportQueryDto },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('accepts a valid query and forwards it to the service', async () => {
    const controller = new ReportsController(service as never);

    await controller.collectionsReport({ from: '2026-08-01' } as never);

    expect(service.getCollectionsReport).toHaveBeenCalledWith({
      from: '2026-08-01',
    });
  });
});
describe('ReportsController – unified /admin/reports?type= dispatcher', () => {
  let service: {
    getCollectionsReport: jest.Mock;
    getCollectionRequestsReport: jest.Mock;
    getCollectorsReport: jest.Mock;
    getRidersReport: jest.Mock;
    getVehiclesReport: jest.Mock;
    getAssignmentsReport: jest.Mock;
  };
  let controller: ReportsController;

  beforeEach(() => {
    service = {
      getCollectionsReport: jest.fn().mockResolvedValue({ data: [], summary: {} }),
      getCollectionRequestsReport: jest
        .fn()
        .mockResolvedValue({ data: [], summary: {} }),
      getCollectorsReport: jest.fn().mockResolvedValue({ data: [], summary: {} }),
      getRidersReport: jest.fn().mockResolvedValue({ data: [], summary: {} }),
      getVehiclesReport: jest.fn().mockResolvedValue({ data: [], summary: {} }),
      getAssignmentsReport: jest.fn().mockResolvedValue({ data: [], summary: {} }),
    };
    controller = new ReportsController(service as never);
  });

  it('dispatches type=collection to the collections report', async () => {
    await controller.reports({
      type: 'collection',
      from: '2026-08-01',
      collectorId: 'c1',
    } as ReportsQueryDto);

    expect(service.getCollectionsReport).toHaveBeenCalledWith({
      from: '2026-08-01',
      collectorId: 'c1',
    });
    expect(service.getRidersReport).not.toHaveBeenCalled();
  });

  it('dispatches type=request to the collection-requests report', async () => {
    await controller.reports({
      type: 'request',
      status: 'COMPLETED',
      riderId: 'r1',
    } as ReportsQueryDto);

    expect(service.getCollectionRequestsReport).toHaveBeenCalledWith({
      status: 'COMPLETED',
      riderId: 'r1',
    });
  });

  it('dispatches collector, rider, vehicle and assignment types', async () => {
    await controller.reports({ type: 'collector' } as ReportsQueryDto);
    await controller.reports({ type: 'rider', vehicleId: 'v1' } as ReportsQueryDto);
    await controller.reports({ type: 'vehicle', status: 'ACTIVE' } as ReportsQueryDto);
    await controller.reports({
      type: 'assignment',
      to: '2026-08-31',
    } as ReportsQueryDto);

    expect(service.getCollectorsReport).toHaveBeenCalledWith({});
    expect(service.getRidersReport).toHaveBeenCalledWith({ vehicleId: 'v1' });
    expect(service.getVehiclesReport).toHaveBeenCalledWith({ status: 'ACTIVE' });
    expect(service.getAssignmentsReport).toHaveBeenCalledWith({
      to: '2026-08-31',
    });
  });

  it('rejects an unknown type via the shared ValidationPipe', async () => {
    const pipe = new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    });

    await expect(
      pipe.transform(
        { type: 'invoices' },
        { type: 'query', metatype: ReportsQueryDto },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a missing type', async () => {
    const pipe = new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    });

    await expect(
      pipe.transform({}, { type: 'query', metatype: ReportsQueryDto }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
