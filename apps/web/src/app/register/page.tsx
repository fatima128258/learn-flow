import { redirect } from 'next/navigation';
import { AuthLayout } from '../../components/layout/AuthLayout';
import { AuthSwitch } from '../../components/auth/AuthSwitch';
import { getPostLoginRedirect } from '../../features/auth/postLoginRedirect';
import { getServerCurrentUser } from '../../features/auth/serverAuth';

export default async function RegisterPage() {
  const user = await getServerCurrentUser();
  const redirectUrl = getPostLoginRedirect(user);
  if (redirectUrl !== '/') redirect(redirectUrl);

  return (
    <AuthLayout hideChrome>
      <AuthSwitch initialMode="register" />
    </AuthLayout>
  );
}
