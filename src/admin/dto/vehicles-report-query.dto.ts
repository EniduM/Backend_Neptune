import { IsIn, IsOptional } from 'class-validator';
import { BaseReportQueryDto } from './base-report-query.dto';

export class VehiclesReportQueryDto extends BaseReportQueryDto {
  @IsOptional()
  @IsIn(['ACTIVE', 'INACTIVE'])
  status?: 'ACTIVE' | 'INACTIVE';
}