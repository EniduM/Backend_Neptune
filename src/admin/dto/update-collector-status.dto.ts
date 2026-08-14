import { IsIn } from 'class-validator';

export class UpdateCollectorStatusDto {
  @IsIn(['ACTIVE', 'INACTIVE'])
  status: 'ACTIVE' | 'INACTIVE';
}
