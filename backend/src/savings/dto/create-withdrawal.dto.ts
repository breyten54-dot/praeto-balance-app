import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreateWithdrawalDto {
  @IsInt()
  @Min(1)
  amountCents!: number;

  @IsOptional()
  @IsString()
  goalId?: string;
}
