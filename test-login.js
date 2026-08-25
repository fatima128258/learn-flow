const fetch = require('node-fetch');

async function testPlatformAdminLogin() {
  try {
    console.log('Testing Platform Admin login...');
    
    const response = await fetch('http://localhost:4000/api/v1/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'fatimaramzan739@gmail.com',
        password: 'fatima123'
      })
    });
    
    const data = await response.json();
    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(data, null, 2));
    
    if (data.user && data.user.role) {
      console.log('✅ User role found:', data.user.role);
      if (data.user.role === 'PLATFORM_ADMIN') {
        console.log('✅ Platform Admin role correct!');
        console.log('✅ Should redirect to /dashboard');
      } else {
        console.log('❌ Expected PLATFORM_ADMIN, got:', data.user.role);
      }
    } else {
      console.log('❌ No role found in user object');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testPlatformAdminLogin();