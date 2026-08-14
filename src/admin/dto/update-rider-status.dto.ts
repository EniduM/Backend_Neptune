import { IsIn } from 'class-validator';

export class UpdateRiderStatusDto {
  @IsIn(['ACTIVE', 'INACTIVE'])
  status: 'ACTIVE' | 'INACTIVE';
}
