import 'dotenv/config';
import * as argon2 from 'argon2';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

const prisma = new PrismaClient({ adapter });

async function main() {
  const loginId = 'COL001';
  const newPassword = 'Collector@12345';

  const user = await prisma.user.findUnique({
    where: { loginId },
  });

  if (!user) {
    throw new Error(`User ${loginId} not found`);
  }

  if (user.role !== 'COLLECTOR') {
    throw new Error(`User ${loginId} is not a COLLECTOR`);
  }

  const passwordHash = await argon2.hash(newPassword);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      status: 'ACTIVE',
    },
  });

  console.log('Collector password reset successfully.');
  console.log(`Login ID: ${loginId}`);
  console.log(`New password: ${newPassword}`);
}

main()
  .catch((error) => {
    console.error('Failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
