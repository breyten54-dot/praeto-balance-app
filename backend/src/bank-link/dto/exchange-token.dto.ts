import { IsIn, IsNotEmpty, IsString } from 'class-validator';
import { INSTITUTION_MAP } from '../institutions';

export class ExchangeTokenDto {
  @IsString()
  @IsNotEmpty()
  publicToken: string;

  @IsString()
  @IsIn(Object.keys(INSTITUTION_MAP))
  institutionId: string;
}
