import { Controller, Get, Query } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ScoreService } from './score.service';
import { HistoryQueryDto } from './dto/history-query.dto';

@Controller('score')
export class ScoreController {
  constructor(private readonly scoreService: ScoreService) {}

  @Get()
  async getScore(@CurrentUser() user: { id: string }) {
    return this.scoreService.getScore(user.id);
  }

  @Get('history')
  async getHistory(
    @CurrentUser() user: { id: string },
    @Query() query: HistoryQueryDto,
  ) {
    return this.scoreService.getHistory(user.id, query.months ?? 6);
  }
}
