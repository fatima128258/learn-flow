import { DashboardShell } from '@/components/layout/DashboardShell';
import { redirect } from 'next/navigation';
import { getServerCurrentUser } from '@/features/auth/serverAuth';

export default async function DashboardNavLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const currentUser = await getServerCurrentUser();
  if (!currentUser) redirect('/login');

  return <DashboardShell initialUser={currentUser}>{children}</DashboardShell>;
}
