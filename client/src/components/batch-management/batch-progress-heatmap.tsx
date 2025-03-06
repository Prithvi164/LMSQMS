import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { format, isValid, parseISO } from "date-fns";
import type { OrganizationBatch } from "@shared/schema";

interface BatchProgressHeatmapProps {
  batch: OrganizationBatch;
}

type PhaseInfo = {
  name: string;
  startDate: string;
  endDate: string;
  status: 'not-started' | 'in-progress' | 'completed';
};

export function BatchProgressHeatmap({ batch }: BatchProgressHeatmapProps) {
  // Calculate phases and their statuses
  const phases = useMemo(() => {
    const today = new Date();
    const phases: PhaseInfo[] = [
      {
        name: 'Induction',
        startDate: batch.inductionStartDate,
        endDate: batch.inductionEndDate,
        status: 'not-started'
      },
      {
        name: 'Training',
        startDate: batch.trainingStartDate,
        endDate: batch.trainingEndDate,
        status: 'not-started'
      },
      {
        name: 'Certification',
        startDate: batch.certificationStartDate,
        endDate: batch.certificationEndDate,
        status: 'not-started'
      },
      {
        name: 'OJT',
        startDate: batch.ojtStartDate,
        endDate: batch.ojtEndDate,
        status: 'not-started'
      },
      {
        name: 'OJT Certification',
        startDate: batch.ojtCertificationStartDate,
        endDate: batch.ojtCertificationEndDate,
        status: 'not-started'
      }
    ];

    // Update status based on dates
    return phases.map(phase => {
      const start = parseISO(phase.startDate);
      const end = parseISO(phase.endDate);

      if (!isValid(start) || !isValid(end)) {
        return { ...phase, status: 'not-started' };
      }

      if (today < start) {
        return { ...phase, status: 'not-started' };
      } else if (today > end) {
        return { ...phase, status: 'completed' };
      } else {
        return { ...phase, status: 'in-progress' };
      }
    });
  }, [batch]);

  // Helper function to get cell color based on status
  const getCellColor = (status: PhaseInfo['status']) => {
    switch (status) {
      case 'completed':
        return 'bg-green-500/80';
      case 'in-progress':
        return 'bg-yellow-500/80';
      default:
        return 'bg-gray-200';
    }
  };

  // Helper function to format date
  const formatDate = (dateStr: string) => {
    const date = parseISO(dateStr);
    return isValid(date) ? format(date, 'MMM dd, yyyy') : 'N/A';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Batch Progress Heatmap</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <TooltipProvider>
            {phases.map((phase, index) => (
              <div
                key={phase.name}
                className="flex items-center gap-2 p-2 rounded-lg hover:bg-accent/5"
              >
                <div className="w-32 font-medium">{phase.name}</div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div
                      className={cn(
                        "flex-1 h-8 rounded-md cursor-pointer transition-colors",
                        getCellColor(phase.status)
                      )}
                    />
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className="text-sm">
                      <div className="font-medium">{phase.name}</div>
                      <div>Start: {formatDate(phase.startDate)}</div>
                      <div>End: {formatDate(phase.endDate)}</div>
                      <div className="capitalize">
                        Status: {phase.status.replace('-', ' ')}
                      </div>
                    </div>
                  </TooltipContent>
                </Tooltip>
              </div>
            ))}
          </TooltipProvider>
        </div>
      </CardContent>
    </Card>
  );
}