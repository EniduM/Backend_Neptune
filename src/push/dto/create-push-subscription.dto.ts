import {
  IsIn,
  IsNotEmpty,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreatePushSubscriptionDto {
  @IsIn(['web'])
  platform: 'web';

  @IsString()
  @IsNotEmpty()
  @MaxLength(2048)
  endpoint: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(512)
  p256dh: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(512)
  auth: string;
}