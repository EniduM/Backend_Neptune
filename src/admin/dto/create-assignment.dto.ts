import { IsDateString, IsUUID, Matches } from 'class-validator';

export class CreateAssignmentDto {
  @IsUUID()
  collectorId: string;

  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  assignmentDate: string;
}
