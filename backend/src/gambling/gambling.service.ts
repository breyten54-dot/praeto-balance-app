import { ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type {
  GamblingSpendSummary,
  GamblingTransaction,
  CoolingOffResult,
  DailyAlertResult,
} from './types';

@Injectable()
export class GamblingService {
  constructor(private readonly prisma: PrismaService) {}

  private currentMonthRange(): { start: Date; end: Date; month: string } {
    const now = new Date();
    const year = now.getUTCFullYear();
    const monthIdx = now.getUTCMonth();
    const month = `${year}-${String(monthIdx + 1).padStart(2, '0')}`;
    const start = new Date(Date.UTC(year, monthIdx, 1, 0, 0, 0, 0));
    const end = new Date(Date.UTC(year, monthIdx + 1, 1, 0, 0, 0, 0));
    return { start, end, month };
  }

  private formatDate(date: Date): string {
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, '0');
    const d = String(date.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  async getSummary(userId: string): Promise<GamblingSpendSummary> {
    const { start, end, month } = this.currentMonthRange();

    const settings = await this.prisma.gamblingSettings.upsert({
      where: { userId },
      update: {},
      create: {
        userId,
        monthlyLimitCents: 50000,
        dailyAlertEnabled: false,
        dailyAlertThresholdCents: null,
      },
    });

    const transactions = await this.prisma.transaction.findMany({
      where: {
        userId,
        category: 'gambling',
        occurredAt: { gte: start, lt: end },
      },
      orderBy: { occurredAt: 'desc' },
    });

    const spentCents = transactions.reduce(
      (sum, tx) => sum + tx.amountCents,
      0,
    );

    const mapped: GamblingTransaction[] = transactions.map((tx) => ({
      id: tx.id,
      merchant: tx.merchant,
      date: this.formatDate(tx.occurredAt),
      category: tx.category,
      amountCents: tx.amountCents,
    }));

    return {
      month,
      limitCents: settings.monthlyLimitCents,
      spentCents,
      isOverLimit: spentCents > settings.monthlyLimitCents,
      transactions: mapped,
      dailyAlertEnabled: settings.dailyAlertEnabled,
      dailyAlertThresholdCents: settings.dailyAlertThresholdCents ?? null,
    };
  }

  async setLimit(userId: string, limitCents: number): Promise<GamblingSpendSummary> {
    await this.prisma.$transaction(async (tx) => {
      await tx.gamblingSettings.upsert({
        where: { userId },
        update: { monthlyLimitCents: limitCents },
        create: {
          userId,
          monthlyLimitCents: limitCents,
          dailyAlertEnabled: false,
          dailyAlertThresholdCents: null,
        },
      });

      await tx.budgetCategoryLimit.upsert({
        where: { userId_category: { userId, category: 'gambling' } },
        update: { limitCents },
        create: { userId, category: 'gambling', limitCents },
      });
    });

    return this.getSummary(userId);
  }

  async requestCoolingOff(
    userId: string,
    days: number,
  ): Promise<CoolingOffResult> {
    const now = new Date();

    const active = await this.prisma.coolingOffPeriod.findFirst({
      where: {
        userId,
        endsAt: { gt: now },
      },
      orderBy: { endsAt: 'desc' },
    });

    if (active) {
      throw new ConflictException({
        code: 'COOLING_OFF_ACTIVE',
        message: `A cooling-off period is already active until ${active.endsAt.toISOString()}.`,
      });
    }

    const startsAt = now;
    const endsAt = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

    const period = await this.prisma.coolingOffPeriod.create({
      data: { userId, startsAt, endsAt },
    });

    return {
      id: period.id,
      startsAt: period.startsAt.toISOString(),
      endsAt: period.endsAt.toISOString(),
    };
  }

  async updateDailyAlert(
    userId: string,
    enabled: boolean,
    thresholdCents?: number,
  ): Promise<DailyAlertResult> {
    const settings = await this.prisma.gamblingSettings.upsert({
      where: { userId },
      update: {},
      create: {
        userId,
        monthlyLimitCents: 50000,
        dailyAlertEnabled: false,
        dailyAlertThresholdCents: null,
      },
    });

    const newThreshold = enabled
      ? thresholdCents ?? settings.dailyAlertThresholdCents ?? 10000
      : settings.dailyAlertThresholdCents ?? null;

    const updated = await this.prisma.gamblingSettings.update({
      where: { userId },
      data: {
        dailyAlertEnabled: enabled,
        dailyAlertThresholdCents: newThreshold,
      },
    });

    return {
      dailyAlertEnabled: updated.dailyAlertEnabled,
      dailyAlertThresholdCents: updated.dailyAlertThresholdCents ?? null,
    };
  }
}
