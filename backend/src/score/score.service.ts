import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { computeScore, ScoreFormulaInputs } from './score.formula';
import { BUDGET_CATEGORIES } from '../budget/budget-categories';
import type { BalanceScoreResponse, ScoreHistoryResponse } from './types';

@Injectable()
export class ScoreService {
  constructor(private readonly prisma: PrismaService) {}

  private monthRange(monthsAgo: number): { start: Date; end: Date; label: string } {
    const now = new Date();
    const year = now.getUTCFullYear();
    const month = now.getUTCMonth();
    const target = new Date(Date.UTC(year, month - monthsAgo, 1));
    const label = `${target.getUTCFullYear()}-${String(target.getUTCMonth() + 1).padStart(2, '0')}`;
    const start = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), 1));
    const end = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 1));
    return { start, end, label };
  }

  async computeForMonth(userId: string, monthsAgo = 0): Promise<{
    score: number;
    dimensions: Record<string, number>;
    month: string;
  }> {
    const { start, end, label } = this.monthRange(monthsAgo);

    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { monthlyIncomeCents: true },
    });

    const [transactions, limits, completions, gamblingSettings] = await Promise.all([
      this.prisma.transaction.findMany({
        where: { userId, occurredAt: { gte: start, lt: end } },
      }),
      this.prisma.budgetCategoryLimit.findMany({ where: { userId } }),
      this.prisma.learnCompletion.count({ where: { userId } }),
      this.prisma.gamblingSettings.findUnique({ where: { userId } }),
    ]);

    const limitMap = new Map(limits.map((l) => [l.category, l.limitCents]));
    const totalSpentCents = transactions.reduce((sum, t) => sum + t.amountCents, 0);

    const categoriesOverLimit = BUDGET_CATEGORIES.reduce((count, cfg) => {
      const spent = transactions
        .filter((t) => t.category === cfg.category)
        .reduce((sum, t) => sum + t.amountCents, 0);
      const limit = limitMap.get(cfg.category) ?? cfg.defaultLimitCents;
      return spent > limit ? count + 1 : count;
    }, 0);

    const gamblingSpentCents = transactions
      .filter((t) => t.category === 'gambling')
      .reduce((sum, t) => sum + t.amountCents, 0);
    const gamblingLimitCents = gamblingSettings?.monthlyLimitCents ?? 50000;

    const inputs: ScoreFormulaInputs = {
      incomeCents: user.monthlyIncomeCents,
      totalSpentCents,
      categoriesOverLimit,
      gamblingSpentCents,
      gamblingLimitCents,
      completedLearnModules: completions,
    };

    const result = computeScore(inputs);
    return { ...result, month: label };
  }

  async getScore(userId: string): Promise<BalanceScoreResponse> {
    const current = await this.computeForMonth(userId, 0);

    const snapshot = await this.prisma.scoreSnapshot.upsert({
      where: {
        userId_month: { userId, month: current.month },
      },
      update: {
        score: current.score,
        dimensions: current.dimensions,
        computedAt: new Date(),
      },
      create: {
        userId,
        month: current.month,
        score: current.score,
        dimensions: current.dimensions,
      },
    });

    const previous = await this.prisma.scoreSnapshot.findUnique({
      where: {
        userId_month: {
          userId,
          month: this.monthRange(1).label,
        },
      },
    });

    return {
      score: snapshot.score,
      changeFromLastMonth: previous ? snapshot.score - previous.score : 0,
      dimensions: snapshot.dimensions as BalanceScoreResponse['dimensions'],
      computedAt: snapshot.computedAt.toISOString(),
    };
  }

  async getHistory(userId: string, months: number): Promise<ScoreHistoryResponse> {
    const cutoff = this.monthRange(months).start;
    const snapshots = await this.prisma.scoreSnapshot.findMany({
      where: {
        userId,
        computedAt: { gte: cutoff },
      },
      orderBy: { month: 'asc' },
      select: { month: true, score: true },
    });

    return { months: snapshots };
  }
}
