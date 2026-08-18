import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CollectorService } from './collector.service';
import { CreateCollectionRequestDto } from './dto/create-collection-request.dto';

@Controller('collector')
@Roles('COLLECTOR')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CollectorController {
  constructor(private readonly collectorService: CollectorService) {}

  @Get('me')
  getMe(@Req() request: Request) {
    const user = request.user as { id: string };
    return this.collectorService.getMe(user.id);
  }

  @Get('assignments/today')
  findTodayAssignment(@Req() request: Request) {
    const user = request.user as { id: string };
    return this.collectorService.findTodayAssignment(user.id);
  }

  @Post('collection-requests')
  createCollectionRequest(
    @Req() request: Request,
    @Body() dto: CreateCollectionRequestDto,
  ) {
    const user = request.user as { id: string };
    return this.collectorService.createCollectionRequest(user.id, dto);
  }

  @Get('collection-requests')
  findCollectionRequests(@Req() request: Request) {
    const user = request.user as { id: string };
    return this.collectorService.findCollectionRequests(user.id);
  }

  @Get('collection-requests/:id')
  findCollectionRequest(@Req() request: Request, @Param('id') id: string) {
    const user = request.user as { id: string };
    return this.collectorService.findCollectionRequest(user.id, id);
  }

  @Patch('collection-requests/:id/cancel')
  cancelCollectionRequest(@Req() request: Request, @Param('id') id: string) {
    const user = request.user as { id: string };
    return this.collectorService.cancelCollectionRequest(user.id, id);
  }

  @Get('leaderboard')
  getLeaderboard(
    @Req() request: Request,
    @Query('period') period: string = 'all',
  ) {
    const user = request.user as { id: string };
    return this.collectorService.getLeaderboard(user.id, period);
  }
}
