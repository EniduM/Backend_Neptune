import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AdminService } from './admin.service';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';
import { UpdateVehicleStatusDto } from './dto/update-vehicle-status.dto';

@Controller('admin/vehicles')
@Roles('ADMIN')
@UseGuards(JwtAuthGuard, RolesGuard)
export class VehiclesController {
  constructor(private readonly adminService: AdminService) {}

  @Post()
  createVehicle(@Body() dto: CreateVehicleDto) {
    return this.adminService.createVehicle(dto);
  }

  @Get()
  findAllVehicles() {
    return this.adminService.findAllVehicles();
  }

  @Get(':id')
  findVehicle(@Param('id') id: string) {
    return this.adminService.findVehicle(id);
  }

  @Patch(':id')
  updateVehicle(@Param('id') id: string, @Body() dto: UpdateVehicleDto) {
    return this.adminService.updateVehicle(id, dto);
  }

  @Patch(':id/status')
  updateVehicleStatus(
    @Param('id') id: string,
    @Body() dto: UpdateVehicleStatusDto,
  ) {
    return this.adminService.updateVehicleStatus(id, dto);
  }

  @Delete(':id')
  deleteVehicle(@Param('id') id: string) {
    return this.adminService.deleteVehicle(id);
  }
}
