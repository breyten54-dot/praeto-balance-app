import { IsBoolean, IsInt, IsOptional, IsPositive } from 'class-validator';

export class DailyAlertDto {
  @IsBoolean({ message: 'enabled must be a boolean' })
  enabled!: boolean;

  @IsOptional()
  @IsInt({ message: 'thresholdCents must be an integer number of cents' })
  @IsPositive({ message: 'thresholdCents must be a positive number' })
  thresholdCents?: number;
}
