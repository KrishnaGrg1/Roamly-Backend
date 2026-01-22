import {
  LocationCategory,
  PrismaClient,
  TravelStyle,
  TripStatus,
} from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcrypt';
import env from '../config/env';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

const prisma = new PrismaClient({ adapter });

async function main() {
  // =========================
  // Users
  // =========================
  const hasPassword = await bcrypt.hash(
    'password123',
    Number(env.BCRYPT_SALT_ROUNDS)
  );

  const usersData = [
    {
      name: 'Alice Explorer',
      email: 'alice@example.com',
      preferences: {
        travelStyles: ['ADVENTURE', 'CULTURAL'],
        budgetRange: { min: 300, max: 600 },
      },
    },
    {
      name: 'Bob Backpacker',
      email: 'bob@example.com',
      preferences: {
        travelStyles: ['BACKPACKING', 'CULTURAL'],
        budgetRange: { min: 100, max: 300 },
      },
    },
    {
      name: 'Charlie Photographer',
      email: 'charlie@example.com',
      preferences: {
        travelStyles: ['CULTURAL', 'ADVENTURE'],
        budgetRange: { min: 400, max: 800 },
      },
    },
    {
      name: 'Diana Wellness',
      email: 'diana@example.com',
      preferences: {
        travelStyles: ['RELAXED', 'CULTURAL'],
        budgetRange: { min: 500, max: 1000 },
      },
    },
    {
      name: 'Eve Foodie',
      email: 'eve@example.com',
      preferences: {
        travelStyles: ['CULTURAL', 'RELAXED'],
        budgetRange: { min: 200, max: 500 },
      },
    },
  ];

  const users = await Promise.all(
    usersData.map((u) =>
      prisma.user.upsert({
        where: { email: u.email },
        update: {
          preferences: u.preferences,
          password: hasPassword,
        },
        create: {
          ...u,
          password: hasPassword,
        },
      })
    )
  );
  console.log(`✅ Created ${users.length} users`);

  // =========================
  // Locations
  // =========================
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
      avgRating: 4.7,
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
      avgRating: 4.8,
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
      avgRating: 4.7,
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
      avgRating: 4.8,
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
      avgRating: 4.9,
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
      avgRating: 4.9,
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
      avgRating: 4.6,
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
      avgRating: 5.0,
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
      avgRating: 5.0,
    },
  ];

  await prisma.location.createMany({ data: locations, skipDuplicates: true });
  console.log(`✅ Created ${locations.length} locations`);

  // =========================
  // Protected Areas
  // =========================
  const protectedAreas = [
    {
      name: 'Chitwan National Park',
      category: 'UNESCO Natural World Heritage Site',
      feesNPR: { nepali: 100, saarc: 750, foreigner: 1500 },
      childPolicy: 'Below 10 years free',
      paymentLocation: 'At entry point',
    },
    {
      name: 'Sagarmatha National Park',
      category: 'UNESCO Natural World Heritage Site',
      feesNPR: { nepali: 0, saarc: 1500, foreigner: 3000 },
      childPolicy: 'Below 10 years free',
      paymentLocation: [
        'DNPWC Counter, Tourist Service Center, Bhrikutimandap, Kathmandu',
        'Entry point at Monjo',
      ],
    },
    {
      name: 'Annapurna Conservation Area (ACAP)',
      category: 'Conservation Area',
      feesNPR: { nepali: 0, saarc: 200, foreigner: 2000 },
      childPolicy: 'Below 10 years free',
      paymentLocation: [
        'ACAP Counter, Bhrikutimandap, Kathmandu',
        'ACAP Counter, Pokhara',
        'Park entry point',
      ],
    },
  ];

  for (const area of protectedAreas) {
    await prisma.protectedArea.upsert({
      where: { name: area.name },
      create: area,
      update: area, // Safe for seeding
    });
  }

  // =========================
  // Trekking Permits
  // =========================
  const trekkingPermits = [
    {
      area: 'Upper Mustang',
      district: 'Mustang',
      feeUSD: { first_10_days: 500, after_10_days_per_day: 50 },
      issuingAuthority: 'Department of Immigration, Kathmandu',
    },
    {
      area: 'Manaslu',
      district: 'Gorkha',
      feeUSD: {
        sep_to_nov: { first_7_days: 70, after_7_days_per_day: 10 },
        dec_to_aug: { first_7_days: 50, after_7_days_per_day: 7 },
      },
      issuingAuthority: 'Department of Immigration, Kathmandu',
    },
  ];

  for (const permit of trekkingPermits) {
    const existing = await prisma.trekkingPermit.findFirst({
      where: { area: permit.area },
    });

    if (existing) {
      await prisma.trekkingPermit.update({
        where: { id: existing.id },
        data: permit,
      });
    } else {
      await prisma.trekkingPermit.create({ data: permit });
    }
  }

  // =========================
  // Mountaineering Royalties
  // =========================
  const mountRoyalties = [
    {
      mountain: 'Mt. Everest',
      heightM: 8848,
      route: 'Normal Route (South East Ridge)',
      currency: 'USD',
      royalty: {
        spring: { '1_member': 25000, '2_members': 40000, '3_members': 48000 },
        autumn: { '1_member': 12500, '2_members': 20000, '3_members': 24000 },
        winter_summer: {
          '1_member': 6250,
          '2_members': 10000,
          '3_members': 12000,
        },
      },
    },
    {
      category: 'Peaks 7000–7500m',
      currency: 'USD',
      royalty: {
        spring: { '1_member': 1500, '2_members': 1800 },
        autumn: { '1_member': 750, '2_members': 900 },
        winter_summer: { '1_member': 375, '2_members': 450 },
      },
    },
  ];

  for (const r of mountRoyalties) {
    const existing = await prisma.mountaineeringRoyalty.findFirst({
      where: r.mountain ? { mountain: r.mountain } : { category: r.category! },
    });

    if (existing) {
      await prisma.mountaineeringRoyalty.update({
        where: { id: existing.id },
        data: r,
      });
    } else {
      await prisma.mountaineeringRoyalty.create({ data: r });
    }
  }

  // =========================
  // Season Definitions
  // =========================
  const seasons = {
    spring: ['March', 'April', 'May'],
    summer: ['June', 'July', 'August'],
    autumn: ['September', 'October', 'November'],
    winter: ['December', 'January', 'February'],
  };

  for (const [season, months] of Object.entries(seasons)) {
    const existing = await prisma.seasonDefinition.findFirst({
      where: { season },
    });

    if (existing) {
      await prisma.seasonDefinition.update({
        where: { id: existing.id },
        data: { months },
      });
    } else {
      await prisma.seasonDefinition.create({ data: { season, months } });
    }
  }

  console.log(
    `✅ Seeded protected areas, trekking permits, mountaineering royalties, and seasons`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
