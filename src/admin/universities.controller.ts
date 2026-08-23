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
import { CreateUniversityDto } from './dto/create-university.dto';
import { UpdateUniversityDto } from './dto/update-university.dto';

@Controller('admin/universities')
@Roles('ADMIN')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UniversitiesController {
  constructor(private readonly adminService: AdminService) {}

  @Post()
  createUniversity(@Body() dto: CreateUniversityDto) {
    return this.adminService.createUniversity(dto);
  }

  @Get()
  findAllUniversities() {
    return this.adminService.findAllUniversities();
  }

  @Get(':id')
  findUniversity(@Param('id') id: string) {
    return this.adminService.findUniversity(id);
  }

  @Patch(':id')
  updateUniversity(
    @Param('id') id: string,
    @Body() dto: UpdateUniversityDto,
  ) {
    return this.adminService.updateUniversity(id, dto);
  }

  @Delete(':id')
  deleteUniversity(@Param('id') id: string) {
    return this.adminService.deleteUniversity(id);
  }
}