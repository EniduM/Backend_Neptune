import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateVehicleDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  vehicleCode: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  vehicleType: string;
}
