import { IsNotEmpty, IsString } from 'class-validator';

export class VerifyQrTokenDto {
  @IsString()
  @IsNotEmpty()
  qrToken: string;
}
