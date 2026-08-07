import {
  Controller,
  Post,
  Body,
  Headers,
  UsePipes,
  ValidationPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { RevenueCatService, RevenueCatEvent } from './revenuecat.service';

@Controller('webhooks')
export class RevenueCatController {
  constructor(private readonly revenueCatService: RevenueCatService) {}

  @Public()
  @Post('revenuecat')
  @HttpCode(HttpStatus.OK)
  @UsePipes(
    new ValidationPipe({
      whitelist: false,
      forbidNonWhitelisted: false,
      transform: false,
    }),
  )
  receive(
    @Headers('authorization') authorization: string,
    @Body() payload: { api_version?: string; event?: RevenueCatEvent },
  ) {
    return this.revenueCatService.handleWebhook(authorization, payload);
  }
}
