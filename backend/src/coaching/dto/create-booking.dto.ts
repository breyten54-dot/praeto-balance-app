import { IsIn } from 'class-validator';

const TIERS = ['discovery', 'starter', 'growth', 'transformation'] as const;

export class CreateBookingDto {
  @IsIn(TIERS)
  tier!: (typeof TIERS)[number];
}
