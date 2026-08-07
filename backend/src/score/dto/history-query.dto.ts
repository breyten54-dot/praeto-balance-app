import { IsOptional, IsInt, Min, Max } from 'class-validator';
import { Transform } from 'class-transformer';

export class HistoryQueryDto {
  @IsOptional()
  @IsInt({ message: 'months must be an integer' })
  @Min(1, { message: 'months must be at least 1' })
  @Max(24, { message: 'months must be at most 24' })
  @Transform(({ value }) => (value !== undefined ? parseInt(value, 10) : 6))
  months?: number = 6;
}
