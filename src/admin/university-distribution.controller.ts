import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AdminService } from './admin.service';

@Controller('admin/university-distribution')
@Roles('ADMIN')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UniversityDistributionController {
  constructor(private readonly adminService: AdminService) {}

  @Get()
  getDistribution(@Query('date') date: string) {
    return this.adminService.getUniversityDistribution(date);
  }
}