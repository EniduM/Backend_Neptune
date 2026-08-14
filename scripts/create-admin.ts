import 'dotenv/config';
import * as argon2 from 'argon2';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';

async function main() {
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL!,
  });

  const prisma = new PrismaClient({ adapter });

  try {
    const loginId = 'ADMIN001';
    const password = 'Admin@12345';

    const existingUser = await prisma.user.findUnique({
      where: {
        loginId,
      },
    });

    if (existingUser) {
      console.log(`User ${loginId} already exists.`);
      return;
    }

    const passwordHash = await argon2.hash(password);

    const admin = await prisma.user.create({
      data: {
        loginId,
        passwordHash,
        role: 'ADMIN',
        status: 'ACTIVE',
      },
    });

    console.log('Admin created successfully.');
    console.log({
      id: admin.id,
      loginId: admin.loginId,
      role: admin.role,
      status: admin.status,
    });
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('Failed to create admin:', error);
  process.exit(1);
});
