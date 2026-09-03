import { NavIcons, type NavItem } from '@/components/layout/DashboardLayout';

export const platformAdminNav: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: NavIcons.dashboard },
  { href: '/dashboard/organizations', label: 'Organizations', icon: NavIcons.organizations },
  { href: '/dashboard/audit-logs', label: 'Audit Logs', icon: NavIcons.audit },
  { href: '/dashboard/settings', label: 'Settings', icon: NavIcons.settings },
];
