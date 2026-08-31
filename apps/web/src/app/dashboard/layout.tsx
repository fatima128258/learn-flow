import { DashboardShell } from '@/components/layout/DashboardShell';

export default function DashboardNavLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <DashboardShell>{children}</DashboardShell>;
}
