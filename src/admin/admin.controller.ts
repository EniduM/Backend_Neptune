import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AdminService } from './admin.service';
import { CreateCollectorDto } from './dto/create-collector.dto';
import { UpdateCollectorDto } from './dto/update-collector.dto';
import { UpdateCollectorStatusDto } from './dto/update-collector-status.dto';

@Controller('admin/collectors')
@Roles('ADMIN')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Post()
  createCollector(@Body() dto: CreateCollectorDto) {
    return this.adminService.createCollector(dto);
  }

  @Get()
  findAllCollectors() {
    return this.adminService.findAllCollectors();
  }

  @Get(':id')
  findCollector(@Param('id') id: string) {
    return this.adminService.findCollector(id);
  }

  @Patch(':id')
  updateCollector(@Param('id') id: string, @Body() dto: UpdateCollectorDto) {
    return this.adminService.updateCollector(id, dto);
  }

  @Patch(':id/status')
  updateCollectorStatus(
    @Param('id') id: string,
    @Body() dto: UpdateCollectorStatusDto,
  ) {
    return this.adminService.updateCollectorStatus(id, dto);
  }
}
