import { Body, Controller, Get, Post, Put, HttpCode } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { GamblingService } from './gambling.service';
import { SetLimitDto } from './dto/set-limit.dto';
import { CoolingOffDto } from './dto/cooling-off.dto';
import { DailyAlertDto } from './dto/daily-alert.dto';

@Controller('gambling')
export class GamblingController {
  constructor(private readonly gamblingService: GamblingService) {}

  @Get('summary')
  async getSummary(@CurrentUser() user: { id: string }) {
    return this.gamblingService.getSummary(user.id);
  }

  @Put('limit')
  @HttpCode(200)
  async setLimit(
    @CurrentUser() user: { id: string },
    @Body() dto: SetLimitDto,
  ) {
    return this.gamblingService.setLimit(user.id, dto.limitCents);
  }

  @Post('cooling-off')
  @HttpCode(201)
  async requestCoolingOff(
    @CurrentUser() user: { id: string },
    @Body() dto: CoolingOffDto,
  ) {
    return this.gamblingService.requestCoolingOff(user.id, dto.days);
  }

  @Put('daily-alert')
  @HttpCode(200)
  async updateDailyAlert(
    @CurrentUser() user: { id: string },
    @Body() dto: DailyAlertDto,
  ) {
    return this.gamblingService.updateDailyAlert(
      user.id,
      dto.enabled,
      dto.thresholdCents,
    );
  }
}
