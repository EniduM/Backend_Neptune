import { PrismaClient } from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as argon2 from 'argon2';
import 'dotenv/config';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is not defined');
}

const adapter = new PrismaPg({
  connectionString,
});

const prisma = new PrismaClient({ adapter });

async function main() {
  const passwordHash = await argon2.hash('Rider@12345');

  const rider = await prisma.user.create({
    data: {
      loginId: 'RID001',
      passwordHash,
      role: 'RIDER',
      status: 'ACTIVE',
      rider: {
        create: {
          fullName: 'test rider',
          nic: '111111111111',
          mobile: '1111111111',
          address: 'Kandy',
        },
      },
    },
    select: {
      id: true,
      loginId: true,
      role: true,
      status: true,
      rider: true,
    },
  });

  console.log('Rider created successfully.');
  console.log(rider);
}

main()
  .catch((error) => {
    console.error('Failed to create rider:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
