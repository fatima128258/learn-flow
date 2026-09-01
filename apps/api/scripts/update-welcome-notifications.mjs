#!/usr/bin/env node
/**
 * Update existing welcome notifications to new motivational message
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function updateWelcomeNotifications() {
  console.log('🔍 Finding existing welcome notifications...\n');

  try {
    // Find all WELCOME type notifications
    const welcomeNotifications = await prisma.notification.findMany({
      where: {
        type: 'WELCOME',
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    console.log(`📊 Found ${welcomeNotifications.length} welcome notifications\n`);

    if (welcomeNotifications.length === 0) {
      console.log('✅ No welcome notifications to update!');
      return;
    }

    let updated = 0;

    for (const notification of welcomeNotifications) {
      const userName = notification.user.name || 'User';
      
      const newTitle = `🎉 Welcome, ${userName}!`;
      const newBody = `Your learning journey begins now! Explore courses, complete lessons, and unlock certificates. Let's achieve great things together! 🚀`;

      // Only update if the notification has the old format
      if (notification.title.includes('star academy') || notification.title.includes('Welcome to')) {
        await prisma.notification.update({
          where: {
            id: notification.id,
          },
          data: {
            title: newTitle,
            body: newBody,
          },
        });

        console.log(`✓ Updated notification for ${notification.user.name || notification.user.email}`);
        updated++;
      }
    }

    console.log(`\n✅ Successfully updated ${updated} welcome notifications!`);
  } catch (error) {
    console.error('❌ Error updating notifications:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

updateWelcomeNotifications()
  .then(() => {
    console.log('\n🎉 Script completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Script failed:', error);
    process.exit(1);
  });
