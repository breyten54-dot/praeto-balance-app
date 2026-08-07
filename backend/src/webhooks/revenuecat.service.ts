import { Injectable, UnauthorizedException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import * as crypto from 'crypto';

const TIER_UPGRADE_EVENTS = new Set([
  'INITIAL_PURCHASE',
  'RENEWAL',
  'UNCANCELLATION',
  'PRODUCT_CHANGE',
]);
const TIER_DOWNGRADE_EVENTS = new Set(['EXPIRATION']);

function secureCompare(a: string, b: string): boolean {
  // Pad both values to the same length so timingSafeEqual can be used
  // regardless of whether the supplied header is shorter or longer than secret.
  const length = Math.max(a.length, b.length);
  const bufA = Buffer.alloc(length, 0);
  const bufB = Buffer.alloc(length, 0);
  bufA.write(a);
  bufB.write(b);
  try {
    return crypto.timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

export interface RevenueCatEvent {
  id: string;
  type: string;
  app_user_id?: string;
  product_id?: string;
  purchased_at_ms?: number;
  expiration_at_ms?: number;
  store?: string;
  environment?: string;
  [key: string]: unknown;
}

@Injectable()
export class RevenueCatService {
  constructor(private readonly prisma: PrismaService) {}

  async handleWebhook(
    authorization: string | undefined,
    payload: { api_version?: string; event?: RevenueCatEvent },
  ): Promise<{ received: true; duplicate?: true }> {
    const secret = process.env.REVENUECAT_WEBHOOK_AUTH ?? '';
    const header = authorization ?? '';

    if (!secret || !secureCompare(header, secret)) {
      throw new UnauthorizedException({
        code: 'WEBHOOK_INVALID',
        message: 'Invalid webhook authorization.',
      });
    }

    const event = payload?.event;
    const eventId = event?.id;
    const eventType = event?.type;

    if (!eventId || !eventType) {
      // RevenueCat retries on failures; malformed events should not block the queue.
      return { received: true };
    }

    const existing = await this.prisma.subscriptionEvent.findUnique({
      where: { eventId },
    });
    if (existing) {
      return { received: true, duplicate: true };
    }

    const appUserId = event.app_user_id;
    const user = appUserId
      ? await this.prisma.user.findUnique({ where: { id: appUserId } })
      : null;

    let verdict: 'processed' | 'recorded' | 'unknown_user' = 'recorded';

    if (!user) {
      verdict = 'unknown_user';
    } else if (TIER_UPGRADE_EVENTS.has(eventType)) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { subscriptionTier: 'premium' },
      });
      verdict = 'processed';
    } else if (TIER_DOWNGRADE_EVENTS.has(eventType)) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { subscriptionTier: 'free' },
      });
      verdict = 'processed';
    }

    try {
      await this.prisma.subscriptionEvent.create({
        data: {
          eventId,
          type: eventType,
          appUserId: appUserId ?? '',
          verdict,
          rawEvent: event as never,
        },
      });
    } catch (err) {
      // Concurrent redelivery of the same event id can lose the dedupe race and
      // hit the unique constraint. Respond duplicate:true so RevenueCat stops retrying.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        return { received: true, duplicate: true };
      }
      throw err;
    }

    return { received: true };
  }
}
