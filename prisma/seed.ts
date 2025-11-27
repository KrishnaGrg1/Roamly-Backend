import { PrismaClient } from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcrypt';
import env from '../config/env';
const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

const prisma = new PrismaClient({
  adapter,
});
async function main() {
  // Create multiple users
  const hasPassword = await bcrypt.hash(
    'password123',
    Number(env.BCRYPT_SALT_ROUNDS)
  );
  await prisma.user.createMany({
    data: [
      {
        name: 'Alice',
        email: 'alice@example.com',
        password: hasPassword,
      },
      { email: 'bob@example.com', name: 'Bob', password: hasPassword },

      {
        email: 'charlie@example.com',
        name: 'Charlie',
        password: hasPassword,
      },
      { email: 'diana@example.com', name: 'Diana', password: hasPassword },
      { email: 'eve@example.com', name: 'Eve', password: hasPassword },
      { email: 'frank@example.com', name: 'Frank', password: hasPassword },
      { email: 'grace@example.com', name: 'Grace', password: hasPassword },
      { email: 'henry@example.com', name: 'Henry', password: hasPassword },
      {
        email: 'isabella@example.com',
        name: 'Isabella',
        password: hasPassword,
      },
      { email: 'jack@example.com', name: 'Jack', password: hasPassword },
    ],
    skipDuplicates: true, // prevents errors if you run the seed multiple times
  });

  console.log('Seed data inserted!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
