import { IsIn } from 'class-validator';

export class UpdateVehicleStatusDto {
  @IsIn(['ACTIVE', 'INACTIVE'])
  status: 'ACTIVE' | 'INACTIVE';
}
