import { IsNumber, IsPositive, IsUUID } from 'class-validator';
import { MaxDecimals } from '../../common/validators/max-decimals.util';

export class CompleteCollectionRequestDto {
  @IsUUID()
  vehicleId: string;

  @IsNumber({ allowNaN: false, allowInfinity: false })
  @IsPositive()
  @MaxDecimals(3)
  weightKg: number;
}
