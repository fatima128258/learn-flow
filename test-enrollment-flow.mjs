import fetch from 'node-fetch';

const API_BASE = 'http://localhost:4000';
const STUDENT_EMAIL = 'student-1788435649412@learnflow.test';
const STUDENT_PASSWORD = 'E2Epass123!';
const ORG_ID = 'cmtlgeox40000vsrcisj969mh';
const COURSE_ID = 'cmtlgetqp000jvsrc5sh4zklm';

let sessionCookie = '';

async function login() {
  console.log('=== STEP 1: LOGIN ===\n');
  const res = await fetch(`${API_BASE}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: STUDENT_EMAIL, password: STUDENT_PASSWORD }),
  });

  if (!res.ok) {
    console.error('❌ Login failed:', res.status);
    process.exit(1);
  }

  const cookies = res.headers.get('set-cookie');
  if (cookies) {
    const match = cookies.match(/learnflow_session=([^;]+)/);
    if (match) {
      sessionCookie = match[1];
      console.log('✅ Session obtained\n');
    }
  }
}

async function getAvailableCourses() {
  console.log('=== STEP 2: GET AVAILABLE COURSES ===\n');
  
  const res = await fetch(`${API_BASE}/api/v1/organizations/${ORG_ID}/student/search`, {
    headers: { Cookie: `learnflow_session=${sessionCookie}` },
  });

  const body = await res.json();
  console.log(`Available courses: ${body.data?.length ?? 0}`);
  body.data?.forEach(c => {
    console.log(`  - ${c.title} (ID: ${c.id}, Enrolled: ${c.isEnrolled})`);
  });
  console.log();
}

async function enrollInCourse() {
  console.log('=== STEP 3: PURCHASE/ENROLL IN COURSE ===\n');
  
  const res = await fetch(`${API_BASE}/api/v1/organizations/${ORG_ID}/student/courses/${COURSE_ID}/purchase`, {
    method: 'POST',
    headers: { Cookie: `learnflow_session=${sessionCookie}` },
  });

  console.log(`Purchase response status: ${res.status}`);
  
  if (!res.ok) {
    const err = await res.json();
    console.error(`❌ Purchase failed: ${JSON.stringify(err)}`);
    return false;
  }

  const body = await res.json();
  console.log(`✅ Purchase/Enrollment successful`);
  console.log(`  - Order ID: ${body.data?.orderId}`);
  console.log(`  - Enrollment ID: ${body.data?.enrollmentId}`);
  console.log();
  return true;
}

async function getMyCoursesAPI() {
  console.log('=== STEP 4: GET MY COURSES VIA API ===\n');
  
  const res = await fetch(`${API_BASE}/api/v1/organizations/${ORG_ID}/student/courses`, {
    headers: { Cookie: `learnflow_session=${sessionCookie}` },
  });

  console.log(`My Courses API status: ${res.status}`);
  
  if (!res.ok) {
    const err = await res.json();
    console.error(`❌ My Courses API failed: ${JSON.stringify(err)}`);
    return [];
  }

  const body = await res.json();
  console.log(`My Courses returned: ${body.data?.length ?? 0} courses`);
  
  if (body.data?.length > 0) {
    body.data.forEach(c => {
      console.log(`  - ${c.title} (ID: ${c.courseId}, Status: ${c.enrollmentStatus})`);
    });
  } else {
    console.log(`  (empty)`);
  }
  console.log();
  
  return body.data ?? [];
}

async function getMyCoursesStats() {
  console.log('=== STEP 5: GET MY COURSES STATS ===\n');
  
  const res = await fetch(`${API_BASE}/api/v1/organizations/${ORG_ID}/student/stats`, {
    headers: { Cookie: `learnflow_session=${sessionCookie}` },
  });

  console.log(`Stats API status: ${res.status}`);
  
  if (res.ok) {
    const body = await res.json();
    console.log(`Stats received:`, body.data);
  }
  console.log();
}

async function main() {
  try {
    console.log('\n🔍 REAL END-TO-END ENROLLMENT TEST\n');
    console.log('=====================================================\n');
    
    await login();
    await getAvailableCourses();
    
    const enrolled = await enrollInCourse();
    if (!enrolled) {
      process.exit(1);
    }
    
    const myCourses = await getMyCoursesAPI();
    await getMyCoursesStats();
    
    console.log('=====================================================\n');
    
    if (myCourses.length > 0) {
      console.log('✅ SUCCESS: Newly enrolled course appears in My Courses API');
    } else {
      console.log('❌ ISSUE: Newly enrolled course NOT in My Courses API');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

main();
