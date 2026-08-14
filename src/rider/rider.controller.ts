import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CompleteCollectionRequestDto } from './dto/complete-collection-request.dto';
import { RiderService } from './rider.service';

@Controller('rider')
@Roles('RIDER')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RiderController {
  constructor(private readonly riderService: RiderService) {}

  @Get('collection-requests')
  findPendingRequests(@Req() request: Request) {
    const user = request.user as { id: string };
    return this.riderService.findPendingRequests(user.id);
  }

  @Get('collection-requests/my')
  findMyRequests(@Req() request: Request) {
    const user = request.user as { id: string };
    return this.riderService.findMyRequests(user.id);
  }

  @Get('collection-requests/:id')
  findMyRequest(@Req() request: Request, @Param('id') id: string) {
    const user = request.user as { id: string };
    return this.riderService.findMyRequest(user.id, id);
  }

  @Patch('collection-requests/:id/accept')
  acceptRequest(@Req() request: Request, @Param('id') id: string) {
    const user = request.user as { id: string };
    return this.riderService.acceptRequest(user.id, id);
  }

  @Post('collection-requests/:id/complete')
  completeRequest(
    @Req() request: Request,
    @Param('id') id: string,
    @Body() dto: CompleteCollectionRequestDto,
  ) {
    const user = request.user as { id: string };
    return this.riderService.completeRequest(user.id, id, dto);
  }
}
