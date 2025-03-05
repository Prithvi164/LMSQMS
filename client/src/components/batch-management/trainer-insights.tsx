import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { InfoIcon } from "lucide-react";

type TrainerBatchInsight = {
  id: number;
  name: string;
  startDate: string;
  endDate: string;
  status: string;
};

interface TrainerInsightsProps {
  trainerId: number | null;
}

export function TrainerInsights({ trainerId }: TrainerInsightsProps) {
  const { data: trainerBatches, isLoading } = useQuery({
    queryKey: ['trainer-batches', trainerId],
    queryFn: async () => {
      if (!trainerId) return [];
      const response = await fetch(`/api/trainers/${trainerId}/active-batches`);
      if (!response.ok) throw new Error('Failed to fetch trainer batches');
      return response.json();
    },
    enabled: !!trainerId
  });

  if (!trainerId) return null;

  // Sort batches by start date
  const sortedBatches = [...(trainerBatches || [])].sort(
    (a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
  );

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="flex items-center gap-2">
          <InfoIcon className="h-4 w-4" />
          View Trainer Schedule
          {sortedBatches?.length > 0 && (
            <Badge variant="secondary" className="ml-2">
              {sortedBatches.length}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80">
        <div className="space-y-2">
          <h3 className="font-medium">Current Batches</h3>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading trainer schedule...</p>
          ) : sortedBatches.length === 0 ? (
            <p className="text-sm text-muted-foreground">No active batches found for this trainer.</p>
          ) : (
            <div className="space-y-2">
              {sortedBatches.map((batch) => (
                <div key={batch.id} className="rounded-md border p-2">
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <p className="text-sm font-medium">{batch.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(batch.startDate).toLocaleDateString()} - {new Date(batch.endDate).toLocaleDateString()}
                      </p>
                    </div>
                    <Badge variant={batch.status === 'planned' ? 'secondary' : 'default'} className="capitalize">
                      {batch.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}