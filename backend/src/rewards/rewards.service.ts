import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { RewardsSummaryResponse, RedemptionResponse, PartnerLinkResponse } from './types';

const VALID_PARTNERS = ['momentum_multiply', 'discovery_vitality'] as const;
const PARTNER_LINK_BONUS = 100;

@Injectable()
export class RewardsService {
  constructor(private readonly prisma: PrismaService) {}

  private async getPoints(userId: string): Promise<{ balance: number; lifetime: number }> {
    const rows = await this.prisma.pointsLedger.findMany({
      where: { userId },
      select: { delta: true },
    });

    const balance = rows.reduce((sum, r) => sum + r.delta, 0);
    const lifetime = rows.filter((r) => r.delta > 0).reduce((sum, r) => sum + r.delta, 0);
    return { balance, lifetime };
  }

  async getSummary(userId: string): Promise<RewardsSummaryResponse> {
    const [points, linkedPartners, offers] = await Promise.all([
      this.getPoints(userId),
      this.prisma.partnerLink.findMany({
        where: { userId },
        orderBy: { linkedAt: 'asc' },
        select: { partner: true, linkedAt: true },
      }),
      this.prisma.rewardOffer.findMany({
        where: { active: true },
        orderBy: { pointsCost: 'asc' },
        select: { id: true, title: true, partner: true, pointsCost: true, category: true },
      }),
    ]);

    return {
      pointsBalance: points.balance,
      lifetimePoints: points.lifetime,
      linkedPartners: linkedPartners.map((p) => ({
        partner: p.partner,
        linkedAt: p.linkedAt.toISOString(),
      })),
      availableOffers: offers.map((o) => ({
        id: o.id,
        title: o.title,
        partner: o.partner,
        pointsCost: o.pointsCost,
        category: o.category as RewardsSummaryResponse['availableOffers'][number]['category'],
      })),
    };
  }

  async redeem(userId: string, offerId: string): Promise<RedemptionResponse> {
    const offer = await this.prisma.rewardOffer.findUnique({
      where: { id: offerId },
    });

    if (!offer || !offer.active) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: `Offer '${offerId}' not found.`,
      });
    }

    const { balance } = await this.getPoints(userId);

    if (balance < offer.pointsCost) {
      const needed = offer.pointsCost - balance;
      throw new BadRequestException({
        code: 'INSUFFICIENT_POINTS',
        message: `You need ${needed} more points for this reward.`,
      });
    }

    const [, redemption] = await this.prisma.$transaction([
      this.prisma.pointsLedger.create({
        data: {
          userId,
          delta: -offer.pointsCost,
          reason: 'redeem',
          refId: offerId,
        },
      }),
      this.prisma.redemption.create({
        data: {
          userId,
          offerId,
          pointsSpent: offer.pointsCost,
        },
      }),
    ]);

    return {
      redemptionId: redemption.id,
      offerId,
      pointsSpent: offer.pointsCost,
      newBalance: balance - offer.pointsCost,
    };
  }

  async linkPartner(userId: string, partner: string): Promise<PartnerLinkResponse> {
    if (!VALID_PARTNERS.includes(partner as (typeof VALID_PARTNERS)[number])) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: `Partner must be one of ${VALID_PARTNERS.join(', ')}.`,
      });
    }

    const existing = await this.prisma.partnerLink.findUnique({
      where: { userId_partner: { userId, partner } },
    });

    if (existing) {
      return {
        partner: existing.partner,
        linkedAt: existing.linkedAt.toISOString(),
      };
    }

    const link = await this.prisma.$transaction(async (tx) => {
      const created = await tx.partnerLink.create({
        data: { userId, partner },
      });

      await tx.pointsLedger.create({
        data: {
          userId,
          delta: PARTNER_LINK_BONUS,
          reason: 'partner_link_bonus',
          refId: partner,
        },
      });

      return created;
    });

    return {
      partner: link.partner,
      linkedAt: link.linkedAt.toISOString(),
    };
  }
}
