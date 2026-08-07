import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { BankLinkController } from './bank-link.controller';
import { BankLinkService } from './bank-link.service';

@Module({
  imports: [PrismaModule],
  controllers: [BankLinkController],
  providers: [BankLinkService],
})
export class BankLinkModule {}
