import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService, UserProfile } from '../auth/auth.service';
import { LsmBand } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
  ) {}

  async findById(id: string): Promise<UserProfile | null> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    return user ? this.authService.toUserProfile(user) : null;
  }

  async updateLsmBand(id: string, lsmBand: LsmBand): Promise<UserProfile> {
    const user = await this.prisma.user.update({
      where: { id },
      data: { lsmBand },
    });
    return this.authService.toUserProfile(user);
  }
}
