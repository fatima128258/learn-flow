import { NavIcons, type NavItem } from '@/components/layout/DashboardLayout';

export const orgAdminNav: NavItem[] = [
  { href: '/dashboard/organization', label: 'Dashboard', icon: NavIcons.dashboard },
  { href: '/dashboard/organization/courses', label: 'Courses', icon: NavIcons.courses },
  { href: '/dashboard/organization/users', label: 'Users', icon: NavIcons.users },
  { href: '/dashboard/organization/analytics', label: 'Analytics', icon: NavIcons.metrics },
  { href: '/dashboard/organization/settings', label: 'Settings', icon: NavIcons.settings },
  { href: '/dashboard/organization/audit-logs', label: 'Audit Logs', icon: NavIcons.audit },
];