import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateRiderDto {
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
  nic: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  mobile: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  address: string;
}
