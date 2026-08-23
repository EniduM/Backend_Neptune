import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { CollectionsController } from './collections.controller';
import { RidersController } from './riders.controller';
import { VehiclesController } from './vehicles.controller';
import { AssignmentsController } from './assignments.controller';
import { CollectionRequestsController } from './collection-requests.controller';
import { LeaderboardController } from './leaderboard.controller';
import { DashboardController } from './dashboard.controller';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { UniversitiesController } from './universities.controller';
import { UniversityDistributionController } from './university-distribution.controller';

@Module({
  controllers: [
    AdminController,
    CollectionsController,
    RidersController,
    VehiclesController,
    AssignmentsController,
    CollectionRequestsController,
    LeaderboardController,
    DashboardController,
    ReportsController,
    UniversitiesController,
    UniversityDistributionController,
  ],
  providers: [AdminService, ReportsService],
})
export class AdminModule {}
