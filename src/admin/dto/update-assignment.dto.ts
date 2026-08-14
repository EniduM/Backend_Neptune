import { IsDateString, IsOptional, IsUUID, Matches } from 'class-validator';

export class UpdateAssignmentDto {
  @IsOptional()
  @IsUUID()
  collectorId?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  assignmentDate?: string;
}
