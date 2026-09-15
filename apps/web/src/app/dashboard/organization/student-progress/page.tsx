import { StudentProgressView } from '@/components/dashboard/StudentProgressView';

export default function OrganizationStudentProgressPage() {
  return <StudentProgressView apiPath="/api/v1/org/student-progress" />;
}
