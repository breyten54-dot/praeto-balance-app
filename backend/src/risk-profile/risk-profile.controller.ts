import { Body, Controller, Get, HttpCode, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RiskProfileService } from './risk-profile.service';

@Controller('risk-profile')
export class RiskProfileController {
  constructor(private readonly riskProfileService: RiskProfileService) {}

  @Post('submit')
  @HttpCode(200)
  async submit(
    @CurrentUser() user: { id: string },
    @Body() body: { answers: Record<string, string> },
  ) {
    return this.riskProfileService.submit(user.id, body.answers);
  }

  @Get('latest')
  async getLatest(@CurrentUser() user: { id: string }, @Res() response: Response) {
    const result = await this.riskProfileService.getLatest(user.id);
    response.status(200).json(result);
  }
}
