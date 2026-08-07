import { IsInt, IsPositive } from 'class-validator';

export class SetLimitDto {
  @IsInt({ message: 'limitCents must be an integer number of cents' })
  @IsPositive({ message: 'limitCents must be a positive number' })
  limitCents!: number;
}
