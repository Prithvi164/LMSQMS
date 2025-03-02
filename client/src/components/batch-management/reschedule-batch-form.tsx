import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { insertBatchScheduleHistorySchema } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";

interface RescheduleBatchFormProps {
  batch: {
    id: number;
    startDate: string;
    endDate: string;
  };
  onSuccess: () => void;
}

export function RescheduleBatchForm({ batch, onSuccess }: RescheduleBatchFormProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const form = useForm({
    resolver: zodResolver(insertBatchScheduleHistorySchema),
    defaultValues: {
      batchId: batch.id,
      originalStartDate: batch.startDate,
      originalEndDate: batch.endDate,
      modifiedBy: user?.id,
    },
  });

  const rescheduleBatchMutation = useMutation({
    mutationFn: async (data) => {
      return apiRequest(`/api/organizations/${user?.organizationId}/batches/${batch.id}/reschedule`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/organizations/${user?.organizationId}/batches`] });
      toast({
        title: "Success",
        description: "Batch rescheduled successfully",
      });
      onSuccess();
    },
    onError: (error) => {
      console.error('Error rescheduling batch:', error);
      toast({
        title: "Error",
        description: "Failed to reschedule batch. Please try again.",
        variant: "destructive",
      });
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(rescheduleBatchMutation.mutate)} className="space-y-6">
        <FormField
          control={form.control}
          name="newStartDate"
          render={({ field }) => (
            <FormItem>
              <FormLabel>New Start Date</FormLabel>
              <FormControl>
                <Input type="date" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="newEndDate"
          render={({ field }) => (
            <FormItem>
              <FormLabel>New End Date</FormLabel>
              <FormControl>
                <Input type="date" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="reason"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Reason for Rescheduling</FormLabel>
              <FormControl>
                <Textarea 
                  placeholder="Please provide a reason for rescheduling the batch"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end space-x-2">
          <Button
            type="submit"
            disabled={rescheduleBatchMutation.isPending}
          >
            {rescheduleBatchMutation.isPending ? "Rescheduling..." : "Reschedule Batch"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
