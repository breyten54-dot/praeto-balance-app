import { Injectable, NotFoundException } from '@nestjs/common';
import { request } from 'https';
import { PrismaService } from '../prisma/prisma.service';
import { generatePayfastSignature, rfc1738Encode } from './payfast.signature';
import type {
  CoachingAvailabilityResponse,
  CoachingBookingResponse,
  CreateBookingResponse,
} from './types';
import type { CreateBookingDto } from './dto/create-booking.dto';

const TIER_PRICES: Record<string, number> = {
  discovery: 0,
  starter: 190000,
  growth: 350000,
  transformation: 750000,
};

const TIER_LABELS: Record<string, string> = {
  discovery: 'Discovery',
  starter: 'Starter',
  growth: 'Growth',
  transformation: 'Transformation',
};

function payfastHost(mode: string): string {
  return mode === 'live' ? 'www.payfast.co.za' : 'sandbox.payfast.co.za';
}

@Injectable()
export class CoachingService {
  constructor(private readonly prisma: PrismaService) {}

  async getAvailability(): Promise<CoachingAvailabilityResponse> {
    const slots = await this.prisma.coachingSlot.findMany({
      where: { booked: false, startsAt: { gte: new Date() } },
      orderBy: { startsAt: 'asc' },
      select: { id: true, startsAt: true, endsAt: true },
    });

    return {
      slots: slots.map((s) => ({
        id: s.id,
        startsAt: s.startsAt.toISOString(),
        endsAt: s.endsAt.toISOString(),
      })),
    };
  }

  private getBaseUrls(): { apiPublicUrl: string; returnUrl: string; cancelUrl: string; notifyUrl: string } {
    const apiPublicUrl = process.env.API_PUBLIC_URL ?? `http://localhost:${process.env.PORT ?? 4000}`;
    return {
      apiPublicUrl,
      returnUrl: `${apiPublicUrl}/api/v1/payments/coaching-return`,
      cancelUrl: `${apiPublicUrl}/api/v1/payments/coaching-return`,
      notifyUrl: `${apiPublicUrl}/api/v1/webhooks/payfast/itn`,
    };
  }

  private buildCheckoutUrl(booking: { id: string; tier: string; priceCents: number }): string {
    const { returnUrl, cancelUrl, notifyUrl } = this.getBaseUrls();
    const merchantId = process.env.PAYFAST_MERCHANT_ID ?? '';
    const merchantKey = process.env.PAYFAST_MERCHANT_KEY ?? '';
    const passphrase = process.env.PAYFAST_PASSPHRASE ?? '';

    const fields: Record<string, string> = {
      merchant_id: merchantId,
      merchant_key: merchantKey,
      return_url: `${returnUrl}?bookingId=${booking.id}`,
      cancel_url: `${cancelUrl}?bookingId=${booking.id}&status=cancelled`,
      notify_url: notifyUrl,
      m_payment_id: booking.id,
      amount: (booking.priceCents / 100).toFixed(2),
      // ASCII-only: PayFast's signature validation is unreliable with
      // multi-byte characters (the em-dash here produced signature mismatches).
      item_name: `Praeto Balance - ${TIER_LABELS[booking.tier] ?? booking.tier}`,
    };

    const signature = generatePayfastSignature(fields, passphrase);
    fields.signature = signature;

    const query = Object.entries(fields)
      .map(([k, v]) => `${rfc1738Encode(k)}=${rfc1738Encode(v)}`)
      .join('&');

    return `https://${payfastHost(process.env.PAYFAST_MODE ?? 'sandbox')}/eng/process?${query}`;
  }

  async createBooking(userId: string, dto: CreateBookingDto): Promise<CreateBookingResponse> {
    const tier = dto.tier;
    const priceCents = TIER_PRICES[tier];
    const isDiscovery = tier === 'discovery';

    const booking = await this.prisma.coachingBooking.create({
      data: {
        userId,
        tier,
        priceCents,
        status: isDiscovery ? 'confirmed' : 'pending_payment',
      },
    });

    if (isDiscovery) {
      return {
        id: booking.id,
        tier: booking.tier,
        status: 'confirmed',
        checkoutUrl: null,
      };
    }

    return {
      id: booking.id,
      tier: booking.tier,
      status: 'awaiting_payment',
      checkoutUrl: this.buildCheckoutUrl(booking),
    };
  }

  async getBooking(userId: string, id: string): Promise<CoachingBookingResponse> {
    const booking = await this.prisma.coachingBooking.findFirst({
      where: { id, userId },
    });

    if (!booking) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Booking not found.' });
    }

    return {
      id: booking.id,
      tier: booking.tier,
      status: (booking.status === 'pending_payment' ? 'awaiting_payment' : booking.status) as CoachingBookingResponse['status'],
      priceCents: booking.priceCents,
    };
  }

  async verifyPostback(rawBody: string | Buffer): Promise<string> {
    const host = payfastHost(process.env.PAYFAST_MODE ?? 'sandbox');
    const bodyString = Buffer.isBuffer(rawBody) ? rawBody.toString() : rawBody;

    return new Promise((resolve) => {
      let settled = false;
      const settle = (value: string) => {
        if (!settled) {
          settled = true;
          resolve(value);
        }
      };

      const req = request(
        {
          hostname: host,
          path: '/eng/query/validate',
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': Buffer.byteLength(bodyString),
          },
        },
        (res) => {
          let data = '';
          res.on('data', (chunk) => {
            data += chunk;
          });
          res.on('end', () => {
            settle(data.trim());
          });
        },
      );

      // 10-second timeout: treat PayFast validation silence as postback_invalid.
      req.setTimeout(10000, () => {
        req.destroy();
        settle('postback_invalid');
      });
      req.on('error', () => settle('ERROR'));
      req.write(bodyString);
      req.end();
    });
  }

  async handleItn(
    rawBody: string | Buffer | undefined,
    parsedBody: Record<string, string>,
  ): Promise<void> {
    // Prefer the exact raw body. In test harnesses without { rawBody: true },
    // re-encode the parsed body as a last resort.
    const bodyForPostback =
      rawBody ??
      Object.entries(parsedBody)
        .map(([k, v]) => `${rfc1738Encode(k)}=${rfc1738Encode(v)}`)
        .join('&');

    const receivedSignature = parsedBody.signature;
    const bookingId = parsedBody.m_payment_id ?? null;
    const passphrase = process.env.PAYFAST_PASSPHRASE ?? '';

    const fieldsForSignature: Record<string, string> = {};
    for (const [key, value] of Object.entries(parsedBody)) {
      if (key !== 'signature') {
        fieldsForSignature[key] = value;
      }
    }

    const expectedSignature = generatePayfastSignature(fieldsForSignature, passphrase);

    if (!receivedSignature || receivedSignature !== expectedSignature) {
      await this.prisma.paymentNotification.create({
        data: {
          bookingId,
          rawBody: parsedBody as unknown as Record<string, string>,
          verdict: 'bad_signature',
        },
      });
      return;
    }

    const postbackResult = await this.verifyPostback(bodyForPostback);

    if (postbackResult !== 'VALID') {
      await this.prisma.paymentNotification.create({
        data: {
          bookingId,
          rawBody: parsedBody as unknown as Record<string, string>,
          verdict: 'postback_invalid',
        },
      });
      return;
    }

    const booking = bookingId
      ? await this.prisma.coachingBooking.findUnique({ where: { id: bookingId } })
      : null;

    if (!booking) {
      await this.prisma.paymentNotification.create({
        data: {
          bookingId,
          rawBody: parsedBody as unknown as Record<string, string>,
          verdict: 'unknown_booking',
        },
      });
      return;
    }

    const amountGrossCents = Math.round(parseFloat(parsedBody.amount_gross ?? '0') * 100);

    if (amountGrossCents !== booking.priceCents) {
      await this.prisma.paymentNotification.create({
        data: {
          bookingId,
          rawBody: parsedBody as unknown as Record<string, string>,
          verdict: 'amount_mismatch',
        },
      });
      return;
    }

    const status = parsedBody.payment_status;
    let verdict: string;
    let newStatus: string | undefined;

    if (status === 'COMPLETE') {
      newStatus = 'confirmed';
      verdict = 'valid';
    } else if (status === 'CANCELLED') {
      newStatus = 'cancelled';
      verdict = 'valid';
    } else {
      verdict = 'valid';
    }

    await this.prisma.$transaction([
      this.prisma.coachingBooking.update({
        where: { id: booking.id },
        data: {
          status: newStatus ?? booking.status,
          payfastPaymentId: parsedBody.pf_payment_id ?? booking.payfastPaymentId,
        },
      }),
      this.prisma.paymentNotification.create({
        data: {
          bookingId,
          rawBody: parsedBody as unknown as Record<string, string>,
          verdict,
        },
      }),
    ]);
  }
}
