```tsx
import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { PreviewForm } from "@/components/evaluation/preview-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function ConductEvaluation() {
  const { templateId } = useParams<{ templateId: string }>();

  const { data: template, isLoading } = useQuery({
    queryKey: ['/api/evaluation-templates', templateId],
    enabled: !!templateId,
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-[200px]" />
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-[150px]" />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!template) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Error</CardTitle>
        </CardHeader>
        <CardContent>
          <p>Template not found</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Conduct Evaluation</h1>
      <PreviewForm template={template} />
    </div>
  );
}
```
