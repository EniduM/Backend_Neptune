import { IsOptional, IsUUID } from 'class-validator';
import { BaseReportQueryDto } from './base-report-query.dto';

export class CollectionsReportQueryDto extends BaseReportQueryDto {
  @IsOptional()
  @IsUUID()
  riderId?: string;

  @IsOptional()
  @IsUUID()
  vehicleId?: string;
}