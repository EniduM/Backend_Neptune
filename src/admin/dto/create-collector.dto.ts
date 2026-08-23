import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { normalizeNic } from '../../common/validators/nic.util';

export class CreateCollectorDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  loginId: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  fullName: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  @Transform(({ value }) => normalizeNic(value))
  nic: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  mobile: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  address: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  guardianName: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  guardianMobile: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  qrToken?: string;

  @IsOptional()
  @IsUUID()
  universityId?: string;
}
