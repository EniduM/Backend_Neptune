import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AdminService } from './admin.service';

@Controller('admin/collections')
@Roles('ADMIN')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CollectionsController {
  constructor(private readonly adminService: AdminService) {}

  @Get()
  findAllCollections() {
    return this.adminService.findAllCollections();
  }

  @Get(':id')
  findCollection(@Param('id') id: string) {
    return this.adminService.findCollection(id);
  }
}