import { NavIcons, type NavItem } from '@/components/layout/DashboardLayout';

export const studentNav: NavItem[] = [
  { href: '/dashboard/student/search', label: 'Available Courses', icon: NavIcons.courses },
  { href: '/dashboard/student', label: 'My Courses', icon: NavIcons.courses },
  { href: '/dashboard/student/notifications', label: 'Notifications', icon: NavIcons.notifications },
  { href: '/dashboard/student/certificates', label: 'Certificates', icon: NavIcons.certificates },
  { href: '/dashboard/settings', label: 'Settings', icon: NavIcons.settings },
];
