import { useEffect, useState } from "react";
import { Link } from "wouter";
import { 
  BookOpen, 
  CheckCircle, 
  Clock, 
  GraduationCap,
  ArrowRight
} from "lucide-react";
import { StatsCard } from "@/components/ui/stats-card";
import { CourseCard } from "@/components/course-card";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import type { Course, UserProgress } from "@shared/schema";

export default function Dashboard() {
  const {
    data: courses = [],
    isLoading: coursesLoading
  } = useQuery<Course[]>({ 
    queryKey: ["/api/courses"]
  });

  const {
    data: progress = [],
    isLoading: progressLoading
  } = useQuery<UserProgress[]>({
    queryKey: ["/api/progress"]
  });

  const loading = coursesLoading || progressLoading;

  const completedCourses = progress.filter(p => p.completed).length;
  const inProgressCourses = new Set(progress.map(p => p.courseId)).size - completedCourses;
  const totalHours = courses.reduce((acc, course) => acc + course.duration / 60, 0);

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Welcome back!</h1>
        <p className="text-muted-foreground">
          Track your progress and continue your learning journey
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatsCard
          title="Completed Courses"
          value={completedCourses}
          icon={<CheckCircle className="h-4 w-4 text-green-500" />}
        />
        <StatsCard
          title="In Progress"
          value={inProgressCourses}
          icon={<Clock className="h-4 w-4 text-blue-500" />}
        />
        <StatsCard
          title="Total Courses"
          value={courses.length}
          icon={<BookOpen className="h-4 w-4 text-purple-500" />}
        />
        <StatsCard
          title="Training Hours"
          value={totalHours.toFixed(1)}
          icon={<GraduationCap className="h-4 w-4 text-orange-500" />}
        />
      </div>

      <h2 className="text-xl font-semibold mb-4">Continue Learning</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <p>Loading...</p>
        ) : (
          courses.slice(0, 3).map(course => {
            const courseProgress = progress.find(p => p.courseId === course.id);
            const progressPercent = courseProgress 
              ? courseProgress.completed ? 100 : 50 
              : 0;

            return (
              <CourseCard 
                key={course.id} 
                course={course}
                progress={progressPercent}
              />
            );
          })
        )}
      </div>
    </div>
  );
}