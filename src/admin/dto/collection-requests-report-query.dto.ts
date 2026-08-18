import { IsIn, IsOptional, IsUUID } from 'class-validator';
import { BaseReportQueryDto } from './base-report-query.dto';

export class CollectionRequestsReportQueryDto extends BaseReportQueryDto {
  @IsOptional()
  @IsIn(['PENDING', 'ACCEPTED', 'COMPLETED', 'CANCELLED'])
  status?: 'PENDING' | 'ACCEPTED' | 'COMPLETED' | 'CANCELLED';

  @IsOptional()
  @IsUUID()
  riderId?: string;
}