import {
  BadRequestException,
  Injectable,
  OnModuleInit,
} from '@nestjs/common';
import * as webPush from 'web-push';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePushSubscriptionDto } from './dto/create-push-subscription.dto';

export interface PushNotificationPayload {
  title: string;
  body: string;
  tag: string;
}

const NOTIFICATION_ICON =
  'https://web-two-ebon-72.vercel.app/icons/Icon-192.png';
const NOTIFICATION_URL = 'https://web-two-ebon-72.vercel.app';

@Injectable()
export class PushService implements OnModuleInit {
  private vapidConfigured = false;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env;
    if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY && VAPID_SUBJECT) {
      webPush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
      this.vapidConfigured = true;
    } else {
      console.warn(
        'VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY/VAPID_SUBJECT not set - web push sending disabled',
      );
    }
  }

  async subscribe(userId: string, dto: CreatePushSubscriptionDto) {
    await this.prisma.pushSubscription.upsert({
      where: { endpoint: dto.endpoint },
      update: {
        userId,
        platform: dto.platform,
        p256dh: dto.p256dh,
        auth: dto.auth,
      },
      create: {
        userId,
        platform: dto.platform,
        endpoint: dto.endpoint,
        p256dh: dto.p256dh,
        auth: dto.auth,
      },
    });

    return { ok: true };
  }

  async unsubscribe(userId: string, endpoint: string) {
    if (typeof endpoint !== 'string' || endpoint.trim() === '') {
      throw new BadRequestException('endpoint is required');
    }
    await this.prisma.pushSubscription.deleteMany({
      where: { endpoint, userId },
    });

    return { ok: true };
  }

  async sendPushNotifications(
    userId: string,
    payload: PushNotificationPayload,
  ) {
    if (!this.vapidConfigured) {
      return;
    }

    const subscriptions = await this.prisma.pushSubscription.findMany({
      where: { userId, platform: 'web' },
    });

    await this.sendToSubscriptions(subscriptions, payload);
  }

  async notifyAllRiders(payload: PushNotificationPayload) {
    if (!this.vapidConfigured) {
      return;
    }

    const riderUserIds = await this.prisma.user.findMany({
      where: { role: 'RIDER', status: 'ACTIVE' },
      select: { id: true },
    });

    if (riderUserIds.length === 0) {
      return;
    }

    const subscriptions = await this.prisma.pushSubscription.findMany({
      where: {
        platform: 'web',
        userId: { in: riderUserIds.map((rider) => rider.id) },
      },
    });

    await this.sendToSubscriptions(subscriptions, payload);
  }

  async notifyRider(riderId: string, payload: PushNotificationPayload) {
    const rider = await this.prisma.rider.findUnique({
      where: { id: riderId },
      select: { userId: true },
    });

    if (rider) {
      await this.sendPushNotifications(rider.userId, payload);
    }
  }

  async notifyCollector(
    collectorId: string,
    payload: PushNotificationPayload,
  ) {
    const collector = await this.prisma.collector.findUnique({
      where: { id: collectorId },
      select: { userId: true },
    });

    if (collector) {
      await this.sendPushNotifications(collector.userId, payload);
    }
  }

  private async sendToSubscriptions(
    subscriptions: Array<{
      id: string;
      endpoint: string;
      p256dh: string;
      auth: string;
    }>,
    payload: PushNotificationPayload,
  ) {
    const serializedPayload = JSON.stringify({
      title: payload.title,
      body: payload.body,
      tag: payload.tag,
      icon: NOTIFICATION_ICON,
      badge: NOTIFICATION_ICON,
      vibrate: [200, 100, 200],
      url: NOTIFICATION_URL,
    });

    for (const subscription of subscriptions) {
      try {
        await webPush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: {
              p256dh: subscription.p256dh,
              auth: subscription.auth,
            },
          },
          serializedPayload,
        );
      } catch (error) {
        if (error?.statusCode === 404 || error?.statusCode === 410) {
          console.warn(
            `Removing stale push subscription ${subscription.id}`,
            error.message,
          );
          await this.prisma.pushSubscription
            .delete({ where: { id: subscription.id } })
            .catch(() => undefined);
        } else {
          console.warn(
            `Push notification failed for subscription ${subscription.id}`,
            error?.message ?? error,
          );
        }
      }
    }
  }
}