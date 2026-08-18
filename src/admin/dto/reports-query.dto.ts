import {
  IsDateString,
  IsIn,
  IsOptional,
  IsUUID,
  Matches,
} from 'class-validator';

export class ReportsQueryDto {
  @IsIn(['collection', 'request', 'collector', 'rider', 'vehicle', 'assignment'])
  type: 'collection' | 'request' | 'collector' | 'rider' | 'vehicle' | 'assignment';

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

  @IsOptional()
  @IsUUID()
  riderId?: string;

  @IsOptional()
  @IsUUID()
  vehicleId?: string;

  @IsOptional()
  @IsIn(['ACTIVE', 'INACTIVE', 'PENDING', 'ACCEPTED', 'COMPLETED', 'CANCELLED'])
  status?: string;
}