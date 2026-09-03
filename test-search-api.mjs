import fetch from 'node-fetch';

const API_BASE = 'http://localhost:4000';
const STUDENT_EMAIL = 'student-1788434705311@learnflow.test';
const STUDENT_PASSWORD = 'E2Epass123!';
const ORG_ID = 'cmtlfufv20000vs102old4c94';

let sessionCookie = '';

async function login() {
  console.log('Logging in...');
  const res = await fetch(`${API_BASE}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: STUDENT_EMAIL, password: STUDENT_PASSWORD }),
  });

  if (!res.ok) {
    console.error('Login failed:', res.status);
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

async function testSearch() {
  console.log('Testing search endpoint...\n');
  
  const res = await fetch(`${API_BASE}/api/v1/organizations/${ORG_ID}/student/search`, {
    headers: { Cookie: `learnflow_session=${sessionCookie}` },
  });

  console.log(`Status: ${res.status}`);
  console.log(`Content-Type: ${res.headers.get('content-type')}`);
  
  const body = await res.json();
  
  console.log('\nResponse body:');
  console.log(JSON.stringify(body, null, 2));
}

async function main() {
  await login();
  await testSearch();
}

main().catch(console.error);
