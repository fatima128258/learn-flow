#!/usr/bin/env node
/**
 * LearnFlow Authentication Flow Test
 * Tests login and signup functionality for both local and remote environments
 * 
 * Usage:
 *   node test-auth-flow.mjs local
 *   node test-auth-flow.mjs remote
 */

const TEST_USER = {
  name: 'Test User',
  email: `test-${Date.now()}@example.com`,
  password: 'TestPass123!',
  confirmPassword: 'TestPass123!'
};

const ENVIRONMENTS = {
  local: {
    api: 'http://localhost:4000',
    web: 'http://localhost:3000'
  },
  remote: {
    api: 'https://learn-flow-1-1gl3.onrender.com',
    web: 'https://learn-flow-web-indol.vercel.app'
  }
};

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, type = 'info') {
  const prefix = {
    info: `${colors.blue}ℹ${colors.reset}`,
    success: `${colors.green}✓${colors.reset}`,
    error: `${colors.red}✗${colors.reset}`,
    warning: `${colors.yellow}⚠${colors.reset}`,
    test: `${colors.cyan}➜${colors.reset}`
  };
  console.log(`${prefix[type]} ${message}`);
}

function printHeader(title) {
  console.log(`\n${colors.bright}${colors.cyan}${'='.repeat(60)}${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}  ${title}${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}${'='.repeat(60)}${colors.reset}\n`);
}

async function testHealthEndpoint(apiBase) {
  log('Testing health endpoint...', 'test');
  try {
    const response = await fetch(`${apiBase}/health`);
    const data = await response.json();
    
    if (response.ok && data.status === 'healthy') {
      log(`Health check passed: ${data.service} v${data.version}`, 'success');
      return true;
    } else {
      log(`Health check failed: ${JSON.stringify(data)}`, 'error');
      return false;
    }
  } catch (error) {
    log(`Health endpoint error: ${error.message}`, 'error');
    return false;
  }
}

async function testDetailedHealth(apiBase) {
  log('Testing detailed health endpoint...', 'test');
  try {
    const response = await fetch(`${apiBase}/api/health`);
    const data = await response.json();
    
    log(`Service status: ${data.status}`, data.status === 'ready' ? 'success' : 'warning');
    
    if (data.dependencies) {
      const deps = data.dependencies;
      log(`Database: ${deps.database?.status || 'unknown'}`, deps.database?.status === 'healthy' ? 'success' : 'error');
      log(`Redis: ${deps.redis?.status || 'unknown'}`, deps.redis?.status === 'healthy' ? 'success' : 'error');
      log(`Object Storage: ${deps.objectStorage?.status || 'unknown'}`, deps.objectStorage?.status === 'healthy' ? 'success' : 'warning');
    }
    
    return response.ok;
  } catch (error) {
    log(`Detailed health check error: ${error.message}`, 'error');
    return false;
  }
}

async function testRegister(apiBase, webOrigin) {
  log('Testing user registration...', 'test');
  try {
    const response = await fetch(`${apiBase}/api/v1/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': webOrigin
      },
      credentials: 'include',
      body: JSON.stringify(TEST_USER)
    });

    const data = await response.json();
    
    if (response.ok && data.user) {
      log(`Registration successful!`, 'success');
      log(`  User ID: ${data.user.id}`, 'info');
      log(`  Email: ${data.user.email}`, 'info');
      log(`  Email Verified: ${data.user.emailVerified}`, 'info');
      
      // Check for Set-Cookie header
      const cookies = response.headers.get('set-cookie');
      if (cookies) {
        log(`  Session cookie set: ✓`, 'success');
      } else {
        log(`  Session cookie: Not detected in response headers`, 'warning');
      }
      
      return { success: true, user: data.user };
    } else {
      log(`Registration failed: ${data.error || 'Unknown error'}`, 'error');
      log(`Response: ${JSON.stringify(data, null, 2)}`, 'error');
      return { success: false, error: data.error };
    }
  } catch (error) {
    log(`Registration request error: ${error.message}`, 'error');
    return { success: false, error: error.message };
  }
}

async function testLogin(apiBase, webOrigin, email, password) {
  log('Testing user login...', 'test');
  try {
    const response = await fetch(`${apiBase}/api/v1/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': webOrigin
      },
      credentials: 'include',
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();
    
    if (response.ok && data.user) {
      log(`Login successful!`, 'success');
      log(`  User ID: ${data.user.id}`, 'info');
      log(`  Email: ${data.user.email}`, 'info');
      log(`  Role: ${data.user.role || 'Not assigned'}`, 'info');
      log(`  Organization: ${data.user.organizationId || 'Not assigned'}`, 'info');
      
      // Check for Set-Cookie header
      const cookies = response.headers.get('set-cookie');
      if (cookies) {
        log(`  Session cookie set: ✓`, 'success');
      } else {
        log(`  Session cookie: Not detected in response headers`, 'warning');
      }
      
      return { success: true, user: data.user };
    } else {
      log(`Login failed: ${data.error || 'Unknown error'}`, 'error');
      log(`Response: ${JSON.stringify(data, null, 2)}`, 'error');
      return { success: false, error: data.error };
    }
  } catch (error) {
    log(`Login request error: ${error.message}`, 'error');
    return { success: false, error: error.message };
  }
}

async function testInvalidLogin(apiBase, webOrigin) {
  log('Testing invalid login credentials...', 'test');
  try {
    const response = await fetch(`${apiBase}/api/v1/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': webOrigin
      },
      credentials: 'include',
      body: JSON.stringify({
        email: 'nonexistent@example.com',
        password: 'WrongPassword123!'
      })
    });

    const data = await response.json();
    
    if (response.status === 401 && data.error === 'INVALID_CREDENTIALS') {
      log(`Invalid login properly rejected: ${data.error}`, 'success');
      return { success: true };
    } else {
      log(`Unexpected response for invalid login: ${JSON.stringify(data)}`, 'warning');
      return { success: false };
    }
  } catch (error) {
    log(`Invalid login test error: ${error.message}`, 'error');
    return { success: false, error: error.message };
  }
}

async function testDuplicateRegistration(apiBase, webOrigin, email) {
  log('Testing duplicate email registration...', 'test');
  try {
    const response = await fetch(`${apiBase}/api/v1/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': webOrigin
      },
      credentials: 'include',
      body: JSON.stringify({
        ...TEST_USER,
        email: email
      })
    });

    const data = await response.json();
    
    if (response.status === 409 && data.error === 'EMAIL_TAKEN') {
      log(`Duplicate email properly rejected: ${data.error}`, 'success');
      return { success: true };
    } else {
      log(`Unexpected response for duplicate email: ${JSON.stringify(data)}`, 'warning');
      return { success: false };
    }
  } catch (error) {
    log(`Duplicate registration test error: ${error.message}`, 'error');
    return { success: false, error: error.message };
  }
}

async function testPasswordValidation(apiBase, webOrigin) {
  log('Testing password validation...', 'test');
  try {
    const response = await fetch(`${apiBase}/api/v1/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': webOrigin
      },
      credentials: 'include',
      body: JSON.stringify({
        name: 'Test User',
        email: `test-${Date.now()}@example.com`,
        password: 'short',
        confirmPassword: 'short'
      })
    });

    const data = await response.json();
    
    if (response.status === 400 && data.error === 'PASSWORD_TOO_SHORT') {
      log(`Short password properly rejected: ${data.error}`, 'success');
      return { success: true };
    } else {
      log(`Unexpected response for short password: ${JSON.stringify(data)}`, 'warning');
      return { success: false };
    }
  } catch (error) {
    log(`Password validation test error: ${error.message}`, 'error');
    return { success: false, error: error.message };
  }
}

async function testCORS(apiBase, webOrigin) {
  log('Testing CORS configuration...', 'test');
  try {
    const response = await fetch(`${apiBase}/health`, {
      method: 'GET',
      headers: {
        'Origin': webOrigin
      }
    });

    const allowOrigin = response.headers.get('access-control-allow-origin');
    const allowCredentials = response.headers.get('access-control-allow-credentials');
    
    log(`  Access-Control-Allow-Origin: ${allowOrigin || 'Not set'}`, allowOrigin ? 'success' : 'warning');
    log(`  Access-Control-Allow-Credentials: ${allowCredentials || 'Not set'}`, allowCredentials === 'true' ? 'success' : 'warning');
    
    return response.ok;
  } catch (error) {
    log(`CORS test error: ${error.message}`, 'error');
    return false;
  }
}

async function runTests(environment) {
  const env = ENVIRONMENTS[environment];
  
  if (!env) {
    log(`Unknown environment: ${environment}. Use 'local' or 'remote'`, 'error');
    process.exit(1);
  }

  printHeader(`Testing ${environment.toUpperCase()} Environment`);
  log(`API Base: ${env.api}`, 'info');
  log(`Web Origin: ${env.web}`, 'info');

  const results = {
    passed: 0,
    failed: 0,
    total: 0
  };

  // Test 1: Health Check
  printHeader('Test 1: Health Checks');
  results.total++;
  if (await testHealthEndpoint(env.api)) {
    results.passed++;
  } else {
    results.failed++;
    log('Skipping remaining tests due to health check failure', 'error');
    return results;
  }

  await testDetailedHealth(env.api);

  // Test 2: CORS Configuration
  printHeader('Test 2: CORS Configuration');
  results.total++;
  if (await testCORS(env.api, env.web)) {
    results.passed++;
  } else {
    results.failed++;
  }

  // Test 3: Password Validation
  printHeader('Test 3: Password Validation');
  results.total++;
  const passwordValidationResult = await testPasswordValidation(env.api, env.web);
  if (passwordValidationResult.success) {
    results.passed++;
  } else {
    results.failed++;
  }

  // Test 4: User Registration
  printHeader('Test 4: User Registration');
  results.total++;
  const registerResult = await testRegister(env.api, env.web);
  if (registerResult.success) {
    results.passed++;
  } else {
    results.failed++;
    log('Skipping remaining tests due to registration failure', 'error');
    return results;
  }

  // Test 5: Duplicate Registration
  printHeader('Test 5: Duplicate Email Prevention');
  results.total++;
  const duplicateResult = await testDuplicateRegistration(env.api, env.web, TEST_USER.email);
  if (duplicateResult.success) {
    results.passed++;
  } else {
    results.failed++;
  }

  // Test 6: User Login
  printHeader('Test 6: User Login');
  results.total++;
  const loginResult = await testLogin(env.api, env.web, TEST_USER.email, TEST_USER.password);
  if (loginResult.success) {
    results.passed++;
  } else {
    results.failed++;
  }

  // Test 7: Invalid Login
  printHeader('Test 7: Invalid Login Prevention');
  results.total++;
  const invalidLoginResult = await testInvalidLogin(env.api, env.web);
  if (invalidLoginResult.success) {
    results.passed++;
  } else {
    results.failed++;
  }

  return results;
}

// Main execution
const environment = process.argv[2] || 'local';

runTests(environment).then((results) => {
  printHeader('Test Results Summary');
  log(`Total Tests: ${results.total}`, 'info');
  log(`Passed: ${results.passed}`, 'success');
  log(`Failed: ${results.failed}`, results.failed === 0 ? 'success' : 'error');
  log(`Success Rate: ${((results.passed / results.total) * 100).toFixed(1)}%`, 'info');
  
  if (results.failed === 0) {
    console.log(`\n${colors.green}${colors.bright}🎉 All tests passed!${colors.reset}\n`);
    process.exit(0);
  } else {
    console.log(`\n${colors.red}${colors.bright}❌ Some tests failed${colors.reset}\n`);
    process.exit(1);
  }
}).catch((error) => {
  log(`Fatal error: ${error.message}`, 'error');
  console.error(error);
  process.exit(1);
});
