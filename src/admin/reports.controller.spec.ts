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