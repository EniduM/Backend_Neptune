import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AdminService } from './admin.service';

@Controller('admin/leaderboard')
@Roles('ADMIN')
@UseGuards(JwtAuthGuard, RolesGuard)
export class LeaderboardController {
  constructor(private readonly adminService: AdminService) {}

  @Get()
  getLeaderboard(
    @Query('period') period?: string,
    @Query('date') date?: string,
  ) {
    return this.adminService.getLeaderboard(period, date);
  }
}
