import { Module } from '@nestjs/common';
import { GamblingService } from './gambling.service';
import { GamblingController } from './gambling.controller';

@Module({
  providers: [GamblingService],
  controllers: [GamblingController],
  exports: [GamblingService],
})
export class GamblingModule {}
