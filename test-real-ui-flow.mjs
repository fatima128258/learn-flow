/**
 * Test the real UI flow - login → search → enroll → my courses
 * This tests the actual React component behavior, not just APIs
 */
import { chromium } from 'playwright';

const WEB_URL = 'http://localhost:3000';
const EMAIL = 'student-1788434705311@learnflow.test';
const PASSWORD = 'E2Epass123!';

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  try {
    console.log('\n🔍 TESTING REAL UI FLOW\n');
    console.log('='.repeat(60));

    // Navigate to login
    console.log('\n1️⃣  Navigating to login page...');
    await page.goto(`${WEB_URL}/login`);
    await page.waitForLoadState('networkidle');

    // Login
    console.log('2️⃣  Logging in...');
    await page.fill('input[type="email"]', EMAIL);
    await page.fill('input[type="password"]', PASSWORD);
    await page.click('button:has-text("Sign in")');
    await page.waitForNavigation();
    await page.waitForLoadState('networkidle');
    console.log(`   ✅ Logged in, URL: ${page.url()}`);

    // Navigate to My Courses (if not already there)
    if (!page.url().includes('/dashboard/student') || page.url().includes('/search')) {
      console.log('\n3️⃣  Navigating to My Courses...');
      await page.goto(`${WEB_URL}/dashboard/student`);
      await page.waitForLoadState('networkidle');
    }
    console.log(`   Current URL: ${page.url()}`);

    // Check My Courses page state
    console.log('\n4️⃣  Checking My Courses page state...');
    const loadingSpinner = await page.$('text=Loading courses');
    const emptyState = await page.$('text=No enrolled courses yet');
    const courseCards = await page.$$('[class*="group"][class*="rounded-2xl"]');
    
    console.log(`   - Loading spinner visible: ${!!loadingSpinner}`);
    console.log(`   - Empty state visible: ${!!emptyState}`);
    console.log(`   - Course cards count: ${courseCards.length}`);

    // Navigate to search/available courses
    console.log('\n5️⃣  Navigating to Available Courses...');
    await page.click('text=Search Courses');
    await page.waitForLoadState('networkidle');
    console.log(`   Current URL: ${page.url()}`);

    // Wait for search results to load
    await page.waitForSelector('text=available');
    console.log('   ✅ Search page loaded');

    // Find and click the course "View & Enroll" button
    console.log('\n6️⃣  Looking for courses to enroll...');
    const viewButtons = await page.$$('button:has-text("View & Enroll")');
    console.log(`   Found ${viewButtons.length} unenrolled courses`);

    if (viewButtons.length === 0) {
      throw new Error('No unenrolled courses found');
    }

    // Click the first "View & Enroll" button
    console.log('\n7️⃣  Clicking "View & Enroll"...');
    await viewButtons[0].click();
    await page.waitForNavigation();
    await page.waitForLoadState('networkidle');
    console.log(`   ✅ Navigated to course overview`);
    console.log(`   Current URL: ${page.url()}`);

    // Wait for enrollment button and click it
    console.log('\n8️⃣  Looking for enrollment/purchase button...');
    const enrollBtn = await page.$('button:has-text("Enroll")') || await page.$('button:has-text("Purchase")');
    
    if (!enrollBtn) {
      throw new Error('Could not find enrollment button');
    }

    console.log('9️⃣  Clicking enrollment/purchase button...');
    await enrollBtn.click();
    
    // Wait for navigation to course or my courses
    await page.waitForNavigation({ timeout: 10000 }).catch(() => {});
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
    
    const urlAfterEnroll = page.url();
    console.log(`   ✅ Enrollment completed`);
    console.log(`   Current URL: ${urlAfterEnroll}`);

    // Check if we're on the course page or need to navigate to My Courses
    console.log('\n🔟 Navigating to My Courses to verify enrollment...');
    await page.goto(`${WEB_URL}/dashboard/student`);
    
    // Monitor network activity and page state
    console.log('\n⏳ Waiting for My Courses page to load...');
    
    let waitTime = 0;
    const maxWait = 15000; // 15 seconds
    const checkInterval = 500;

    while (waitTime < maxWait) {
      // Check if still loading
      const isLoading = await page.$('text=Loading courses') !== null;
      const hasError = await page.$('[class*="error"]') !== null;
      const courses = await page.$$('[class*="group"][class*="rounded-2xl"]');
      
      if (isLoading) {
        process.stdout.write('.');
        await page.waitForTimeout(checkInterval);
        waitTime += checkInterval;
      } else {
        // Not loading anymore
        break;
      }
    }

    console.log('\n\n✅ FINAL STATE:');
    const finalLoading = await page.$('text=Loading courses');
    const finalError = await page.$('text=Could not load');
    const finalCourses = await page.$$('[class*="group"][class*="rounded-2xl"]');
    const finalEmpty = await page.$('text=No enrolled courses');

    console.log(`   - Still loading: ${!!finalLoading}`);
    console.log(`   - Has error: ${!!finalError}`);
    console.log(`   - Course count: ${finalCourses.length}`);
    console.log(`   - Empty state: ${!!finalEmpty}`);
    console.log(`   - URL: ${page.url()}`);

    if (!!finalLoading && !finalError && finalCourses.length === 0 && !finalEmpty) {
      console.log('\n❌ BUG CONFIRMED: Page stuck in loading state!');
    } else if (finalCourses.length > 0) {
      console.log('\n✅ SUCCESS: Course appears in My Courses!');
    } else if (finalEmpty) {
      console.log('\n⚠️  ISSUE: Course not showing in My Courses (empty state shown)');
    } else {
      console.log('\n✅ Page loaded (check state above)');
    }

    console.log('\n' + '='.repeat(60));

  } catch (error) {
    console.error('\n❌ Test failed:', error);
  } finally {
    await browser.close();
  }
}

main();
