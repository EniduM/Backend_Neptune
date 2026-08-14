import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { AdminModule } from './admin/admin.module';
import { CollectorModule } from './collector/collector.module';
import { RiderModule } from './rider/rider.module';

@Module({
  imports: [PrismaModule, AuthModule, AdminModule, CollectorModule, RiderModule],
})
export class AppModule {}
