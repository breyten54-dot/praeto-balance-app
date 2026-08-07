import { IsInt, IsISO8601, IsOptional, IsString, Length, Min } from 'class-validator';

export class CreateGoalDto {
  @IsString()
  @Length(1, 60)
  name!: string;

  @IsInt()
  @Min(1)
  targetCents!: number;

  @IsOptional()
  @IsISO8601({ strict: true })
  targetDate?: string;
}
