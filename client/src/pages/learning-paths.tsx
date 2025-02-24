import { useQuery } from "@tanstack/react-query";
import type { LearningPath, Course } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, ChevronRight } from "lucide-react";

export default function LearningPaths() {
  const {
    data: learningPaths = [],
    isLoading: pathsLoading
  } = useQuery<LearningPath[]>({
    queryKey: ["/api/learning-paths"]
  });

  const {
    data: courses = [],
    isLoading: coursesLoading
  } = useQuery<Course[]>({
    queryKey: ["/api/courses"]
  });

  const loading = pathsLoading || coursesLoading;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Learning Paths</h1>
        <p className="text-muted-foreground">
          Structured learning paths to help you achieve your goals
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {learningPaths.map(path => (
          <Card key={path.id} className="overflow-hidden">
            <CardHeader className="bg-muted/50">
              <CardTitle className="flex items-center justify-between">
                <span>{path.title}</span>
                <Button variant="outline">
                  Start Path
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <p className="text-muted-foreground mb-4">
                {path.description}
              </p>

              <div className="space-y-2">
                <div className="flex flex-wrap gap-2 mb-4">
                  {path.requiredForRoles.map(role => (
                    <Badge key={role} variant="secondary">
                      {role}
                    </Badge>
                  ))}
                </div>

                <h3 className="font-semibold mb-2">Included Courses:</h3>
                <div className="space-y-2">
                  {courses.map(course => (
                    <div 
                      key={course.id}
                      className="flex items-center justify-between p-3 rounded-lg border"
                    >
                      <div>
                        <h4 className="font-medium">{course.title}</h4>
                        <p className="text-sm text-muted-foreground">
                          {course.description}
                        </p>
                      </div>
                      <Badge variant="outline">
                        {course.duration}m
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}