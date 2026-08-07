import { IsEnum } from 'class-validator';
import { LsmBand } from '@prisma/client';

export class UpdateLsmBandDto {
  @IsEnum(LsmBand, { message: 'lsmBand must be a valid LSM band' })
  lsmBand!: LsmBand;
}
