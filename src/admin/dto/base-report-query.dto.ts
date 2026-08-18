import { IsDateString, IsOptional, IsUUID, Matches } from 'class-validator';

export class BaseReportQueryDto {
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  from?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  to?: string;

  @IsOptional()
  @IsUUID()
  collectorId?: string;
}