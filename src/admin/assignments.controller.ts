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
import { CreateAssignmentDto } from './dto/create-assignment.dto';
import { UpdateAssignmentDto } from './dto/update-assignment.dto';

@Controller('admin/assignments')
@Roles('ADMIN')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AssignmentsController {
  constructor(private readonly adminService: AdminService) {}

  @Post()
  createAssignment(@Body() dto: CreateAssignmentDto) {
    return this.adminService.createAssignment(dto);
  }

  @Get()
  findAllAssignments() {
    return this.adminService.findAllAssignments();
  }

  @Get(':id')
  findAssignment(@Param('id') id: string) {
    return this.adminService.findAssignment(id);
  }

  @Patch(':id')
  updateAssignment(@Param('id') id: string, @Body() dto: UpdateAssignmentDto) {
    return this.adminService.updateAssignment(id, dto);
  }

  @Delete(':id')
  deleteAssignment(@Param('id') id: string) {
    return this.adminService.deleteAssignment(id);
  }
}
