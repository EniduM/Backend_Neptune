import { ConflictException } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { RiderService } from './rider.service';

type MockPrisma = {
  rider: {
    findUnique: jest.Mock;
  };
  collectionRequest: {
    findMany: jest.Mock;
    findUnique: jest.Mock;
    findFirst: jest.Mock;
    updateMany: jest.Mock;
    update: jest.Mock;
  };
  collector: {
    findUnique: jest.Mock;
  };
  vehicle: {
    findMany: jest.Mock;
    findUnique: jest.Mock;
  };
  $transaction: jest.Mock;
};

function createPrisma(): MockPrisma {
  return {
    rider: { findUnique: jest.fn() },
    collectionRequest: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      updateMany: jest.fn(),
      update: jest.fn(),
    },
    collector: { findUnique: jest.fn() },
    vehicle: { findMany: jest.fn(), findUnique: jest.fn() },
    $transaction: jest.fn(),
  };
}

function createTx(prisma: MockPrisma) {
  return {
    collectionRequest: {
      findUnique: prisma.collectionRequest.findUnique,
      update: prisma.collectionRequest.update,
    },
    collection: {
      create: jest.fn(),
    },
    vehicle: {
      findUnique: prisma.vehicle.findUnique,
    },
  };
}

describe('RiderService', () => {
  let service: RiderService;
  let prisma: MockPrisma;

  beforeEach(() => {
    prisma = createPrisma();
    service = new RiderService(
      prisma as never,
      { notifyCollector: jest.fn().mockResolvedValue(undefined) } as never,
    );
  });

  describe('completeRequest', () => {
    it('creates a Collection record and marks the request COMPLETED', async () => {
      prisma.rider.findUnique.mockResolvedValue({ id: 'rider-1' });

      const tx = createTx(prisma);
      tx.collectionRequest.findUnique.mockResolvedValue({
        id: 'req-1',
        collectorId: 'collector-1',
        riderId: 'rider-1',
        status: 'ACCEPTED',
        qrVerified: true,
      });
      tx.collection.create.mockResolvedValue({
        id: 'col-1',
        collectionRequestId: 'req-1',
        collectorId: 'collector-1',
        riderId: 'rider-1',
        vehicleId: 'vehicle-1',
        weightKg: { toString: () => '25.50' },
        collectedAt: new Date('2026-08-17T10:00:00.000Z'),
      });
      tx.collectionRequest.update.mockResolvedValue({
        id: 'req-1',
        status: 'COMPLETED',
        completedAt: new Date('2026-08-17T10:00:00.000Z'),
      });
      prisma.vehicle.findUnique.mockResolvedValue({
        id: 'vehicle-1',
        status: 'ACTIVE',
      });

      prisma.$transaction.mockImplementation(
        async (
          fn: (
            tx: typeof createTx extends () => infer R ? R : never,
          ) => Promise<unknown>,
        ) => fn(tx as never),
      );

      const result = await service.completeRequest('user-1', 'req-1', {
        vehicleId: 'vehicle-1',
        weightKg: 25.5,
      });

      expect(tx.collection.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            collectorId: 'collector-1',
            riderId: 'rider-1',
            vehicleId: 'vehicle-1',
            weightKg: 25.5,
          }),
        }),
      );
      expect(tx.collectionRequest.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'req-1' },
          data: expect.objectContaining({ status: 'COMPLETED' }),
        }),
      );
      expect(result).toHaveProperty('request');
      expect(result).toHaveProperty('collection');
    });

    it('rejects completion when request is not in ACCEPTED status', async () => {
      prisma.rider.findUnique.mockResolvedValue({ id: 'rider-1' });

      const tx = createTx(prisma);
      tx.collectionRequest.findUnique.mockResolvedValue({
        id: 'req-1',
        collectorId: 'collector-1',
        riderId: 'rider-1',
        status: 'PENDING',
      });
      prisma.vehicle.findUnique.mockResolvedValue({
        id: 'vehicle-1',
        status: 'ACTIVE',
      });
      prisma.$transaction.mockImplementation(
        async (
          fn: (
            tx: typeof createTx extends () => infer R ? R : never,
          ) => Promise<unknown>,
        ) => fn(tx as never),
      );

      await expect(
        service.completeRequest('user-1', 'req-1', {
          vehicleId: 'vehicle-1',
          weightKg: 10,
        }),
      ).rejects.toThrow('Only accepted requests can be completed');
    });

    it('rejects completion when rider does not own the request', async () => {
      prisma.rider.findUnique.mockResolvedValue({ id: 'rider-2' });

      const tx = createTx(prisma);
      tx.collectionRequest.findUnique.mockResolvedValue({
        id: 'req-1',
        collectorId: 'collector-1',
        riderId: 'rider-1',
        status: 'ACCEPTED',
      });
      prisma.vehicle.findUnique.mockResolvedValue({
        id: 'vehicle-1',
        status: 'ACTIVE',
      });
      prisma.$transaction.mockImplementation(
        async (
          fn: (
            tx: typeof createTx extends () => infer R ? R : never,
          ) => Promise<unknown>,
        ) => fn(tx as never),
      );

      await expect(
        service.completeRequest('user-2', 'req-1', {
          vehicleId: 'vehicle-1',
          weightKg: 10,
        }),
      ).rejects.toThrow(
        'This request was not accepted by the authenticated rider',
      );
    });

    it('rejects completion when vehicle is inactive', async () => {
      prisma.rider.findUnique.mockResolvedValue({ id: 'rider-1' });

      const tx = createTx(prisma);
      tx.collectionRequest.findUnique.mockResolvedValue({
        id: 'req-1',
        collectorId: 'collector-1',
        riderId: 'rider-1',
        status: 'ACCEPTED',
        qrVerified: true,
      });
      prisma.vehicle.findUnique.mockResolvedValue({
        id: 'vehicle-1',
        status: 'INACTIVE',
      });
      prisma.$transaction.mockImplementation(
        async (
          fn: (
            tx: typeof createTx extends () => infer R ? R : never,
          ) => Promise<unknown>,
        ) => fn(tx as never),
      );

      await expect(
        service.completeRequest('user-1', 'req-1', {
          vehicleId: 'vehicle-1',
          weightKg: 10,
        }),
      ).rejects.toThrow('Vehicle is inactive');
    });

    it('rejects completion when vehicle does not exist', async () => {
      prisma.rider.findUnique.mockResolvedValue({ id: 'rider-1' });

      const tx = createTx(prisma);
      tx.collectionRequest.findUnique.mockResolvedValue({
        id: 'req-1',
        collectorId: 'collector-1',
        riderId: 'rider-1',
        status: 'ACCEPTED',
        qrVerified: true,
      });
      prisma.vehicle.findUnique.mockResolvedValue(null);
      prisma.$transaction.mockImplementation(
        async (
          fn: (
            tx: typeof createTx extends () => infer R ? R : never,
          ) => Promise<unknown>,
        ) => fn(tx as never),
      );

      await expect(
        service.completeRequest('user-1', 'req-1', {
          vehicleId: 'nonexistent',
          weightKg: 10,
        }),
      ).rejects.toThrow('Vehicle not found');
    });

    it('rejects completion when request does not exist', async () => {
      prisma.rider.findUnique.mockResolvedValue({ id: 'rider-1' });

      const tx = createTx(prisma);
      tx.collectionRequest.findUnique.mockResolvedValue(null);
      prisma.vehicle.findUnique.mockResolvedValue({
        id: 'vehicle-1',
        status: 'ACTIVE',
      });
      prisma.$transaction.mockImplementation(
        async (
          fn: (
            tx: typeof createTx extends () => infer R ? R : never,
          ) => Promise<unknown>,
        ) => fn(tx as never),
      );

      await expect(
        service.completeRequest('user-1', 'nonexistent', {
          vehicleId: 'vehicle-1',
          weightKg: 10,
        }),
      ).rejects.toThrow('Collection request not found');
    });

    it('prevents duplicate completion via P2002 unique constraint', async () => {
      prisma.rider.findUnique.mockResolvedValue({ id: 'rider-1' });

      const tx = createTx(prisma);
      tx.collectionRequest.findUnique.mockResolvedValue({
        id: 'req-1',
        collectorId: 'collector-1',
        riderId: 'rider-1',
        status: 'ACCEPTED',
        qrVerified: true,
      });
      prisma.vehicle.findUnique.mockResolvedValue({
        id: 'vehicle-1',
        status: 'ACTIVE',
      });

      const p2002Error = new Prisma.PrismaClientKnownRequestError(
        'Unique constraint',
        {
          code: 'P2002',
          clientVersion: '0.0.0',
          meta: { target: ['collection_request_id'] },
        },
      );
      tx.collection.create.mockRejectedValue(p2002Error);

      prisma.$transaction.mockImplementation(
        async (
          fn: (
            tx: typeof createTx extends () => infer R ? R : never,
          ) => Promise<unknown>,
        ) => fn(tx as never),
      );

      await expect(
        service.completeRequest('user-1', 'req-1', {
          vehicleId: 'vehicle-1',
          weightKg: 10,
        }),
      ).rejects.toThrow('Collection request has already been completed');
    });

    it('rejects completion when QR has not been verified', async () => {
      prisma.rider.findUnique.mockResolvedValue({ id: 'rider-1' });

      const tx = createTx(prisma);
      tx.collectionRequest.findUnique.mockResolvedValue({
        id: 'req-1',
        collectorId: 'collector-1',
        riderId: 'rider-1',
        status: 'ACCEPTED',
        qrVerified: false,
      });
      prisma.vehicle.findUnique.mockResolvedValue({
        id: 'vehicle-1',
        status: 'ACTIVE',
      });
      prisma.$transaction.mockImplementation(
        async (
          fn: (
            tx: typeof createTx extends () => infer R ? R : never,
          ) => Promise<unknown>,
        ) => fn(tx as never),
      );

      await expect(
        service.completeRequest('user-1', 'req-1', {
          vehicleId: 'vehicle-1',
          weightKg: 10,
        }),
      ).rejects.toThrow(
        'QR verification is required before completing a collection request',
      );
    });
  });

  describe('acceptRequest', () => {
    it('assigns the rider and sets status to ACCEPTED', async () => {
      prisma.rider.findUnique.mockResolvedValue({ id: 'rider-1' });
      prisma.collectionRequest.findUnique.mockResolvedValueOnce({
        id: 'req-1',
        status: 'PENDING',
      });
      prisma.collectionRequest.updateMany.mockResolvedValue({ count: 1 });
      prisma.collectionRequest.findUnique.mockResolvedValueOnce({
        id: 'req-1',
        status: 'ACCEPTED',
        riderId: 'rider-1',
      });

      const result = await service.acceptRequest('user-1', 'req-1');

      expect(prisma.collectionRequest.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'ACCEPTED',
            riderId: 'rider-1',
          }),
        }),
      );
      expect(result.status).toBe('ACCEPTED');
    });

    it('rejects when request is not PENDING', async () => {
      prisma.rider.findUnique.mockResolvedValue({ id: 'rider-1' });
      prisma.collectionRequest.findUnique.mockResolvedValue({
        id: 'req-1',
        status: 'ACCEPTED',
      });

      await expect(service.acceptRequest('user-1', 'req-1')).rejects.toThrow(
        'Only pending requests can be accepted',
      );
    });

    it('rejects when request does not exist', async () => {
      prisma.rider.findUnique.mockResolvedValue({ id: 'rider-1' });
      prisma.collectionRequest.findUnique.mockResolvedValue(null);

      await expect(
        service.acceptRequest('user-1', 'nonexistent'),
      ).rejects.toThrow('Collection request not found');
    });
  });

  describe('verifyQrToken', () => {
    it('marks the request as QR verified when token matches', async () => {
      prisma.rider.findUnique.mockResolvedValue({ id: 'rider-1' });
      prisma.collectionRequest.findUnique.mockResolvedValue({
        id: 'req-1',
        collectorId: 'collector-1',
        riderId: 'rider-1',
        status: 'ACCEPTED',
      });
      prisma.collector.findUnique.mockResolvedValue({
        qrToken: 'QR-TOKEN-123',
      });
      prisma.collectionRequest.update.mockResolvedValue({
        id: 'req-1',
        qrVerified: true,
        status: 'ACCEPTED',
      });

      const result = await service.verifyQrToken(
        'user-1',
        'req-1',
        'QR-TOKEN-123',
      );

      expect(prisma.collectionRequest.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'req-1' },
          data: { qrVerified: true },
        }),
      );
      expect(result.qrVerified).toBe(true);
    });

    it('rejects when QR token does not match', async () => {
      prisma.rider.findUnique.mockResolvedValue({ id: 'rider-1' });
      prisma.collectionRequest.findUnique.mockResolvedValue({
        id: 'req-1',
        collectorId: 'collector-1',
        riderId: 'rider-1',
        status: 'ACCEPTED',
      });
      prisma.collector.findUnique.mockResolvedValue({
        qrToken: 'QR-TOKEN-123',
      });

      await expect(
        service.verifyQrToken('user-1', 'req-1', 'WRONG-TOKEN'),
      ).rejects.toThrow(
        'QR token does not match the collector for this request',
      );
    });

    it('rejects with a ConflictException when token does not match', async () => {
      prisma.rider.findUnique.mockResolvedValue({ id: 'rider-1' });
      prisma.collectionRequest.findUnique.mockResolvedValue({
        id: 'req-1',
        collectorId: 'collector-1',
        riderId: 'rider-1',
        status: 'ACCEPTED',
      });
      prisma.collector.findUnique.mockResolvedValue({
        qrToken: 'QR-TOKEN-123',
      });

      await expect(
        service.verifyQrToken('user-1', 'req-1', 'WRONG-TOKEN'),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('rejects when request is not in ACCEPTED status', async () => {
      prisma.rider.findUnique.mockResolvedValue({ id: 'rider-1' });
      prisma.collectionRequest.findUnique.mockResolvedValue({
        id: 'req-1',
        collectorId: 'collector-1',
        riderId: 'rider-1',
        status: 'PENDING',
      });

      await expect(
        service.verifyQrToken('user-1', 'req-1', 'QR-TOKEN-123'),
      ).rejects.toThrow('QR verification requires ACCEPTED status');
    });

    it('rejects when rider does not own the request', async () => {
      prisma.rider.findUnique.mockResolvedValue({ id: 'rider-2' });
      prisma.collectionRequest.findUnique.mockResolvedValue({
        id: 'req-1',
        collectorId: 'collector-1',
        riderId: 'rider-1',
        status: 'ACCEPTED',
      });

      await expect(
        service.verifyQrToken('user-2', 'req-1', 'QR-TOKEN-123'),
      ).rejects.toThrow(
        'This request was not accepted by the authenticated rider',
      );
    });

    it('rejects when request does not exist', async () => {
      prisma.rider.findUnique.mockResolvedValue({ id: 'rider-1' });
      prisma.collectionRequest.findUnique.mockResolvedValue(null);

      await expect(
        service.verifyQrToken('user-1', 'nonexistent', 'QR-TOKEN-123'),
      ).rejects.toThrow('Collection request not found');
    });
  });

  describe('findVehicles', () => {
    it('returns all active vehicles', async () => {
      prisma.vehicle.findMany.mockResolvedValue([
        {
          id: 'v1',
          vehicleCode: 'VEH-001',
          vehicleType: 'Tricycle',
          status: 'ACTIVE',
        },
        {
          id: 'v2',
          vehicleCode: 'VEH-002',
          vehicleType: 'Van',
          status: 'ACTIVE',
        },
      ]);

      const result = await service.findVehicles();

      expect(result).toHaveLength(2);
      expect(prisma.vehicle.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: 'ACTIVE' },
        }),
      );
    });

    it('returns empty array when no vehicles exist', async () => {
      prisma.vehicle.findMany.mockResolvedValue([]);

      const result = await service.findVehicles();

      expect(result).toHaveLength(0);
    });
  });
});
