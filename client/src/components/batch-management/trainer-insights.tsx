import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

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
  if (isLoading) return <div>Loading trainer insights...</div>;

  // Sort batches by start date
  const sortedBatches = [...(trainerBatches || [])].sort(
    (a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
  );

  return (
    <Card className="p-4 mt-4">
      <h3 className="text-lg font-semibold mb-3">Trainer's Current Batches</h3>
      {sortedBatches.length === 0 ? (
        <p className="text-muted-foreground">No active batches found for this trainer.</p>
      ) : (
        <div className="space-y-3">
          {sortedBatches.map((batch) => (
            <div key={batch.id} className="border rounded-lg p-3">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-medium">{batch.name}</h4>
                  <p className="text-sm text-muted-foreground">
                    {new Date(batch.startDate).toLocaleDateString()} - {new Date(batch.endDate).toLocaleDateString()}
                  </p>
                </div>
                <Badge variant={batch.status === 'planned' ? 'secondary' : 'default'}>
                  {batch.status}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
