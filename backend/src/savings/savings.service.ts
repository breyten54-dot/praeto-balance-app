import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type {
  SavingsAccountResponse,
  SavingsGoalResponse,
  SavingsWithdrawalResponse,
} from './types';
import type { CreateGoalDto } from './dto/create-goal.dto';
import type { CreateWithdrawalDto } from './dto/create-withdrawal.dto';

@Injectable()
export class SavingsService {
  constructor(private readonly prisma: PrismaService) {}

  private ensureEnabled(): void {
    if (process.env.FEATURE_SAVINGS_ENABLED !== 'true') {
      throw new ForbiddenException({
        code: 'FEATURE_DISABLED',
        message: 'Savings is currently unavailable.',
      });
    }
  }

  private mapGoal(goal: {
    id: string;
    name: string;
    targetCents: number;
    currentCents: number;
    targetDate: Date | null;
  }): SavingsGoalResponse {
    return {
      id: goal.id,
      name: goal.name,
      targetCents: goal.targetCents,
      currentCents: goal.currentCents,
      targetDate: goal.targetDate ? goal.targetDate.toISOString().split('T')[0] : null,
    };
  }

  private async findOrCreateAccount(userId: string) {
    const existing = await this.prisma.savingsAccountModel.findUnique({
      where: { userId },
    });

    if (existing) {
      return existing;
    }

    return this.prisma.savingsAccountModel.create({
      data: { userId },
    });
  }

  async getAccount(userId: string): Promise<SavingsAccountResponse> {
    this.ensureEnabled();

    const account = await this.findOrCreateAccount(userId);

    const [goals, withdrawalsUsedThisYear] = await Promise.all([
      this.prisma.savingsGoalModel.findMany({
        where: { accountId: account.id },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.savingsWithdrawal.count({
        where: {
          accountId: account.id,
          createdAt: {
            gte: new Date(new Date().getFullYear(), 0, 1),
            lt: new Date(new Date().getFullYear() + 1, 0, 1),
          },
        },
      }),
    ]);

    return {
      id: account.id,
      provider: account.provider as 'partner_bank',
      balanceCents: account.balanceCents,
      interestRateAnnual: account.interestRateAnnual,
      withdrawalsUsedThisYear,
      withdrawalsAllowedPerYear: account.withdrawalsAllowedPerYear,
      goals: goals.map((g) => this.mapGoal(g)),
    };
  }

  async createGoal(userId: string, dto: CreateGoalDto): Promise<SavingsGoalResponse> {
    this.ensureEnabled();

    const account = await this.findOrCreateAccount(userId);

    const goal = await this.prisma.savingsGoalModel.create({
      data: {
        accountId: account.id,
        name: dto.name,
        targetCents: dto.targetCents,
        targetDate: dto.targetDate ? new Date(dto.targetDate) : null,
      },
    });

    return this.mapGoal(goal);
  }

  async withdraw(userId: string, dto: CreateWithdrawalDto): Promise<SavingsWithdrawalResponse> {
    this.ensureEnabled();

    const account = await this.prisma.savingsAccountModel.findUnique({
      where: { userId },
      include: { goals: true },
    });

    if (!account) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Savings account not found.',
      });
    }

    const yearStart = new Date(new Date().getFullYear(), 0, 1);
    const yearEnd = new Date(new Date().getFullYear() + 1, 0, 1);

    const [withdrawalsThisYear, goal] = await Promise.all([
      this.prisma.savingsWithdrawal.count({
        where: {
          accountId: account.id,
          createdAt: { gte: yearStart, lt: yearEnd },
        },
      }),
      dto.goalId
        ? this.prisma.savingsGoalModel.findUnique({ where: { id: dto.goalId } })
        : Promise.resolve(null),
    ]);

    if (withdrawalsThisYear >= account.withdrawalsAllowedPerYear) {
      throw new BadRequestException({
        code: 'LIMIT_EXCEEDED',
        message: 'Withdrawal limit reached for this year.',
      });
    }

    if (dto.goalId && (!goal || goal.accountId !== account.id)) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Goal not found.',
      });
    }

    if (dto.amountCents > account.balanceCents) {
      throw new BadRequestException({
        code: 'LIMIT_EXCEEDED',
        message: 'Insufficient savings balance.',
      });
    }

    const newBalanceCents = account.balanceCents - dto.amountCents;

    const withdrawal = await this.prisma.$transaction(async (tx) => {
      const created = await tx.savingsWithdrawal.create({
        data: {
          accountId: account.id,
          amountCents: dto.amountCents,
          goalId: dto.goalId ?? null,
        },
      });

      await tx.savingsAccountModel.update({
        where: { id: account.id },
        data: { balanceCents: newBalanceCents },
      });

      if (goal) {
        const newGoalCurrent = Math.max(0, goal.currentCents - dto.amountCents);
        await tx.savingsGoalModel.update({
          where: { id: goal.id },
          data: { currentCents: newGoalCurrent },
        });
      }

      return created;
    });

    return {
      id: withdrawal.id,
      amountCents: withdrawal.amountCents,
      newBalanceCents,
      createdAt: withdrawal.createdAt.toISOString(),
    };
  }
}
