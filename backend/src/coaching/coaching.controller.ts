import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { CoachingService } from './coaching.service';
import { CreateBookingDto } from './dto/create-booking.dto';

@Controller()
export class CoachingController {
  constructor(private readonly coachingService: CoachingService) {}

  @Get('coaching/availability')
  async getAvailability() {
    return this.coachingService.getAvailability();
  }

  @Post('coaching/bookings')
  @HttpCode(200)
  async createBooking(
    @CurrentUser() user: { id: string },
    @Body() dto: CreateBookingDto,
  ) {
    return this.coachingService.createBooking(user.id, dto);
  }

  @Get('coaching/bookings/:id')
  async getBooking(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.coachingService.getBooking(user.id, id);
  }

  @Public()
  @Get('payments/coaching-return')
  coachingReturn(@Query('bookingId') _bookingId: string, @Res() response: Response) {
    const html = `<!doctype html><html><body><script>location.href='praetobalance://payments/coaching-return'</script><p><a href="praetobalance://payments/coaching-return">Return to the Praeto Balance app</a></p></body></html>`;
    response.setHeader('Content-Type', 'text/html');
    response.status(200).send(html);
  }

  @Public()
  @Post('webhooks/payfast/itn')
  async payfastItn(
    @Body() body: Record<string, string>,
    @Req() request: Request,
    @Res() response: Response,
  ) {
    // rawBody is available because the app is created with { rawBody: true }.
    // Fall back to re-encoding only in test harnesses that omit that option.
    const rawBody = (request as Request & { rawBody?: Buffer }).rawBody;
    await this.coachingService.handleItn(rawBody, body);
    response.status(200).send('OK');
  }
}
