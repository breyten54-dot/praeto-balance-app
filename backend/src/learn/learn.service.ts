import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { LearnModuleResponse, CompleteModuleResponse } from './types';

@Injectable()
export class LearnService {
  constructor(private readonly prisma: PrismaService) {}

  async getModules(userId: string, _lsmBand?: string): Promise<LearnModuleResponse[]> {
    // TODO: lsmBand accepted but unused in v1 — content variants per band are post-pilot.
    const [modules, completions] = await Promise.all([
      this.prisma.learnModuleDef.findMany({ orderBy: [{ pillar: 'asc' }, { orderIndex: 'asc' }] }),
      this.prisma.learnCompletion.findMany({
        where: { userId },
        select: { moduleId: true },
      }),
    ]);

    const completedIds = new Set(completions.map((c) => c.moduleId));

    // For each pillar, find the lowest orderIndex of modules not completed.
    const pillarMinAvailable = new Map<number, number>();
    for (const m of modules) {
      if (!completedIds.has(m.id)) {
        const current = pillarMinAvailable.get(m.pillar);
        if (current === undefined || m.orderIndex < current) {
          pillarMinAvailable.set(m.pillar, m.orderIndex);
        }
      }
    }

    return modules.map((m) => {
      let status: LearnModuleResponse['status'] = 'locked';
      if (completedIds.has(m.id)) {
        status = 'completed';
      } else if (pillarMinAvailable.get(m.pillar) === m.orderIndex) {
        status = 'available';
      }
      return {
        id: m.id,
        pillar: m.pillar,
        title: m.title,
        subtitle: m.subtitle,
        bodyMarkdown: m.bodyMarkdown,
        videoUrl: m.videoUrl,
        videoStatus: m.videoStatus,
        status,
        pointsAwarded: m.pointsAwarded,
        estimatedMinutes: m.estimatedMinutes,
      };
    });
  }

  async completeModule(userId: string, moduleId: string): Promise<CompleteModuleResponse> {
    const module = await this.prisma.learnModuleDef.findUnique({
      where: { id: moduleId },
    });

    if (!module) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: `Module '${moduleId}' not found.`,
      });
    }

    const modules = await this.getModules(userId);
    const target = modules.find((m) => m.id === moduleId);

    if (!target || target.status === 'locked') {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Complete the previous module in this pillar first.',
      });
    }

    if (target.status === 'completed') {
      return { id: moduleId, status: 'completed', pointsAwarded: module.pointsAwarded };
    }

    await this.prisma.$transaction([
      this.prisma.learnCompletion.create({
        data: { userId, moduleId },
      }),
      this.prisma.pointsLedger.create({
        data: {
          userId,
          delta: module.pointsAwarded,
          reason: 'learn_module',
          refId: moduleId,
        },
      }),
    ]);

    return { id: moduleId, status: 'completed', pointsAwarded: module.pointsAwarded };
  }
}
