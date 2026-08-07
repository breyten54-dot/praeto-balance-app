import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { RevenueCatController } from './revenuecat.controller';
import { RevenueCatService } from './revenuecat.service';

@Module({
  imports: [PrismaModule],
  controllers: [RevenueCatController],
  providers: [RevenueCatService],
})
export class WebhooksModule {}
