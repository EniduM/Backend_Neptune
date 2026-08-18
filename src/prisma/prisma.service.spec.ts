process.env.DATABASE_URL = 'postgresql://dummy:dummy@localhost:5432/test';

import { PrismaService } from './prisma.service';

describe('PrismaService', () => {
  it('should be defined', () => {
    const service = new PrismaService();
    expect(service).toBeDefined();
  });

  it('should expose PrismaClient table accessors', () => {
    const service = new PrismaService();
    expect(service.user).toBeDefined();
    expect(service.collector).toBeDefined();
    expect(service.rider).toBeDefined();
    expect(service.vehicle).toBeDefined();
    expect(service.dailyAssignment).toBeDefined();
    expect(service.collectionRequest).toBeDefined();
    expect(service.collection).toBeDefined();
  });
});
