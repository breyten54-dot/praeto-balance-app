import { Body, Controller, Get, Patch } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UsersService } from './users.service';
import { UpdateLsmBandDto } from './dto/update-lsm-band.dto';

@Controller('')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  async getMe(@CurrentUser() user: { id: string }) {
    const profile = await this.usersService.findById(user.id);
    if (!profile) {
      return { code: 'NOT_FOUND', message: 'User not found.' };
    }
    return profile;
  }

  @Patch('me/lsm-band')
  async updateLsmBand(
    @CurrentUser() user: { id: string },
    @Body() dto: UpdateLsmBandDto,
  ) {
    return this.usersService.updateLsmBand(user.id, dto.lsmBand);
  }
}
