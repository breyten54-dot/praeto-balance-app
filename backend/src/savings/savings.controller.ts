import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { SavingsService } from './savings.service';
import { CreateGoalDto } from './dto/create-goal.dto';
import { CreateWithdrawalDto } from './dto/create-withdrawal.dto';

@Controller('savings')
export class SavingsController {
  constructor(private readonly savingsService: SavingsService) {}

  @Get('account')
  async getAccount(@CurrentUser() user: { id: string }) {
    return this.savingsService.getAccount(user.id);
  }

  @Post('goals')
  @HttpCode(200)
  async createGoal(@CurrentUser() user: { id: string }, @Body() dto: CreateGoalDto) {
    return this.savingsService.createGoal(user.id, dto);
  }

  @Post('withdrawals')
  @HttpCode(200)
  async withdraw(@CurrentUser() user: { id: string }, @Body() dto: CreateWithdrawalDto) {
    return this.savingsService.withdraw(user.id, dto);
  }
}
