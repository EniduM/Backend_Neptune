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
  ],
  providers: [AdminService, ReportsService],
})
export class AdminModule {}
