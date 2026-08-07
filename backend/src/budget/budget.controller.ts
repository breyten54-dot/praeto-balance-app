import {
  Controller,
  Get,
  Put,
  Param,
  Body,
  Query,
  HttpCode,
} from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { BudgetService } from './budget.service';
import { SetLimitDto } from './dto/set-limit.dto';

@Controller('budget')
export class BudgetController {
  constructor(private readonly budgetService: BudgetService) {}

  @Get('summary')
  async getSummary(
    @CurrentUser() user: { id: string },
    @Query('month') month?: string,
  ) {
    return this.budgetService.getSummary(user.id, month);
  }

  @Put('categories/:category/limit')
  @HttpCode(200)
  async setCategoryLimit(
    @CurrentUser() user: { id: string },
    @Param('category') category: string,
    @Body() dto: SetLimitDto,
  ) {
    return this.budgetService.setCategoryLimit(user.id, category, dto.limitCents);
  }
}
