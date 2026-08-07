import { Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { LearnService } from './learn.service';

@Controller('learn')
export class LearnController {
  constructor(private readonly learnService: LearnService) {}

  @Get('modules')
  async getModules(
    @CurrentUser() user: { id: string },
    @Query('lsmBand') lsmBand?: string,
  ) {
    return this.learnService.getModules(user.id, lsmBand);
  }

  @Post('modules/:id/complete')
  @HttpCode(200)
  async completeModule(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
  ) {
    return this.learnService.completeModule(user.id, id);
  }
}
