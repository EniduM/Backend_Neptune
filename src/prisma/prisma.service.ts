import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '../../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    const connectionString = process.env.DATABASE_URL;

    if (!connectionString) {
      throw new Error('DATABASE_URL is not defined');
    }

    // Safe diagnostic: logs only the database host, port,
    // and whether the Supabase pooler is being used.
    // It does NOT log the database password.
    console.log('DATABASE_URL diagnostic:', {
      host: connectionString.match(/@([^:/]+)/)?.[1] ?? 'unknown',
      port: connectionString.match(/:(\d+)\//)?.[1] ?? 'unknown',
      hasPooler: connectionString.includes('pooler.supabase.com'),
    });

    const adapter = new PrismaPg({
      connectionString,
    });

    super({ adapter });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
