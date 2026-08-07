import { Controller, Get } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';

@Controller('health')
export class HealthController {
  private readonly startedAt = Date.now();

  @Public()
  @Get()
  health() {
    return {
      status: 'ok',
      uptimeSeconds: Math.floor((Date.now() - this.startedAt) / 1000),
    };
  }
}

// Friendly landing response for the bare domain (excluded from the /api/v1
// prefix in main.ts) — the demo audience types the root URL into a browser.
@Controller()
export class RootController {
  @Public()
  @Get()
  root() {
    return {
      service: 'Praeto Balance API',
      status: 'ok',
      health: '/api/v1/health',
      note: 'All endpoints live under /api/v1 and require authentication.',
    };
  }
}
