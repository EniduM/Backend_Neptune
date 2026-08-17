import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { RidersController } from './riders.controller';
import { VehiclesController } from './vehicles.controller';
import { AssignmentsController } from './assignments.controller';
import { CollectionRequestsController } from './collection-requests.controller';

@Module({
  controllers: [
    AdminController,
    RidersController,
    VehiclesController,
    AssignmentsController,
    CollectionRequestsController,
  ],
  providers: [AdminService],
})
export class AdminModule {}
