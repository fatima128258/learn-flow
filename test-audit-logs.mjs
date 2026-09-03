#!/usr/bin/env node

const API_URL = 'http://localhost:4000/api/v1';

async function test() {
  try {
    console.log('=== AUDIT LOGS TEST ===\n');
    
    // Test 1: Login
    console.log('1️⃣ Testing login...');
    const loginRes = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@gmail.com',
        password: 'admin123'
      }),
      credentials: 'include'
    });
    
    if (!loginRes.ok) {
      throw new Error(`Login failed: ${loginRes.status} ${await loginRes.text()}`);
    }
    
    const loginData = await loginRes.json();
    console.log(`✓ Logged in as: ${loginData.user.email}`);
    console.log(`✓ Role: ${loginData.user.role}\n`);
    
    // Extract cookies
    const cookies = loginRes.headers.get('set-cookie');
    console.log(`✓ Session cookie received: ${cookies ? 'Yes' : 'No'}\n`);
    
    // Test 2: Get /auth/me to verify session
    console.log('2️⃣ Verifying session...');
    const meRes = await fetch(`${API_URL}/auth/me`, {
      credentials: 'include',
      headers: { 'Cookie': cookies || '' }
    });
    
    const meData = await meRes.json();
    console.log(`✓ Current user: ${meData.user.email}`);
    console.log(`✓ Role confirmed: ${meData.user.role}\n`);
    
    // Test 3: Access audit logs
    console.log('3️⃣ Testing audit logs endpoint...');
    const auditRes = await fetch(`${API_URL}/admin/audit-logs?page=1&limit=50`, {
      credentials: 'include',
      headers: { 'Cookie': cookies || '' }
    });
    
    console.log(`   Status: ${auditRes.status}`);
    
    if (auditRes.status === 401) {
      console.log('✗ Unauthorized (401)');
      const errorData = await auditRes.json();
      console.log(`   Error: ${errorData.error}`);
    } else if (auditRes.status === 403) {
      console.log('✗ Forbidden (403)');
      const errorData = await auditRes.json();
      console.log(`   Error: ${errorData.error}`);
    } else if (auditRes.status === 404) {
      console.log('✗ Not Found (404) - ENDPOINT ISSUE');
      const errorData = await auditRes.json();
      console.log(`   Error: ${errorData.error}`);
    } else if (auditRes.ok) {
      const auditData = await auditRes.json();
      console.log(`✓ Audit logs accessible!`);
      console.log(`✓ Items: ${auditData.data.length}`);
      console.log(`✓ Meta: ${JSON.stringify(auditData.meta)}`);
    }
    
    console.log('\n=== TEST COMPLETE ===');
    
  } catch (error) {
    console.error('Test failed:', error.message);
    process.exit(1);
  }
}

test();
