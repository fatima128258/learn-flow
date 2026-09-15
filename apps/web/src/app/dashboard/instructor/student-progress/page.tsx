import { StudentProgressView } from '@/components/dashboard/StudentProgressView';

export default function InstructorStudentProgressPage() {
  return <StudentProgressView apiPath="/api/v1/instructor/student-progress" />;
}
