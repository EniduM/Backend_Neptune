import { IsIn, IsOptional } from 'class-validator';
import { BaseReportQueryDto } from './base-report-query.dto';

export class CollectorsReportQueryDto extends BaseReportQueryDto {
  @IsOptional()
  @IsIn(['ACTIVE', 'INACTIVE'])
  status?: 'ACTIVE' | 'INACTIVE';
}