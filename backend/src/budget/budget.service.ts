import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BUDGET_CATEGORIES, CATEGORY_SLUGS } from './budget-categories';
import type { BudgetCategory, BudgetSummary } from './types';

@Injectable()
export class BudgetService {
  constructor(private readonly prisma: PrismaService) {}

  private getMonthRange(monthParam?: string): { start: Date; end: Date } {
    const tz = process.env.TZ || 'Africa/Johannesburg';
    const now = new Date();
    const monthString = monthParam ?? this.formatMonth(now, tz);
    const [year, month] = monthString.split('-').map(Number);

    if (!year || !month || month < 1 || month > 12) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Month must be in YYYY-MM format.',
      });
    }

    const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
    const end = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
    return { start, end };
  }

  private formatMonth(date: Date, _tz: string): string {
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  }

  async getSummary(userId: string, monthParam?: string): Promise<BudgetSummary> {
    const { start, end } = this.getMonthRange(monthParam);
    const month = monthParam ?? this.formatMonth(new Date(), process.env.TZ || 'Africa/Johannesburg');

    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { monthlyIncomeCents: true },
    });

    const [limits, transactions] = await Promise.all([
      this.prisma.budgetCategoryLimit.findMany({
        where: { userId },
      }),
      this.prisma.transaction.findMany({
        where: {
          userId,
          occurredAt: { gte: start, lt: end },
        },
        select: { category: true, amountCents: true },
      }),
    ]);

    const limitMap = new Map(limits.map((l) => [l.category, l.limitCents]));
    const spentMap = new Map<string, number>();
    for (const tx of transactions) {
      spentMap.set(tx.category, (spentMap.get(tx.category) || 0) + tx.amountCents);
    }

    const categories: BudgetCategory[] = BUDGET_CATEGORIES.map((cfg) => ({
      category: cfg.category,
      label: cfg.label,
      icon: cfg.icon,
      limitCents: limitMap.get(cfg.category) ?? cfg.defaultLimitCents,
      spentCents: spentMap.get(cfg.category) || 0,
    }));

    const totalSpentCents = categories.reduce((sum, c) => sum + c.spentCents, 0);
    const availableCents = user.monthlyIncomeCents - totalSpentCents;

    return {
      month,
      incomeCents: user.monthlyIncomeCents,
      totalSpentCents,
      availableCents,
      categories,
    };
  }

  async setCategoryLimit(
    userId: string,
    category: string,
    limitCents: number,
  ): Promise<BudgetCategory> {
    if (!CATEGORY_SLUGS.includes(category)) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: `Category '${category}' not found.`,
      });
    }

    const cfg = BUDGET_CATEGORIES.find((c) => c.category === category)!;

    await this.prisma.budgetCategoryLimit.upsert({
      where: { userId_category: { userId, category } },
      update: { limitCents },
      create: { userId, category, limitCents },
    });

    return {
      category,
      label: cfg.label,
      icon: cfg.icon,
      limitCents,
      spentCents: 0,
    };
  }
}
