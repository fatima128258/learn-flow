import * as authService from './src/services/authService';

(async () => {
  const result = await authService.loginUser({
    email: 'admin@gmail.com',
    password: 'admin123',
    ip: '203.0.113.77',
  });
  const user = result.user as { email?: string; name?: string; emailVerified?: boolean };
  const role = (result as { role?: string }).role;
  console.log('LOGIN SUCCESS');
  console.log('  email:', user.email);
  console.log('  name:', user.name);
  console.log('  emailVerified:', user.emailVerified);
  console.log('  role:', role);
})().catch((e) => {
  console.error('LOGIN FAILED:', e.message);
  process.exit(1);
});
