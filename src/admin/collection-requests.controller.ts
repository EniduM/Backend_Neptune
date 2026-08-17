import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AdminService } from './admin.service';

@Controller('admin/collection-requests')
@Roles('ADMIN')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CollectionRequestsController {
  constructor(private readonly adminService: AdminService) {}

  @Get()
  findAllCollectionRequests() {
    return this.adminService.findAllCollectionRequests();
  }

  @Get(':id')
  findCollectionRequest(@Param('id') id: string) {
    return this.adminService.findCollectionRequest(id);
  }
}
