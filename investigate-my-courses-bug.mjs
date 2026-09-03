/**
 * Real investigation of My Courses infinite loading bug
 * Traces the exact flow: login -> available courses -> enroll -> my courses
 * Inspects API responses, enrollment record creation, cache state
 */
import fetch from 'node-fetch';

const API_BASE = 'http://localhost:4000';
const WEB_BASE = 'http://localhost:3000';

// Test credentials from seed
const STUDENT_EMAIL = 'student-1788434705311@learnflow.test';
const STUDENT_PASSWORD = 'E2Epass123!';
const ORG_ID = 'cmtlfufv20000vs102old4c94';
const PUBLISHED_COURSE_ID = 'cmtlfulvm000jvs107gtmktme';
const DRAFT_COURSE_ID = 'cmtlfumty000lvs10ip7b0au5';

let sessionCookie = '';

async function login() {
  console.log('\n=== STEP 1: LOGIN ===');
  console.log(`Logging in as: ${STUDENT_EMAIL}`);
  
  const res = await fetch(`${API_BASE}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: STUDENT_EMAIL, password: STUDENT_PASSWORD }),
  });

  if (!res.ok) {
    console.error(`❌ Login failed: ${res.status}`);
    console.error(await res.text());
    process.exit(1);
  }

  // Extract session cookie from Set-Cookie header
  const cookies = res.headers.get('set-cookie');
  if (cookies) {
    const match = cookies.match(/learnflow_session=([^;]+)/);
    if (match) {
      sessionCookie = match[1];
      console.log(`✅ Login successful. Session cookie obtained.`);
    }
  }

  const body = await res.json();
  console.log(`✅ User: ${body.user?.name}, Role: ${body.user?.role}, OrgId: ${body.user?.organizationId}`);
  return body.user;
}

async function checkCurrentEnrollments() {
  console.log('\n=== STEP 2: CHECK CURRENT ENROLLMENTS (before) ===');
  
  const res = await fetch(`${API_BASE}/api/v1/organizations/${ORG_ID}/enrollments`, {
    headers: { Cookie: `learnflow_session=${sessionCookie}` },
  });

  const body = await res.json();
  console.log(`Current enrollments: ${body.data?.length ?? 0}`);
  if (body.data?.length > 0) {
    body.data.forEach(e => console.log(`  - Course ID: ${e.courseId}, Status: ${e.status}`));
  }
  return body.data ?? [];
}

async function getAvailableCourses() {
  console.log('\n=== STEP 3: GET AVAILABLE COURSES (via search) ===');
  
  const res = await fetch(`${API_BASE}/api/v1/organizations/${ORG_ID}/student/search`, {
    headers: { Cookie: `learnflow_session=${sessionCookie}` },
  });

  const body = await res.json();
  console.log(`Available courses: ${body.items?.length ?? 0}`);
  if (body.items?.length > 0) {
    body.items.slice(0, 3).forEach(c => console.log(`  - ${c.title} (ID: ${c.id}), Enrolled: ${c.isEnrolled}`));
  }
  return body.items ?? [];
}

async function enrollInCourse(courseId) {
  console.log(`\n=== STEP 4: ENROLL IN COURSE ${courseId} ===`);
  
  const res = await fetch(`${API_BASE}/api/v1/organizations/${ORG_ID}/enrollments/${courseId}`, {
    method: 'POST',
    headers: { Cookie: `learnflow_session=${sessionCookie}` },
  });

  console.log(`Enrollment response status: ${res.status}`);
  const body = await res.json();
  
  if (!res.ok) {
    console.error(`❌ Enrollment failed: ${body.message ?? 'Unknown error'}`);
    return null;
  }

  console.log(`✅ Enrollment successful`);
  console.log(`  - Enrollment ID: ${body.data?.enrollmentId}`);
  console.log(`  - Status: ${body.data?.status}`);
  console.log(`  - Enrolled At: ${body.data?.enrollmentDate ?? body.data?.enrolledAt}`);
  
  return body.data;
}

async function verifyEnrollmentInDatabase() {
  console.log('\n=== STEP 5: VERIFY ENROLLMENT RECORD IN DB ===');
  
  const res = await fetch(`${API_BASE}/api/v1/organizations/${ORG_ID}/enrollments`, {
    headers: { Cookie: `learnflow_session=${sessionCookie}` },
  });

  const body = await res.json();
  const enrollments = body.data ?? [];
  
  console.log(`Total enrollments now: ${enrollments.length}`);
  enrollments.forEach(e => {
    console.log(`  - Course ID: ${e.courseId}, Status: ${e.status}, Enrolled: ${e.enrollmentDate ?? e.enrolledAt}`);
  });

  const newEnrollment = enrollments.find(e => e.courseId === PUBLISHED_COURSE_ID);
  if (newEnrollment) {
    console.log(`✅ New enrollment found in database`);
    return newEnrollment;
  } else {
    console.log(`❌ New enrollment NOT found in database`);
    return null;
  }
}

async function getMyCoursesViaAPI() {
  console.log('\n=== STEP 6: GET MY COURSES VIA API ===');
  
  const res = await fetch(`${API_BASE}/api/v1/organizations/${ORG_ID}/student/courses`, {
    headers: { Cookie: `learnflow_session=${sessionCookie}` },
  });

  console.log(`My Courses API response status: ${res.status}`);
  console.log(`Response headers:`, {
    'content-type': res.headers.get('content-type'),
    'content-length': res.headers.get('content-length'),
  });

  const body = await res.json();
  
  if (!res.ok) {
    console.error(`❌ My Courses API failed: ${body.message ?? 'Unknown error'}`);
    return null;
  }

  console.log(`✅ My Courses API response received`);
  console.log(`Courses in response: ${body.data?.length ?? 0}`);
  
  if (body.data?.length > 0) {
    body.data.forEach(c => {
      console.log(`  - ${c.title} (ID: ${c.courseId}, Status: ${c.enrollmentStatus})`);
    });
  }

  const enrolledCourse = body.data?.find(c => c.courseId === PUBLISHED_COURSE_ID);
  if (enrolledCourse) {
    console.log(`✅ New course found in My Courses response`);
    return enrolledCourse;
  } else {
    console.log(`⚠️  New course NOT found in My Courses response`);
    return null;
  }
}

async function getMyCoursesStats() {
  console.log('\n=== STEP 7: GET MY COURSES STATS VIA API ===');
  
  const res = await fetch(`${API_BASE}/api/v1/organizations/${ORG_ID}/student/stats`, {
    headers: { Cookie: `learnflow_session=${sessionCookie}` },
  });

  console.log(`Stats API response status: ${res.status}`);
  
  if (res.ok) {
    const body = await res.json();
    console.log(`✅ Stats API response received`);
    console.log(`Stats:`, body.data);
  } else {
    console.error(`❌ Stats API failed: ${res.status}`);
  }
}

async function main() {
  try {
    console.log('🔍 INVESTIGATION: My Courses Infinite Loading Bug');
    console.log('=====================================================');
    
    const user = await login();
    const enrollmentsBefore = await checkCurrentEnrollments();
    const availableCourses = await getAvailableCourses();
    
    // Find an unenrolled course
    const unenrolledCourse = availableCourses.find(
      c => !enrollmentsBefore.some(e => e.courseId === c.id)
    );
    
    if (!unenrolledCourse) {
      console.error('\n❌ No unenrolled courses available for testing');
      process.exit(1);
    }
    
    console.log(`\nSelected course for enrollment: ${unenrolledCourse.title} (ID: ${unenrolledCourse.id})`);
    
    const enrollment = await enrollInCourse(unenrolledCourse.id);
    if (!enrollment) {
      process.exit(1);
    }
    
    await verifyEnrollmentInDatabase();
    const myCourse = await getMyCoursesViaAPI();
    await getMyCoursesStats();
    
    console.log('\n=====================================================');
    console.log('✅ INVESTIGATION COMPLETE');
    console.log('=====================================================');
    
    if (myCourse) {
      console.log('✅ RESULT: New course appears in My Courses API response');
      console.log('   -> If page still shows Loading, issue is in frontend state management');
    } else {
      console.log('❌ RESULT: New course NOT in My Courses API response');
      console.log('   -> Issue is in backend API filtering/querying');
    }
    
  } catch (error) {
    console.error('❌ Investigation failed:', error);
    process.exit(1);
  }
}

main();
