import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class DeletePushSubscriptionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2048)
  endpoint: string;
}