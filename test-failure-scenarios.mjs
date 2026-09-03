import fetch from 'node-fetch';

const API_BASE = 'http://localhost:4000';
const STUDENT_EMAIL = 'student-1788435649412@learnflow.test';
const STUDENT_PASSWORD = 'E2Epass123!';
const ORG_ID = 'cmtlgeox40000vsrcisj969mh';
const COURSE_ID = 'cmtlgetqp000jvsrc5sh4zklm';

let sessionCookie = '';

async function login() {
  const res = await fetch(`${API_BASE}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: STUDENT_EMAIL, password: STUDENT_PASSWORD }),
  });

  if (!res.ok) {
    throw new Error('Login failed');
  }

  const cookies = res.headers.get('set-cookie');
  if (cookies) {
    const match = cookies.match(/learnflow_session=([^;]+)/);
    if (match) {
      sessionCookie = match[1];
    }
  }
}

async function testScenario(name, testFn) {
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`📋 TEST: ${name}`);
  console.log('─'.repeat(60));
  try {
    await testFn();
    console.log('✅ PASS');
  } catch (error) {
    console.log(`❌ FAIL: ${error.message}`);
  }
}

async function main() {
  console.log('\n🧪 FAILURE SCENARIO TESTS\n');
  console.log('='.repeat(60));

  await login();

  // Test 1: Enrollment already enrolled
  await testScenario('Student already enrolled - purchase fails', async () => {
    const res = await fetch(`${API_BASE}/api/v1/organizations/${ORG_ID}/student/courses/${COURSE_ID}/purchase`, {
      method: 'POST',
      headers: { Cookie: `learnflow_session=${sessionCookie}` },
    });
    
    if (res.status === 409) {
      const body = await res.json();
      if (body.error === 'ALREADY_ENROLLED') {
        console.log(`  Status: ${res.status}, Error: ${body.error}`);
        return;
      }
    }
    throw new Error(`Expected 409 ALREADY_ENROLLED, got ${res.status}`);
  });

  // Test 2: Invalid course ID
  await testScenario('Invalid course ID - enrollment fails', async () => {
    const res = await fetch(`${API_BASE}/api/v1/organizations/${ORG_ID}/student/courses/invalid-course/purchase`, {
      method: 'POST',
      headers: { Cookie: `learnflow_session=${sessionCookie}` },
    });
    
    if (!res.ok) {
      const body = await res.json();
      console.log(`  Status: ${res.status}, Error: ${body.error}`);
      return;
    }
    throw new Error(`Expected error, got ${res.status}`);
  });

  // Test 3: Invalid organization ID
  await testScenario('Invalid organization ID - request fails', async () => {
    const res = await fetch(`${API_BASE}/api/v1/organizations/invalid-org/student/courses/${COURSE_ID}/purchase`, {
      method: 'POST',
      headers: { Cookie: `learnflow_session=${sessionCookie}` },
    });
    
    if (!res.ok) {
      const body = await res.json();
      console.log(`  Status: ${res.status}, Error: ${body.error}`);
      return;
    }
    throw new Error(`Expected error, got ${res.status}`);
  });

  // Test 4: Missing authentication
  await testScenario('Missing authentication - request rejected', async () => {
    const res = await fetch(`${API_BASE}/api/v1/organizations/${ORG_ID}/student/courses/${COURSE_ID}/purchase`, {
      method: 'POST',
    });
    
    if (res.status === 401) {
      const body = await res.json();
      console.log(`  Status: ${res.status}, Error: ${body.error}`);
      return;
    }
    throw new Error(`Expected 401, got ${res.status}`);
  });

  // Test 5: My Courses with invalid org
  await testScenario('My Courses with invalid organization', async () => {
    const res = await fetch(`${API_BASE}/api/v1/organizations/invalid-org/student/courses`, {
      headers: { Cookie: `learnflow_session=${sessionCookie}` },
    });
    
    console.log(`  Status: ${res.status}`);
    const body = await res.json();
    console.log(`  Response: ${JSON.stringify(body).substring(0, 100)}...`);
    
    if (res.status !== 200) {
      return;
    }
    throw new Error(`Expected error status, got ${res.status}`);
  });

  // Test 6: My Courses without authentication
  await testScenario('My Courses without authentication', async () => {
    const res = await fetch(`${API_BASE}/api/v1/organizations/${ORG_ID}/student/courses`);
    
    if (res.status === 401) {
      const body = await res.json();
      console.log(`  Status: ${res.status}, Error: ${body.error}`);
      return;
    }
    throw new Error(`Expected 401, got ${res.status}`);
  });

  // Test 7: My Courses stats with invalid org
  await testScenario('My Courses stats with invalid organization', async () => {
    const res = await fetch(`${API_BASE}/api/v1/organizations/invalid-org/student/stats`, {
      headers: { Cookie: `learnflow_session=${sessionCookie}` },
    });
    
    console.log(`  Status: ${res.status}`);
    
    if (res.status !== 200) {
      return;
    }
    throw new Error(`Expected error status, got ${res.status}`);
  });

  // Test 8: Verify My Courses after enrollment
  await testScenario('Verify My Courses shows enrolled course', async () => {
    const res = await fetch(`${API_BASE}/api/v1/organizations/${ORG_ID}/student/courses`, {
      headers: { Cookie: `learnflow_session=${sessionCookie}` },
    });
    
    if (!res.ok) {
      throw new Error(`API failed: ${res.status}`);
    }
    
    const body = await res.json();
    const courses = body.data ?? [];
    
    const enrolledCourse = courses.find(c => c.courseId === COURSE_ID);
    if (enrolledCourse) {
      console.log(`  ✓ Found enrolled course: ${enrolledCourse.title}`);
      console.log(`    Status: ${enrolledCourse.enrollmentStatus}`);
      return;
    }
    throw new Error('Enrolled course not found in My Courses');
  });

  // Test 9: Verify stats show correct enrollment count
  await testScenario('Verify stats show 1 enrolled course', async () => {
    const res = await fetch(`${API_BASE}/api/v1/organizations/${ORG_ID}/student/stats`, {
      headers: { Cookie: `learnflow_session=${sessionCookie}` },
    });
    
    if (!res.ok) {
      throw new Error(`API failed: ${res.status}`);
    }
    
    const body = await res.json();
    const stats = body.data ?? {};
    
    console.log(`  Enrolled courses: ${stats.enrolledCourses}`);
    console.log(`  Available courses: ${stats.availableCourses}`);
    console.log(`  In progress: ${stats.inProgressCourses}`);
    
    if (stats.enrolledCourses >= 1) {
      return;
    }
    throw new Error(`Expected enrolledCourses >= 1, got ${stats.enrolledCourses}`);
  });

  // Test 10: Search shows enrolled status
  await testScenario('Search shows correct enrolled status', async () => {
    const res = await fetch(`${API_BASE}/api/v1/organizations/${ORG_ID}/student/search`, {
      headers: { Cookie: `learnflow_session=${sessionCookie}` },
    });
    
    if (!res.ok) {
      throw new Error(`API failed: ${res.status}`);
    }
    
    const body = await res.json();
    const courses = body.data ?? [];
    
    const searchedCourse = courses.find(c => c.id === COURSE_ID);
    if (searchedCourse) {
      console.log(`  Course: ${searchedCourse.title}`);
      console.log(`  Enrolled: ${searchedCourse.isEnrolled}`);
      
      if (searchedCourse.isEnrolled) {
        return;
      }
      throw new Error('Course should show isEnrolled: true');
    }
    throw new Error('Course not found in search');
  });

  console.log('\n' + '='.repeat(60));
  console.log('✅ FAILURE SCENARIO TESTS COMPLETE\n');
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
