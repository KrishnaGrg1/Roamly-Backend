import { PrismaClient } from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

const prisma = new PrismaClient({
  adapter,
});

async function main() {
  // Create multiple users
  await prisma.user.createMany({
    data: [
      { email: 'alice@example.com', name: 'Alice', password: 'password123' },
      { email: 'bob@example.com', name: 'Bob', password: 'password123' },
      {
        email: 'charlie@example.com',
        name: 'Charlie',
        password: 'password123',
      },
      { email: 'diana@example.com', name: 'Diana', password: 'password123' },
      { email: 'eve@example.com', name: 'Eve', password: 'password123' },
      { email: 'frank@example.com', name: 'Frank', password: 'password123' },
      { email: 'grace@example.com', name: 'Grace', password: 'password123' },
      { email: 'henry@example.com', name: 'Henry', password: 'password123' },
      {
        email: 'isabella@example.com',
        name: 'Isabella',
        password: 'password123',
      },
      { email: 'jack@example.com', name: 'Jack', password: 'password123' },
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
