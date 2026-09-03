import { NavIcons, type NavItem } from '@/components/layout/DashboardLayout';

export const instructorNav: NavItem[] = [
  { href: '/dashboard/instructor', label: 'Dashboard', icon: NavIcons.dashboard },
  { href: '/dashboard/instructor/courses', label: 'My Courses', icon: NavIcons.courses },
  { href: '/dashboard/settings', label: 'Settings', icon: NavIcons.settings },
];
