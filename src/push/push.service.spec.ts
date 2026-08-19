import { BadRequestException } from '@nestjs/common';
import { PushService } from './push.service';

type MockPrisma = {
  pushSubscription: {
    upsert: jest.Mock;
    findMany: jest.Mock;
    deleteMany: jest.Mock;
    delete: jest.Mock;
  };
  user: {
    findMany: jest.Mock;
  };
  rider: {
    findUnique: jest.Mock;
  };
  collector: {
    findUnique: jest.Mock;
  };
};

describe('PushService', () => {
  let service: PushService;
  let prisma: MockPrisma;

  beforeEach(() => {
    prisma = {
      pushSubscription: {
        upsert: jest.fn(),
        findMany: jest.fn(),
        deleteMany: jest.fn(),
        delete: jest.fn(),
      },
      user: { findMany: jest.fn() },
      rider: { findUnique: jest.fn() },
      collector: { findUnique: jest.fn() },
    };

    process.env.VAPID_PUBLIC_KEY =
      'BBHTrOI7JsI4kqGWJZMArEXTIWRuBvgdL9yQYXLPIAdkRolwychnNe4PG6u3-bJ-aCq0g9z4suT6qJhiZbZzrMA';
    process.env.VAPID_PRIVATE_KEY =
      'LLLuRd8TwDeXq8k6Nx1u1C4_RgBg33yinLHpTuEGpPE';
    process.env.VAPID_SUBJECT = 'mailto:admin@neptune.app';

    service = new PushService(prisma as never);
    service.onModuleInit();
  });

  describe('subscribe', () => {
    it('creates a new subscription for the user', async () => {
      prisma.pushSubscription.upsert.mockResolvedValue({ id: 'sub-1' });

      const result = await service.subscribe('user-1', {
        platform: 'web',
        endpoint: 'https://push.example.com/abc',
        p256dh: 'p256dh-value',
        auth: 'auth-value',
      } as never);

      expect(result).toEqual({ ok: true });
      expect(prisma.pushSubscription.upsert).toHaveBeenCalledWith({
        where: { endpoint: 'https://push.example.com/abc' },
        update: {
          userId: 'user-1',
          platform: 'web',
          p256dh: 'p256dh-value',
          auth: 'auth-value',
        },
        create: {
          userId: 'user-1',
          platform: 'web',
          endpoint: 'https://push.example.com/abc',
          p256dh: 'p256dh-value',
          auth: 'auth-value',
        },
      });
    });
  });

  describe('unsubscribe', () => {
    it('deletes the subscription owned by the user', async () => {
      prisma.pushSubscription.deleteMany.mockResolvedValue({ count: 1 });

      const result = await service.unsubscribe(
        'user-1',
        'https://push.example.com/abc',
      );

      expect(result).toEqual({ ok: true });
      expect(prisma.pushSubscription.deleteMany).toHaveBeenCalledWith({
        where: { endpoint: 'https://push.example.com/abc', userId: 'user-1' },
      });
    });

    it('rejects an empty endpoint', async () => {
      await expect(
        service.unsubscribe('user-1', ''),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('sendPushNotifications', () => {
    it('does not send when VAPID is not configured', async () => {
      delete process.env.VAPID_PUBLIC_KEY;

      const unconfigured = new PushService(prisma as never);
      await unconfigured.sendPushNotifications('user-1', {
        title: 't',
        body: 'b',
        tag: 'tag',
      });

      expect(prisma.pushSubscription.findMany).not.toHaveBeenCalled();
    });

    it('sends to all subscriptions of the user', async () => {
      prisma.pushSubscription.findMany.mockResolvedValue([
        {
          id: 'sub-1',
          endpoint: 'https://push.example.com/abc',
          p256dh: 'p256dh-value',
          auth: 'auth-value',
        },
      ]);
      const webpush = require('web-push');
      const sendNotification = jest
        .spyOn(webpush, 'sendNotification')
        .mockResolvedValue({ statusCode: 201 });

      await service.sendPushNotifications('user-1', {
        title: 'Request accepted',
        body: 'A rider has accepted your collection request',
        tag: 'request-accepted',
      });

      expect(sendNotification).toHaveBeenCalledTimes(1);
      const [subscription, payload] = sendNotification.mock.calls[0];
      expect(subscription.endpoint).toBe('https://push.example.com/abc');
      expect(JSON.parse(payload as string)).toMatchObject({
        title: 'Request accepted',
        tag: 'request-accepted',
      });

      sendNotification.mockRestore();
    });

    it('removes stale subscriptions on 410 and keeps sending others', async () => {
      prisma.pushSubscription.findMany.mockResolvedValue([
        {
          id: 'sub-stale',
          endpoint: 'https://push.example.com/stale',
          p256dh: 'p256dh-value',
          auth: 'auth-value',
        },
        {
          id: 'sub-live',
          endpoint: 'https://push.example.com/live',
          p256dh: 'p256dh-value',
          auth: 'auth-value',
        },
      ]);
      prisma.pushSubscription.delete.mockResolvedValue({ id: 'sub-stale' });

      const webpush = require('web-push');
      const sendNotification = jest
        .spyOn(webpush, 'sendNotification')
        .mockImplementation((subscription: { endpoint: string }) => {
          if (subscription.endpoint.includes('stale')) {
            const error = new Error('gone');
            (error as { statusCode?: number }).statusCode = 410;
            return Promise.reject(error);
          }
          return Promise.resolve({ statusCode: 201 });
        });

      await service.sendPushNotifications('user-1', {
        title: 't',
        body: 'b',
        tag: 'tag',
      });

      expect(sendNotification).toHaveBeenCalledTimes(2);
      expect(prisma.pushSubscription.delete).toHaveBeenCalledWith({
        where: { id: 'sub-stale' },
      });

      sendNotification.mockRestore();
    });

    it('logs and continues on non-410 errors', async () => {
      prisma.pushSubscription.findMany.mockResolvedValue([
        {
          id: 'sub-1',
          endpoint: 'https://push.example.com/abc',
          p256dh: 'p256dh-value',
          auth: 'auth-value',
        },
      ]);

      const webpush = require('web-push');
      const sendNotification = jest
        .spyOn(webpush, 'sendNotification')
        .mockRejectedValue(new Error('network error'));

      await expect(
        service.sendPushNotifications('user-1', {
          title: 't',
          body: 'b',
          tag: 'tag',
        }),
      ).resolves.toBeUndefined();
      expect(prisma.pushSubscription.delete).not.toHaveBeenCalled();

      sendNotification.mockRestore();
    });
  });

  describe('notifyAllRiders', () => {
    it('sends to subscriptions of active rider users only', async () => {
      prisma.user.findMany.mockResolvedValue([{ id: 'rider-user-1' }]);
      prisma.pushSubscription.findMany.mockResolvedValue([
        {
          id: 'sub-1',
          endpoint: 'https://push.example.com/abc',
          p256dh: 'p256dh-value',
          auth: 'auth-value',
        },
      ]);

      const webpush = require('web-push');
      const sendNotification = jest
        .spyOn(webpush, 'sendNotification')
        .mockResolvedValue({ statusCode: 201 });

      await service.notifyAllRiders({
        title: 'New collection request',
        body: 'A collector nearby just posted a job',
        tag: 'new-request',
      });

      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: { role: 'RIDER', status: 'ACTIVE' },
        select: { id: true },
      });
      expect(sendNotification).toHaveBeenCalledTimes(1);

      sendNotification.mockRestore();
    });
  });

  describe('notifyCollector / notifyRider', () => {
    it('resolves the collector userId before sending', async () => {
      prisma.collector.findUnique.mockResolvedValue({ userId: 'user-c' });
      prisma.pushSubscription.findMany.mockResolvedValue([]);

      const webpush = require('web-push');
      const sendNotification = jest
        .spyOn(webpush, 'sendNotification')
        .mockResolvedValue({ statusCode: 201 });

      await service.notifyCollector('collector-1', {
        title: 't',
        body: 'b',
        tag: 'tag',
      });

      expect(prisma.collector.findUnique).toHaveBeenCalledWith({
        where: { id: 'collector-1' },
        select: { userId: true },
      });
      expect(prisma.pushSubscription.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-c', platform: 'web' },
      });

      sendNotification.mockRestore();
    });

    it('resolves the rider userId before sending', async () => {
      prisma.rider.findUnique.mockResolvedValue({ userId: 'user-r' });
      prisma.pushSubscription.findMany.mockResolvedValue([]);

      const webpush = require('web-push');
      const sendNotification = jest
        .spyOn(webpush, 'sendNotification')
        .mockResolvedValue({ statusCode: 201 });

      await service.notifyRider('rider-1', {
        title: 't',
        body: 'b',
        tag: 'tag',
      });

      expect(prisma.rider.findUnique).toHaveBeenCalledWith({
        where: { id: 'rider-1' },
        select: { userId: true },
      });

      sendNotification.mockRestore();
    });
  });
});