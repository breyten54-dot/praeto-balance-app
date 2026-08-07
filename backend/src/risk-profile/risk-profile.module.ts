import { Module } from '@nestjs/common';
import { RiskProfileService } from './risk-profile.service';
import { RiskProfileController } from './risk-profile.controller';

@Module({
  providers: [RiskProfileService],
  controllers: [RiskProfileController],
  exports: [RiskProfileService],
})
export class RiskProfileModule {}
