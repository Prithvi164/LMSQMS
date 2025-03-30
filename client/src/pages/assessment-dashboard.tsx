import { useState } from "react";
import { DraggableDashboard } from "@/components/dashboard/draggable-dashboard";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { WidgetConfig } from "@/components/dashboard/dashboard-configuration";

export default function AssessmentDashboard() {
  const { user } = useAuth();
  const [selectedBatchIds, setSelectedBatchIds] = useState<number[]>([]);
  
  // Fetch batches
  const { data: batches = [] } = useQuery<any[]>({
    queryKey: [`/api/organizations/${user?.organizationId}/batches`],
    enabled: !!user?.organizationId,
  });
  
  // Only show training phase batches
  const trainingBatches = batches.filter(batch => batch.status === 'training');
  
  // Default widgets for the dashboard
  const defaultWidgets: WidgetConfig[] = [
    {
      id: "widget-1",
      type: "assessment-performance",
      title: "Assessment Performance",
      size: "medium",
      chartType: "bar",
      position: { x: 0, y: 0 }
    },
    {
      id: "widget-2",
      type: "certification-progress",
      title: "Certification Progress",
      size: "medium",
      chartType: "pie",
      position: { x: 1, y: 0 }
    },
    {
      id: "widget-3",
      type: "attendance-overview",
      title: "Training Attendance",
      size: "medium",
      chartType: "pie",
      position: { x: 0, y: 1 }
    },
    {
      id: "widget-4",
      type: "phase-completion",
      title: "Training Phase Progress",
      size: "large",
      chartType: "bar",
      position: { x: 0, y: 2 }
    }
  ];
  
  // Get batch IDs from training batches if no selection is made
  const batchIds = selectedBatchIds.length > 0 
    ? selectedBatchIds 
    : trainingBatches.slice(0, 5).map(batch => batch.id);
  
  return (
    <div className="container py-6 space-y-6">
      <h1 className="text-2xl font-bold">Assessments & Certifications Dashboard</h1>
      
      <DraggableDashboard 
        widgetTypes={[
          "assessment-performance",
          "certification-progress",
          "attendance-overview", 
          "attendance-trends",
          "performance-distribution",
          "phase-completion"
        ]}
        defaultWidgets={defaultWidgets}
        batchIds={batchIds}
        dashboardName="Assessment & Certification Dashboard"
      />
    </div>
  );
}