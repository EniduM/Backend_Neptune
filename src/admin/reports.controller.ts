import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AssignmentsReportQueryDto } from './dto/assignments-report-query.dto';
import { CollectionRequestsReportQueryDto } from './dto/collection-requests-report-query.dto';
import { CollectionsReportQueryDto } from './dto/collections-report-query.dto';
import { CollectorsReportQueryDto } from './dto/collectors-report-query.dto';
import { RidersReportQueryDto } from './dto/riders-report-query.dto';
import { VehiclesReportQueryDto } from './dto/vehicles-report-query.dto';
import { ReportsService } from './reports.service';

@Controller('admin/reports')
@Roles('ADMIN')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('collections')
  collectionsReport(@Query() query: CollectionsReportQueryDto) {
    return this.reportsService.getCollectionsReport(query);
  }

  @Get('collection-requests')
  collectionRequestsReport(@Query() query: CollectionRequestsReportQueryDto) {
    return this.reportsService.getCollectionRequestsReport(query);
  }

  @Get('collectors')
  collectorsReport(@Query() query: CollectorsReportQueryDto) {
    return this.reportsService.getCollectorsReport(query);
  }

  @Get('riders')
  ridersReport(@Query() query: RidersReportQueryDto) {
    return this.reportsService.getRidersReport(query);
  }

  @Get('vehicles')
  vehiclesReport(@Query() query: VehiclesReportQueryDto) {
    return this.reportsService.getVehiclesReport(query);
  }

  @Get('assignments')
  assignmentsReport(@Query() query: AssignmentsReportQueryDto) {
    return this.reportsService.getAssignmentsReport(query);
  }
}