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
  const hasPassword = await bcrypt.hash(
    'password123',
    Number(env.BCRYPT_SALT_ROUNDS)
  );

  // Create users with different travel preferences
  const users = await Promise.all([
    prisma.user.upsert({
      where: { email: 'alice@example.com' },
      update: {},
      create: {
        name: 'Alice Explorer',
        email: 'alice@example.com',
        password: hasPassword,
        preferences: {
          travelStyles: ['ADVENTURE', 'CULTURAL'],
          budgetRange: { min: 300, max: 600 },
        },
      },
    }),
    prisma.user.upsert({
      where: { email: 'bob@example.com' },
      update: {},
      create: {
        name: 'Bob Backpacker',
        email: 'bob@example.com',
        password: hasPassword,
        preferences: {
          travelStyles: ['BACKPACKING', 'CULTURAL'],
          budgetRange: { min: 100, max: 300 },
        },
      },
    }),
    prisma.user.upsert({
      where: { email: 'charlie@example.com' },
      update: {},
      create: {
        name: 'Charlie Photographer',
        email: 'charlie@example.com',
        password: hasPassword,
        preferences: {
          travelStyles: ['CULTURAL', 'ADVENTURE'],
          budgetRange: { min: 400, max: 800 },
        },
      },
    }),
    prisma.user.upsert({
      where: { email: 'diana@example.com' },
      update: {},
      create: {
        name: 'Diana Wellness',
        email: 'diana@example.com',
        password: hasPassword,
        preferences: {
          travelStyles: ['RELAXED', 'CULTURAL'],
          budgetRange: { min: 500, max: 1000 },
        },
      },
    }),
    prisma.user.upsert({
      where: { email: 'eve@example.com' },
      update: {},
      create: {
        name: 'Eve Foodie',
        email: 'eve@example.com',
        password: hasPassword,
        preferences: {
          travelStyles: ['CULTURAL', 'RELAXED'],
          budgetRange: { min: 200, max: 500 },
        },
      },
    }),
  ]);

  console.log(`✅ Created ${users.length} users`);

  // Create locations
  await prisma.location.createMany({
    data: locations,
    skipDuplicates: true,
  });
  console.log(`✅ Created ${locations.length} locations`);

  // Get location IDs for trip associations
  const kathmandu = await prisma.location.findFirst({
    where: { name: 'Thamel' },
  });
  const pokhara = await prisma.location.findFirst({
    where: { name: 'Pokhara Lakeside' },
  });
  const abc = await prisma.location.findFirst({
    where: { name: 'Annapurna Base Camp (ABC)' },
  });
  const ebc = await prisma.location.findFirst({
    where: { name: 'Everest Base Camp' },
  });

  // Create high-quality detailed trips (for testing trip quality scoring)
  const trip1 = await prisma.trip.create({
    data: {
      userId: users[0].id, // Alice
      source: 'Kathmandu',
      destination: 'Annapurna Base Camp',
      days: 10,
      budgetMin: 500,
      budgetMax: 700,
      travelStyle: [TravelStyle.ADVENTURE, TravelStyle.BACKPACKING],
      itinerary: {
        overview: 'A comprehensive 10-day trek to Annapurna Base Camp',
        days: [
          {
            day: 1,
            title: 'Kathmandu to Pokhara',
            activities: ['Bus journey', 'Lakeside exploration'],
          },
          {
            day: 2,
            title: 'Pokhara to Ghandruk',
            activities: ['Drive to Nayapul', 'Trek to Ghandruk'],
          },
          {
            day: 3,
            title: 'Ghandruk to Chhomrong',
            activities: ['Village walk', 'Mountain views'],
          },
          {
            day: 4,
            title: 'Chhomrong to Bamboo',
            activities: ['Descend to Chhomrong Khola', 'Bamboo forest trek'],
          },
          {
            day: 5,
            title: 'Bamboo to Deurali',
            activities: ['Trek through Himalaya Hotel', 'Reach Deurali'],
          },
          {
            day: 6,
            title: 'Deurali to Annapurna Base Camp',
            activities: ['Pass Machapuchare Base Camp', 'Reach ABC'],
          },
          {
            day: 7,
            title: 'ABC Exploration',
            activities: ['Sunrise views', 'Explore base camp'],
          },
          {
            day: 8,
            title: 'ABC to Bamboo',
            activities: ['Descend back to Bamboo'],
          },
          {
            day: 9,
            title: 'Bamboo to Jhinu Danda',
            activities: ['Trek to Jhinu', 'Hot springs'],
          },
          { day: 10, title: 'Return to Pokhara', activities: ['Trek out'] },
        ],
        accommodation: {
          type: 'Teahouses along the route',
          recommendations: ['Book in advance during peak season'],
        },
        meals: {
          included: true,
          notes: 'Dal bhat available at all teahouses',
        },
        transportation: {
          toDestination: 'Bus from Kathmandu to Pokhara (NPR 800)',
          withinDestination: 'Trekking on foot',
        },
        tips: [
          'Acclimatize properly',
          'Pack warm layers',
          'Bring water purification tablets',
          'Respect local culture',
        ],
      },
      costBreakdown: {
        total: 600,
        accommodation: 200,
        food: 150,
        transportation: 100,
        permits: 50,
        guide: 100,
      },
      status: TripStatus.COMPLETED,
      completedAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000), // 15 days ago
      aiModel: 'gpt-4-turbo-preview',
      aiVersion: 'v1.0',
    },
  });

  const trip2 = await prisma.trip.create({
    data: {
      userId: users[1].id, // Bob
      source: 'Kathmandu',
      destination: 'Pokhara',
      days: 3,
      budgetMin: 150,
      budgetMax: 250,
      travelStyle: [TravelStyle.BACKPACKING, TravelStyle.RELAXED],
      itinerary: {
        overview: 'Budget-friendly Pokhara getaway',
        days: [
          {
            day: 1,
            title: 'Travel to Pokhara',
            activities: ['Tourist bus', 'Check into lakeside hotel'],
          },
          {
            day: 2,
            title: 'Pokhara sightseeing',
            activities: ['Phewa Lake boating', 'Visit Peace Pagoda'],
          },
          {
            day: 3,
            title: 'Return to Kathmandu',
            activities: ['Early morning return'],
          },
        ],
        accommodation: {
          type: 'Budget guesthouse',
          recommendations: ['Lakeside area has many options'],
        },
        meals: {
          included: false,
          notes: 'Street food and local restaurants available',
        },
        transportation: {
          toDestination: 'Tourist bus (NPR 800 round trip)',
          withinDestination: 'Walk or taxi',
        },
        tips: ['Book bus tickets in advance', 'Bargain for boat rides'],
      },
      costBreakdown: {
        total: 200,
        accommodation: 80,
        food: 60,
        transportation: 40,
        activities: 20,
      },
      status: TripStatus.COMPLETED,
      completedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
      aiModel: 'gpt-4-turbo-preview',
      aiVersion: 'v1.0',
    },
  });

  // Low-quality trip (minimal details - should rank lower)
  const trip3 = await prisma.trip.create({
    data: {
      userId: users[2].id, // Charlie
      source: 'Kathmandu',
      destination: 'Bhaktapur',
      days: 1,
      budgetMin: null,
      budgetMax: null,
      travelStyle: [TravelStyle.CULTURAL],
      itinerary: {
        type: 'text',
        content: 'Day trip to Bhaktapur to see temples and squares.',
      },
      status: TripStatus.COMPLETED,
      completedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
      aiModel: 'gpt-4-turbo-preview',
      aiVersion: 'v1.0',
    },
  });

  // High-quality Everest Base Camp trek (should rank very high)
  const trip4 = await prisma.trip.create({
    data: {
      userId: users[0].id, // Alice (experienced user now)
      source: 'Kathmandu',
      destination: 'Everest Base Camp',
      days: 14,
      budgetMin: 1000,
      budgetMax: 1500,
      travelStyle: [TravelStyle.ADVENTURE, TravelStyle.BACKPACKING],
      itinerary: {
        overview:
          'The ultimate Himalayan adventure to the base of Mount Everest',
        days: Array.from({ length: 14 }, (_, i) => ({
          day: i + 1,
          title: `Day ${i + 1}`,
          activities: ['Trekking activities', 'Acclimatization'],
        })),
        accommodation: {
          type: 'Teahouses',
          recommendations: ['Book Namche accommodation early'],
        },
        meals: {
          included: true,
          notes: 'Three meals daily',
        },
        transportation: {
          toDestination: 'Flight Kathmandu to Lukla',
          withinDestination: 'Trekking',
        },
        tips: [
          'Acclimatize in Namche',
          'Hire a guide',
          'Get travel insurance',
          'Pack for extreme cold',
          'Bring altitude sickness medication',
        ],
      },
      costBreakdown: {
        total: 1200,
        accommodation: 350,
        food: 300,
        transportation: 350,
        permits: 100,
        guide: 100,
      },
      status: TripStatus.COMPLETED,
      completedAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000), // 60 days ago (older)
      aiModel: 'gpt-4-turbo-preview',
      aiVersion: 'v1.0',
    },
  });

  // Medium-quality cultural trip
  const trip5 = await prisma.trip.create({
    data: {
      userId: users[3].id, // Diana
      source: 'Kathmandu',
      destination: 'Lumbini',
      days: 4,
      budgetMin: 300,
      budgetMax: 500,
      travelStyle: [TravelStyle.RELAXED, TravelStyle.CULTURAL],
      itinerary: {
        overview: "Spiritual journey to Buddha's birthplace",
        days: [
          {
            day: 1,
            title: 'Travel to Lumbini',
            activities: ['Bus journey', 'Hotel check-in'],
          },
          {
            day: 2,
            title: 'Lumbini exploration',
            activities: ['Maya Devi Temple', 'Sacred Garden'],
          },
          {
            day: 3,
            title: 'Monastery circuit',
            activities: ['Visit international monasteries'],
          },
          {
            day: 4,
            title: 'Return to Kathmandu',
            activities: ['Morning meditation', 'Return journey'],
          },
        ],
        accommodation: {
          type: 'Mid-range hotel',
          recommendations: ['Hotels near Sacred Garden'],
        },
        meals: { included: false, notes: 'Vegetarian options available' },
        transportation: {
          toDestination: 'Night bus or flight',
          withinDestination: 'Bicycle or rickshaw',
        },
        tips: ['Dress modestly', 'Visit early morning'],
      },
      costBreakdown: {
        total: 400,
        accommodation: 150,
        food: 100,
        transportation: 120,
        activities: 30,
      },
      status: TripStatus.COMPLETED,
      completedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
      aiModel: 'gpt-4-turbo-preview',
      aiVersion: 'v1.0',
    },
  });

  // New uncompleted trip (shouldn't appear in feed)
  await prisma.trip.create({
    data: {
      userId: users[4].id, // Eve
      source: 'Kathmandu',
      destination: 'Chitwan',
      days: 3,
      budgetMin: 250,
      budgetMax: 400,
      travelStyle: [TravelStyle.ADVENTURE, TravelStyle.RELAXED],
      itinerary: {
        overview: 'Wildlife safari in Chitwan National Park',
        days: [
          { day: 1, title: 'Travel to Chitwan', activities: ['Bus journey'] },
          {
            day: 2,
            title: 'Jungle safari',
            activities: ['Elephant ride', 'Jungle walk'],
          },
          { day: 3, title: 'Return', activities: ['Morning activities'] },
        ],
      },
      status: TripStatus.GENERATED, // Not completed - won't have posts
      aiModel: 'gpt-4-turbo-preview',
      aiVersion: 'v1.0',
    },
  });

  console.log(`✅ Created trips`);

  // Create posts for completed trips
  const post1 = await prisma.post.create({
    data: {
      userId: users[0].id,
      tripId: trip1.id,
      caption:
        'Just completed the most amazing ABC trek! 10 days of pure mountain magic 🏔️ #AnnapurnaBaseCamp #Nepal',
    },
  });

  const post2 = await prisma.post.create({
    data: {
      userId: users[1].id,
      tripId: trip2.id,
      caption: 'Budget Pokhara trip - beautiful lakeside vibes! 💙',
    },
  });

  const post3 = await prisma.post.create({
    data: {
      userId: users[2].id,
      tripId: trip3.id,
      caption: 'Quick day trip to Bhaktapur!',
    },
  });

  const post4 = await prisma.post.create({
    data: {
      userId: users[0].id,
      tripId: trip4.id,
      caption:
        'Everest Base Camp ✓ A dream come true! 14 days of challenging trekking but worth every step. Full itinerary in trip details 🏔️',
    },
  });

  const post5 = await prisma.post.create({
    data: {
      userId: users[3].id,
      tripId: trip5.id,
      caption:
        "Peaceful spiritual journey to Lumbini. Found inner peace at Buddha's birthplace 🙏",
    },
  });

  console.log(`✅ Created ${5} posts`);

  // Create engagement data to test ranking algorithm

  // Post 1 (ABC) - High quality trip with moderate engagement
  await prisma.bookmark.createMany({
    data: [
      { userId: users[1].id, postId: post1.id },
      { userId: users[2].id, postId: post1.id },
      { userId: users[3].id, postId: post1.id },
      { userId: users[4].id, postId: post1.id },
    ],
  });

  await prisma.comment.createMany({
    data: [
      { userId: users[1].id, postId: post1.id, content: 'Amazing itinerary!' },
      {
        userId: users[2].id,
        postId: post1.id,
        content: 'How was the weather?',
      },
      {
        userId: users[3].id,
        postId: post1.id,
        content: 'Definitely saving this for my next trip',
      },
    ],
  });

  await prisma.like.createMany({
    data: [
      { userId: users[1].id, postId: post1.id },
      { userId: users[2].id, postId: post1.id },
      { userId: users[3].id, postId: post1.id },
      { userId: users[4].id, postId: post1.id },
    ],
  });

  // Post 2 (Budget Pokhara) - Low quality but VERY viral (lots of likes, few saves)
  await prisma.like.createMany({
    data: Array.from({ length: 50 }, (_, i) => ({
      userId: users[i % 5]!.id,
      postId: post2.id,
    })).slice(0, 5), // Create 5 unique likes
  });

  await prisma.comment.createMany({
    data: [
      { userId: users[0].id, postId: post2.id, content: 'Nice!' },
      { userId: users[2].id, postId: post2.id, content: 'Cool' },
    ],
  });

  await prisma.bookmark.create({
    data: { userId: users[4].id, postId: post2.id },
  });

  // Post 3 (Bhaktapur) - Low quality, low engagement
  await prisma.like.create({
    data: { userId: users[0].id, postId: post3.id },
  });

  // Post 4 (EBC) - Highest quality trek with strong engagement (should rank high despite being older)
  await prisma.bookmark.createMany({
    data: [
      { userId: users[1].id, postId: post4.id },
      { userId: users[2].id, postId: post4.id },
      { userId: users[3].id, postId: post4.id },
      { userId: users[4].id, postId: post4.id },
    ],
  });

  await prisma.comment.createMany({
    data: [
      {
        userId: users[1].id,
        postId: post4.id,
        content: 'This is my dream trek!',
      },
      { userId: users[2].id, postId: post4.id, content: 'How was altitude?' },
      {
        userId: users[3].id,
        postId: post4.id,
        content: 'Incredible detail, thank you!',
      },
      { userId: users[4].id, postId: post4.id, content: 'Saving for 2026!' },
    ],
  });

  await prisma.like.createMany({
    data: [
      { userId: users[1].id, postId: post4.id },
      { userId: users[2].id, postId: post4.id },
      { userId: users[3].id, postId: post4.id },
      { userId: users[4].id, postId: post4.id },
    ],
  });

  // Post 5 (Lumbini) - Moderate quality and engagement
  await prisma.bookmark.createMany({
    data: [
      { userId: users[0].id, postId: post5.id },
      { userId: users[2].id, postId: post5.id },
    ],
  });

  await prisma.comment.create({
    data: {
      userId: users[0].id,
      postId: post5.id,
      content: 'Beautiful spiritual journey',
    },
  });

  await prisma.like.createMany({
    data: [
      { userId: users[0].id, postId: post5.id },
      { userId: users[1].id, postId: post5.id },
      { userId: users[2].id, postId: post5.id },
    ],
  });

  console.log(`✅ Created engagement data (bookmarks, comments, likes)`);

  // Create reviews for trips (for trust score)
  await prisma.review.createMany({
    data: [
      {
        userId: users[1].id,
        locationId: abc!.id,
        tripId: trip1.id,
        rating: 5,
        comment: 'Amazing trek, well organized',
      },
      {
        userId: users[0].id,
        locationId: ebc!.id,
        tripId: trip4.id,
        rating: 5,
        comment: 'Life-changing experience',
      },
    ],
  });

  console.log(`✅ Created reviews`);

  // Log AI interactions
  await prisma.aiInteraction.createMany({
    data: [
      {
        userId: users[0].id,
        purpose: 'generate-itinerary',
        model: 'gpt-4-turbo-preview',
        tokens: 2500,
        prompt: 'Generate a 10-day itinerary for Annapurna Base Camp trek',
        response: 'Detailed itinerary with daily activities and recommendations',
      },
      {
        userId: users[1].id,
        purpose: 'generate-itinerary',
        model: 'gpt-4-turbo-preview',
        tokens: 1800,
        prompt: 'Generate a 3-day budget itinerary for Pokhara',
        response: 'Budget-friendly itinerary with affordable options',
      },
      {
        userId: users[0].id,
        purpose: 'generate-itinerary',
        model: 'gpt-4-turbo-preview',
        tokens: 3500,
        prompt: 'Generate a 14-day itinerary for Everest Base Camp trek',
        response: 'Comprehensive trekking itinerary with acclimatization schedule',
      },
    ],
  });

  console.log(`✅ Logged AI interactions`);

  console.log('\n🎉 Seed completed successfully!\n');
  console.log('📊 Summary:');
  console.log(`   - ${users.length} users created`);
  console.log(`   - ${locations.length} locations created`);
  console.log(`   - 6 trips created (5 completed, 1 in progress)`);
  console.log(`   - 5 posts created`);
  console.log(`   - Multiple bookmarks, comments, likes added`);
  console.log(`   - 2 reviews added`);
  console.log(`   - 3 AI interactions logged`);
  console.log('\n🔐 Test credentials:');
  console.log('   Email: alice@example.com');
  console.log('   Password: password123');
  console.log('\n📝 Feed ranking test scenarios:');
  console.log(
    '   - Post 4 (EBC): High quality + high engagement (should rank #1)'
  );
  console.log(
    '   - Post 1 (ABC): High quality + moderate engagement (should rank #2)'
  );
  console.log('   - Post 5 (Lumbini): Medium quality + moderate engagement');
  console.log(
    '   - Post 2 (Pokhara): Low quality but viral (should rank lower)'
  );
  console.log(
    '   - Post 3 (Bhaktapur): Low quality + low engagement (should rank last)'
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
