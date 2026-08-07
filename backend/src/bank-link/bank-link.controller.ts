import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { BankLinkService } from './bank-link.service';
import { ExchangeTokenDto } from './dto/exchange-token.dto';

@Controller('bank-link')
export class BankLinkController {
  constructor(private readonly bankLinkService: BankLinkService) {}

  @Post('token')
  @HttpCode(HttpStatus.OK)
  createToken(@CurrentUser() user: { id: string }) {
    return this.bankLinkService.createLinkToken(user.id);
  }

  @Post('exchange')
  @HttpCode(HttpStatus.OK)
  exchange(
    @CurrentUser() user: { id: string },
    @Body() dto: ExchangeTokenDto,
  ) {
    return this.bankLinkService.exchangeToken(user.id, dto);
  }

  @Get('accounts')
  listAccounts(@CurrentUser() user: { id: string }) {
    return this.bankLinkService.listAccounts(user.id);
  }

  @Delete('accounts/:id')
  unlink(
    @CurrentUser() user: { id: string },
    @Param('id') accountId: string,
  ) {
    return this.bankLinkService.unlinkAccount(user.id, accountId);
  }
}
