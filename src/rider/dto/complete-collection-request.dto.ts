import { IsNumber, IsPositive, IsUUID } from 'class-validator';

export class CompleteCollectionRequestDto {
  @IsUUID()
  vehicleId: string;

  @IsNumber({ allowNaN: false, allowInfinity: false })
  @IsPositive()
  weightKg: number;
}
