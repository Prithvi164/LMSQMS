
import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { FormBuilder } from "@/components/evaluation/form-builder";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";

export default function EvaluationTemplatesPage() {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
  const { user } = useAuth();

  const { data: templates } = useQuery({
    queryKey: [`/api/organizations/${user?.organizationId}/evaluation-templates`],
    enabled: !!user?.organizationId,
  });

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Evaluation Templates</h1>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Create Template
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {templates?.map((template: any) => (
          <Card key={template.id} className="cursor-pointer hover:border-primary/50 transition-colors">
            <CardHeader>
              <CardTitle className="text-lg">{template.name}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{template.description}</p>
              <div className="mt-4">
                <Button variant="outline" onClick={() => setSelectedTemplateId(template.id)}>
                  Edit Template
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={showCreateDialog || !!selectedTemplateId} onOpenChange={(open) => {
        if (!open) {
          setShowCreateDialog(false);
          setSelectedTemplateId(null);
        }
      }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <FormBuilder templateId={selectedTemplateId || 0} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
