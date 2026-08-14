import 'dotenv/config';
import * as argon2 from 'argon2';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';
const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

const prisma = new PrismaClient({ adapter });

async function main() {
  const password = 'Collector@12345';
  const passwordHash = await argon2.hash(password);

  const user = await prisma.user.create({
    data: {
      loginId: 'COL001',
      passwordHash,
      role: 'COLLECTOR',
      status: 'ACTIVE',

      collector: {
        create: {
          fullName: 'Test Collector',
          nic: 'COLTEST001',
          mobile: '0771234567',
          address: 'Kandy',
          guardianName: 'Test Guardian',
          guardianMobile: '0777654321',
          qrToken: 'QR-COL-TEST-001',
        },
      },
    },
    include: {
      collector: true,
    },
  });

  console.log('Collector created successfully.');
  console.log({
    id: user.id,
    loginId: user.loginId,
    role: user.role,
    status: user.status,
    collectorId: user.collector?.id,
  });
}

main()
  .catch((error) => {
    console.error('Failed to create collector:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
