import {
  Injectable,
  UnauthorizedException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { INSTITUTION_MAP } from './institutions';
import { ExchangeTokenDto } from './dto/exchange-token.dto';

const TOKEN_TTL_MS = 15 * 60 * 1000;

export interface AccountWire {
  id: string;
  institutionId: string;
  institutionName: string;
  maskedAccountNumber: string;
  status: string;
  linkedAt: string;
}

function toWireAccount(account: {
  id: string;
  institutionId: string;
  institutionName: string;
  maskedAccountNumber: string;
  status: string;
  linkedAt: Date;
}): AccountWire {
  return {
    id: account.id,
    institutionId: account.institutionId,
    institutionName: account.institutionName,
    maskedAccountNumber: account.maskedAccountNumber,
    status: account.status,
    linkedAt: account.linkedAt.toISOString(),
  };
}

@Injectable()
export class BankLinkService {
  constructor(private readonly prisma: PrismaService) {}

  async createLinkToken(userId: string): Promise<{
    linkToken: string;
    expiresAt: string;
  }> {
    const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);
    const token = await this.prisma.bankLinkToken.create({
      data: { userId, expiresAt },
    });
    return {
      linkToken: token.id,
      expiresAt: token.expiresAt.toISOString(),
    };
  }

  async exchangeToken(
    userId: string,
    dto: ExchangeTokenDto,
  ): Promise<AccountWire> {
    const institutionName = INSTITUTION_MAP[dto.institutionId];
    if (!institutionName) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Invalid institution id.',
      });
    }

    const token = await this.prisma.bankLinkToken.findFirst({
      where: { id: dto.publicToken, userId },
    });

    if (!token || token.used || token.expiresAt < new Date()) {
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: 'Link token is invalid or expired.',
      });
    }

    await this.prisma.bankLinkToken.update({
      where: { id: token.id },
      data: { used: true },
    });

    const randomDigits = Math.floor(Math.random() * 10000)
      .toString()
      .padStart(4, '0');

    const account = await this.prisma.bankAccount.create({
      data: {
        userId,
        institutionId: dto.institutionId,
        institutionName,
        maskedAccountNumber: `****${randomDigits}`,
      },
    });

    return toWireAccount(account);
  }

  async listAccounts(userId: string): Promise<{ accounts: AccountWire[] }> {
    const accounts = await this.prisma.bankAccount.findMany({
      where: { userId, status: 'active' },
      orderBy: { linkedAt: 'desc' },
    });
    return { accounts: accounts.map(toWireAccount) };
  }

  async unlinkAccount(
    userId: string,
    accountId: string,
  ): Promise<{ deleted: true }> {
    const account = await this.prisma.bankAccount.findFirst({
      where: { id: accountId, userId, status: 'active' },
    });
    if (!account) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Account not found.',
      });
    }
    await this.prisma.bankAccount.update({
      where: { id: account.id },
      data: { status: 'unlinked' },
    });
    return { deleted: true };
  }
}
