import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AdminService } from './admin.service';

@Controller('admin/dashboard')
@Roles('ADMIN')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DashboardController {
  constructor(private readonly adminService: AdminService) {}

  @Get()
  getDashboardStatistics() {
    return this.adminService.getDashboardStatistics();
  }
}