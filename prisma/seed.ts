import { LocationCategory, PrismaClient } from '../generated/prisma/client';
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
  const locations = [
    {
      name: 'Pashupatinath Temple',
      category: LocationCategory.ATTRACTION,
      description:
        'A sacred Hindu temple dedicated to Lord Shiva, located on the banks of the Bagmati River. UNESCO World Heritage Site.',
      latitude: 27.7104,
      longitude: 85.348,
      address: 'Gaushala, Kathmandu',
      priceRange: 'Free – NPR 1,000 for foreign visitors',
      rating: 4.7,
    },
    {
      name: 'Boudhanath Stupa',
      category: LocationCategory.ATTRACTION,
      description:
        'One of the largest stupas in the world and an important Buddhist pilgrimage site.',
      latitude: 27.7215,
      longitude: 85.362,
      address: 'Boudha, Kathmandu',
      priceRange: 'NPR 100 – 400',
      rating: 4.8,
    },
    {
      name: 'Swayambhunath (Monkey Temple)',
      category: LocationCategory.ATTRACTION,
      description:
        'Ancient stupa atop a hill offering panoramic views of Kathmandu.',
      latitude: 27.7149,
      longitude: 85.2901,
      address: 'Swayambhu, Kathmandu',
      priceRange: 'NPR 50 – 200',
      rating: 4.7,
    },
    {
      name: 'Pokhara Lakeside',
      category: LocationCategory.ATTRACTION,
      description:
        'Popular lakeside tourist hub with nightlife, cafés, and boating.',
      latitude: 28.2096,
      longitude: 83.9856,
      address: 'Lakeside, Pokhara',
      priceRange: 'Free',
      rating: 4.8,
    },
    {
      name: 'Phewa Lake',
      category: LocationCategory.ATTRACTION,
      description:
        'Freshwater lake surrounded by mountains, popular for boating.',
      latitude: 28.215,
      longitude: 83.958,
      address: 'Pokhara',
      priceRange: 'NPR 100 – 500 (boating)',
      rating: 4.9,
    },
    {
      name: 'Sarangkot Viewpoint',
      category: LocationCategory.VIEWPOINT,
      description:
        'Famous sunrise viewpoint offering panoramic Himalayan views.',
      latitude: 28.243,
      longitude: 83.9775,
      address: 'Sarangkot, Pokhara',
      priceRange: 'NPR 200 – 500',
      rating: 4.9,
    },
    {
      name: 'Thamel',
      category: LocationCategory.SHOPPING,
      description:
        'Tourist hub with shops, bars, restaurants, and trekking stores.',
      latitude: 27.7141,
      longitude: 85.311,
      address: 'Thamel, Kathmandu',
      priceRange: 'Varies',
      rating: 4.6,
    },
    {
      name: 'Annapurna Base Camp (ABC)',
      category: LocationCategory.TREKKING,
      description:
        'World-famous trekking destination surrounded by Himalayan peaks.',
      latitude: 28.53,
      longitude: 83.82,
      address: 'Annapurna Sanctuary',
      priceRange: 'Permit fees apply',
      rating: 5.0,
    },
    {
      name: 'Everest Base Camp',
      category: LocationCategory.TREKKING,
      description:
        'Legendary trekking destination near Mount Everest and Khumbu Icefall.',
      latitude: 28.0026,
      longitude: 86.8528,
      address: 'Khumbu, Solukhumbu District',
      priceRange: 'Permit fees apply',
      rating: 5.0,
    },
  ];
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
  await prisma.location.createMany({
    data: locations,
    skipDuplicates: true,
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
