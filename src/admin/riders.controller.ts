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
import { CreateRiderDto } from './dto/create-rider.dto';
import { UpdateRiderDto } from './dto/update-rider.dto';
import { UpdateRiderStatusDto } from './dto/update-rider-status.dto';

@Controller('admin/riders')
@Roles('ADMIN')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RidersController {
  constructor(private readonly adminService: AdminService) {}

  @Post()
  createRider(@Body() dto: CreateRiderDto) {
    return this.adminService.createRider(dto);
  }

  @Get()
  findAllRiders() {
    return this.adminService.findAllRiders();
  }

  @Get(':id')
  findRider(@Param('id') id: string) {
    return this.adminService.findRider(id);
  }

  @Patch(':id')
  updateRider(@Param('id') id: string, @Body() dto: UpdateRiderDto) {
    return this.adminService.updateRider(id, dto);
  }

  @Patch(':id/status')
  updateRiderStatus(
    @Param('id') id: string,
    @Body() dto: UpdateRiderStatusDto,
  ) {
    return this.adminService.updateRiderStatus(id, dto);
  }

  @Delete(':id')
  deleteRider(@Param('id') id: string) {
    return this.adminService.deleteRider(id);
  }
}
