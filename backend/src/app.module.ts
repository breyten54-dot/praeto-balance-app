import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { HealthModule } from './health/health.module';
import { BudgetModule } from './budget/budget.module';
import { GamblingModule } from './gambling/gambling.module';
import { LearnModule } from './learn/learn.module';
import { ScoreModule } from './score/score.module';
import { RewardsModule } from './rewards/rewards.module';
import { RiskProfileModule } from './risk-profile/risk-profile.module';
import { SavingsModule } from './savings/savings.module';
import { CoachingModule } from './coaching/coaching.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { BankLinkModule } from './bank-link/bank-link.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';

@Module({
  imports: [PrismaModule, AuthModule, UsersModule, HealthModule, BudgetModule, GamblingModule, LearnModule, ScoreModule, RewardsModule, RiskProfileModule, SavingsModule, CoachingModule, WebhooksModule, BankLinkModule],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
