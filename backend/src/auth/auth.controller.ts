import { Body, Controller, HttpCode, Post, Req } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import {
  assertAuthRateLimit,
  clientIpFromRequest,
} from '../common/auth-rate-limit';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  async login(@Body() dto: LoginDto, @Req() req: { ip?: string; headers?: Record<string, unknown> }) {
    const ip = clientIpFromRequest(req);
    assertAuthRateLimit(`auth:login:${ip}`);
    return this.authService.login(dto.email, dto.password);
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  async refresh(@Body() dto: RefreshDto, @Req() req: { ip?: string; headers?: Record<string, unknown> }) {
    const ip = clientIpFromRequest(req);
    assertAuthRateLimit(`auth:refresh:${ip}`);
    return this.authService.refresh(dto.refreshToken);
  }
}
