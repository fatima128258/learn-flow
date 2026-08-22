'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import { MainLayout } from '../../components/layout/MainLayout';
import { Container } from '../../components/ui/layout/Container';
import { Card, CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';

// Mock course data
const courses = [
  {
    id: 1,
    title: 'Complete Web Development Bootcamp',
    instructor: 'Sarah Johnson',
    category: 'Development',
    level: 'Beginner',
    rating: 4.8,
    students: 12450,
    lessons: 156,
    duration: '42h 30m',
    price: '$89.99',
    thumbnail: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=400&h=250&fit=crop',
    description: 'Master web development from scratch with HTML, CSS, JavaScript, React, Node.js, and more.',
  },
  {
    id: 2,
    title: 'Python for Data Science & Machine Learning',
    instructor: 'Dr. Michael Chen',
    category: 'Data Science',
    level: 'Intermediate',
    rating: 4.9,
    students: 8920,
    lessons: 124,
    duration: '38h 15m',
    price: '$99.99',
    thumbnail: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=400&h=250&fit=crop',
    description: 'Learn Python, NumPy, Pandas, Matplotlib, Scikit-Learn, and TensorFlow for data analysis and ML.',
  },
  {
    id: 3,
    title: 'UI/UX Design Masterclass',
    instructor: 'Emma Williams',
    category: 'Design',
    level: 'All Levels',
    rating: 4.7,
    students: 6230,
    lessons: 89,
    duration: '28h 45m',
    price: '$79.99',
    thumbnail: 'https://images.unsplash.com/photo-1561070791-2526d30994b5?w=400&h=250&fit=crop',
    description: 'Master UI/UX design principles, Figma, prototyping, and design systems from industry experts.',
  },
  {
    id: 4,
    title: 'Digital Marketing Complete Course',
    instructor: 'David Martinez',
    category: 'Marketing',
    level: 'Beginner',
    rating: 4.6,
    students: 5670,
    lessons: 98,
    duration: '32h 20m',
    price: '$69.99',
    thumbnail: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=400&h=250&fit=crop',
    description: 'Learn SEO, SEM, social media marketing, email marketing, and analytics to grow your business.',
  },
  {
    id: 5,
    title: 'Mobile App Development with React Native',
    instructor: 'Alex Turner',
    category: 'Development',
    level: 'Intermediate',
    rating: 4.8,
    students: 4890,
    lessons: 112,
    duration: '35h 50m',
    price: '$94.99',
    thumbnail: 'https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?w=400&h=250&fit=crop',
    description: 'Build cross-platform mobile apps for iOS and Android using React Native and Expo.',
  },
  {
    id: 6,
    title: 'Cloud Architecture & AWS Solutions',
    instructor: 'Jennifer Lee',
    category: 'Cloud',
    level: 'Advanced',
    rating: 4.9,
    students: 3450,
    lessons: 134,
    duration: '44h 10m',
    price: '$119.99',
    thumbnail: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=400&h=250&fit=crop',
    description: 'Master AWS services, cloud architecture, serverless computing, and DevOps practices.',
  },
];

const categories = ['All', 'Development', 'Data Science', 'Design', 'Marketing', 'Cloud', 'Business'];

export default function CoursesPage() {
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [enrollingCourseId, setEnrollingCourseId] = useState<number | null>(null);

  const filteredCourses = courses.filter(course => {
    const matchesCategory = selectedCategory === 'All' || course.category === selectedCategory;
    const matchesSearch = course.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         course.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const handleEnroll = async (courseId: number) => {
    setEnrollingCourseId(courseId);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500));
      // Handle enrollment success
      alert('Successfully enrolled! This would redirect to the course.');
    } catch (error) {
      alert('Enrollment failed. Please try again.');
    } finally {
      setEnrollingCourseId(null);
    }
  };

  return (
    <MainLayout>
      <div className="min-h-screen bg-gradient-to-b from-neutral-50 to-white">
        {/* Hero Section */}
        <section className="relative py-16 sm:py-20 bg-gradient-to-br from-primary-600 to-primary-800 overflow-hidden">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDM0YzAtMi4yMSAxLjc5LTQgNC00czQgMS43OSA0IDR2MmMwIDIuMjEtMS43OSA0LTQgNHMtNC0xLjc5LTQtNHYtMnptMC0zMGMwLTIuMjEgMS43OS00IDQtNHM0IDEuNzkgNCA0djJjMCAyLjIxLTEuNzkgNC00IDRzLTQtMS43OS00LTRWNHpNNiAzNGMwLTIuMjEgMS43OS00IDQtNHM0IDEuNzkgNCA0djJjMCAyLjIxLTEuNzkgNC00IDRzLTQtMS43OS00LTR2LTJ6bTAtMzBjMC0yLjIxIDEuNzktNCA0LTRzNCAxLjc5IDQgNHYyYzAgMi4yMS0xLjc5IDQtNCA0cy00LTEuNzktNC00VjR6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-20" />
          
          <Container className="relative">
            <div className="text-center max-w-3xl mx-auto">
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-6 tracking-tight animate-slide-up">
                Explore Our Courses
              </h1>
              <p className="text-xl text-primary-100 mb-8 animate-slide-up" style={{ animationDelay: '0.1s' }}>
                Discover over 1,200 courses taught by expert instructors
              </p>
              
              {/* Search Bar */}
              <div className="max-w-2xl mx-auto animate-slide-up" style={{ animationDelay: '0.2s' }}>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search for courses..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full px-6 py-4 pr-12 rounded-xl border-2 border-primary-300 focus:border-white focus:outline-none focus:ring-4 focus:ring-white/20 text-lg transition-all"
                  />
                  <svg 
                    className="absolute right-4 top-1/2 -translate-y-1/2 h-6 w-6 text-neutral-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
              </div>
            </div>
          </Container>
        </section>

        {/* Categories & Courses */}
        <section className="py-12">
          <Container>
            {/* Category Filter */}
            <div className="flex flex-wrap gap-3 mb-10 animate-fade-in">
              {categories.map((category) => (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  className={`px-4 py-2 rounded-lg font-medium transition-all ${
                    selectedCategory === category
                      ? 'bg-primary-600 text-white shadow-md'
                      : 'bg-white text-neutral-700 hover:bg-neutral-50 border border-neutral-200'
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>

            {/* Results Count */}
            <div className="mb-6">
              <p className="text-neutral-600">
                Showing <span className="font-semibold text-neutral-900">{filteredCourses.length}</span> courses
              </p>
            </div>

            {/* Course Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {filteredCourses.map((course, index) => (
                <Card 
                  key={course.id} 
                  hover 
                  padding="none" 
                  className="group overflow-hidden animate-slide-up border-2 hover:border-primary-200 transition-all"
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  {/* Thumbnail */}
                  <div className="relative h-48 bg-neutral-200 overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-primary-600 to-primary-800 opacity-90 group-hover:opacity-80 transition-opacity" />
                    <div className="absolute top-3 left-3">
                      <Badge variant="primary" className="bg-white text-primary-700 font-semibold">
                        {course.category}
                      </Badge>
                    </div>
                  </div>

                  <div className="p-6">
                    <CardHeader className="mb-0 p-0">
                      {/* Instructor */}
                      <div className="flex items-center gap-2 mb-3">
                        <div className="h-8 w-8 rounded-full bg-primary-100 flex items-center justify-center">
                          <span className="text-xs font-semibold text-primary-700">
                            {course.instructor.split(' ').map(n => n[0]).join('')}
                          </span>
                        </div>
                        <span className="text-sm text-neutral-600">{course.instructor}</span>
                      </div>

                      <CardTitle className="mb-3 group-hover:text-primary-600 transition-colors line-clamp-2">
                        {course.title}
                      </CardTitle>
                      
                      <CardDescription className="line-clamp-2 mb-4">
                        {course.description}
                      </CardDescription>

                      {/* Stats */}
                      <div className="flex items-center gap-4 text-sm text-neutral-600 mb-4 pb-4 border-b border-neutral-200">
                        <div className="flex items-center gap-1">
                          <svg className="h-4 w-4 text-warning-500 fill-current" viewBox="0 0 20 20">
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                          </svg>
                          <span className="font-medium">{course.rating}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                          </svg>
                          <span>{course.students.toLocaleString()}</span>
                        </div>
                      </div>

                      {/* Footer */}
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-2xl font-bold text-neutral-900">{course.price}</div>
                          <div className="text-xs text-neutral-500">{course.lessons} lessons • {course.duration}</div>
                        </div>
                        <Button 
                          variant="primary" 
                          size="sm" 
                          className="shadow-sm"
                          loading={enrollingCourseId === course.id}
                          onClick={() => handleEnroll(course.id)}
                        >
                          {enrollingCourseId === course.id ? 'Enrolling...' : 'Enroll Now'}
                        </Button>
                      </div>
                    </CardHeader>
                  </div>
                </Card>
              ))}
            </div>

            {/* Empty State */}
            {filteredCourses.length === 0 && (
              <div className="text-center py-16">
                <svg className="mx-auto h-16 w-16 text-neutral-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h3 className="text-xl font-semibold text-neutral-900 mb-2">No courses found</h3>
                <p className="text-neutral-600 mb-6">Try adjusting your search or filter to find what you're looking for.</p>
                <Button variant="primary" onClick={() => { setSearchQuery(''); setSelectedCategory('All'); }}>
                  Clear filters
                </Button>
              </div>
            )}
          </Container>
        </section>
      </div>
    </MainLayout>
  );
}
