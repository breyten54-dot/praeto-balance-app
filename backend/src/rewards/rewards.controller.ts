import { Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RewardsService } from './rewards.service';

@Controller('rewards')
export class RewardsController {
  constructor(private readonly rewardsService: RewardsService) {}

  @Get('summary')
  async getSummary(@CurrentUser() user: { id: string }) {
    return this.rewardsService.getSummary(user.id);
  }

  @Post('redeem/:offerId')
  @HttpCode(200)
  async redeem(
    @CurrentUser() user: { id: string },
    @Param('offerId') offerId: string,
  ) {
    return this.rewardsService.redeem(user.id, offerId);
  }

  @Post('partners/:partner/link')
  @HttpCode(200)
  async linkPartner(
    @CurrentUser() user: { id: string },
    @Param('partner') partner: string,
  ) {
    return this.rewardsService.linkPartner(user.id, partner);
  }
}
