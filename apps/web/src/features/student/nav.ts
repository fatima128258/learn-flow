import { NavIcons, type NavItem } from '@/components/layout/DashboardLayout';

export const studentNav: NavItem[] = [
  { href: '/dashboard/student', label: 'Dashboard', icon: NavIcons.dashboard },
  { href: '/dashboard/student/search', label: 'Search Courses', icon: NavIcons.search },
  { href: '/dashboard/student/notifications', label: 'Notifications', icon: NavIcons.notifications },
  { href: '/dashboard/student/certificates', label: 'Certificates', icon: NavIcons.certificates },
];