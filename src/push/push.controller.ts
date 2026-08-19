import {
  Body,
  Controller,
  Delete,
  HttpCode,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { CreatePushSubscriptionDto } from './dto/create-push-subscription.dto';
import { DeletePushSubscriptionDto } from './dto/delete-push-subscription.dto';
import { PushService } from './push.service';

@Controller('push')
@UseGuards(JwtAuthGuard)
export class PushController {
  constructor(private readonly pushService: PushService) {}

  @Post('subscribe')
  @HttpCode(201)
  subscribe(
    @Req() request: { user: { id: string } },
    @Body() dto: CreatePushSubscriptionDto,
  ) {
    return this.pushService.subscribe(request.user.id, dto);
  }

  @Delete('subscribe')
  unsubscribe(
    @Req() request: { user: { id: string } },
    @Body() dto: DeletePushSubscriptionDto,
  ) {
    return this.pushService.unsubscribe(request.user.id, dto.endpoint);
  }
}