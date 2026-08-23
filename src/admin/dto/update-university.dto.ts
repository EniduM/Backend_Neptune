import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class UpdateUniversityDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string;
}