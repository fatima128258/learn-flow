import { NavIcons, type NavItem } from '@/components/layout/DashboardLayout';

export const orgAdminNav: NavItem[] = [
  { href: '/dashboard/organization', label: 'Dashboard', icon: NavIcons.dashboard },
  { href: '/dashboard/organization/courses', label: 'Courses', icon: NavIcons.courses },
  { href: '/dashboard/organization/categories', label: 'Categories', icon: NavIcons.categories },
  { href: '/dashboard/organization/users', label: 'Users', icon: NavIcons.users },
  { href: '/dashboard/organization/payments', label: 'Payments', icon: NavIcons.payments },
  { href: '/dashboard/organization/analytics', label: 'Enrollment', icon: NavIcons.enrollment },
  { href: '/dashboard/organization/student-progress', label: 'Student Progress', icon: NavIcons.progress },
  { href: '/dashboard/organization/chat', label: 'Chat', icon: NavIcons.chat },
  { href: '/dashboard/organization/audit-logs', label: 'Audit Logs', icon: NavIcons.audit },
  { href: '/dashboard/settings', label: 'Settings', icon: NavIcons.settings },
];
