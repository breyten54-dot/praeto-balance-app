import { IsInt, Min, Max } from 'class-validator';

export class CoolingOffDto {
  @IsInt({ message: 'days must be an integer' })
  @Min(1, { message: 'days must be at least 1' })
  @Max(90, { message: 'days must be at most 90' })
  days!: number;
}
