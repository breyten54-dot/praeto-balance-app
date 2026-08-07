import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { scoreRiskProfile } from './risk.formula';
import type { RiskProfileResultResponse } from './types';

const DISCLAIMER =
  'This Risk Portrait is a guide only and does not constitute financial advice as defined in the Financial Advisory and Intermediary Services (FAIS) Act. Praeto Balance is not a licensed financial services provider. Please consult a licensed financial adviser before making any investment decision.';

const REQUIRED_QUESTIONS = [
  'time_horizon',
  'market_reaction',
  'risk_association',
  'underperformance_reaction',
] as const;

const VALID_ANSWERS: Record<string, readonly string[]> = {
  time_horizon: ['lt5', '5to10', '11to15', 'gt15'],
  market_reaction: ['sell_immediately', 'sell_on_5pct', 'wait_a_year', 'stay_the_course'],
  risk_association: ['danger', 'uncertainty', 'opportunity', 'thrill'],
  underperformance_reaction: ['very_upset', 'somewhat_upset', 'uneasy_but_ok', 'not_concerned'],
};

@Injectable()
export class RiskProfileService {
  constructor(private readonly prisma: PrismaService) {}

  private ensureEnabled(): void {
    if (process.env.FEATURE_RISK_PROFILE_ENABLED !== 'true') {
      throw new ForbiddenException({
        code: 'FEATURE_DISABLED',
        message: 'Risk Profile is currently unavailable.',
      });
    }
  }

  private validateAnswers(answers: Record<string, string>): void {
    if (!answers || typeof answers !== 'object' || Array.isArray(answers)) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Answers must be an object.',
      });
    }

    const keys = Object.keys(answers);
    if (keys.length !== REQUIRED_QUESTIONS.length) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Submit exactly four answers.',
      });
    }

    for (const question of REQUIRED_QUESTIONS) {
      const value = answers[question];
      if (typeof value !== 'string') {
        throw new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: `Answer for '${question}' is required.`,
        });
      }

      const allowed = VALID_ANSWERS[question];
      if (!allowed.includes(value)) {
        throw new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: `Invalid value for '${question}'.`,
        });
      }
    }
  }

  private async toResponse(submission: {
    id: string;
    riskCapacityScore: number;
    riskAttitudeScore: number;
    totalScore: number;
    category: string;
    completedAt: Date;
  }): Promise<RiskProfileResultResponse> {
    const products = await this.prisma.riskProduct.findMany({
      where: { category: submission.category },
      orderBy: { id: 'asc' },
      select: { id: true, name: true, description: true },
    });

    return {
      id: submission.id,
      riskCapacityScore: submission.riskCapacityScore,
      riskAttitudeScore: submission.riskAttitudeScore,
      totalScore: submission.totalScore,
      category: submission.category as RiskProfileResultResponse['category'],
      recommendedProducts: products,
      completedAt: submission.completedAt.toISOString(),
      disclaimer: DISCLAIMER,
    };
  }

  async submit(userId: string, answers: Record<string, string>): Promise<RiskProfileResultResponse> {
    this.ensureEnabled();
    this.validateAnswers(answers);

    const score = scoreRiskProfile(answers);

    const submission = await this.prisma.riskProfileSubmission.create({
      data: {
        userId,
        answers: answers as Record<string, string>,
        riskCapacityScore: score.riskCapacityScore,
        riskAttitudeScore: score.riskAttitudeScore,
        totalScore: score.totalScore,
        category: score.category,
      },
    });

    return this.toResponse(submission);
  }

  async getLatest(userId: string): Promise<RiskProfileResultResponse | null> {
    this.ensureEnabled();

    const submission = await this.prisma.riskProfileSubmission.findFirst({
      where: { userId },
      orderBy: { completedAt: 'desc' },
    });

    if (!submission) {
      return null;
    }

    return this.toResponse(submission);
  }
}
