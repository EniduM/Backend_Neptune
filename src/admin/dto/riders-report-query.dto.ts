import { IsIn, IsOptional, IsUUID } from 'class-validator';
import { BaseReportQueryDto } from './base-report-query.dto';

export class RidersReportQueryDto extends BaseReportQueryDto {
  @IsOptional()
  @IsIn(['ACTIVE', 'INACTIVE'])
  status?: 'ACTIVE' | 'INACTIVE';

  @IsOptional()
  @IsUUID()
  vehicleId?: string;
}