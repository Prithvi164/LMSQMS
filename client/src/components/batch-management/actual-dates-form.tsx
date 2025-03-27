import React from 'react';
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { format } from "date-fns";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

// Define the form schema for actual batch dates
const actualDatesSchema = z.object({
  actualStartDate: z.date().nullable(),
  actualEndDate: z.date().nullable(),
  actualInductionStartDate: z.date().nullable(),
  actualInductionEndDate: z.date().nullable(),
  actualTrainingStartDate: z.date().nullable(),
  actualTrainingEndDate: z.date().nullable(),
  actualCertificationStartDate: z.date().nullable(),
  actualCertificationEndDate: z.date().nullable(),
  actualOjtStartDate: z.date().nullable(),
  actualOjtEndDate: z.date().nullable(),
  actualOjtCertificationStartDate: z.date().nullable(),
  actualOjtCertificationEndDate: z.date().nullable(),
  actualHandoverToOpsDate: z.date().nullable(),
});

type ActualDatesFormValues = z.infer<typeof actualDatesSchema>;

interface ActualDatesFormProps {
  batch: {
    id: number;
    organizationId: number;
    status: string;
    actualStartDate?: string | null;
    actualEndDate?: string | null;
    actualInductionStartDate?: string | null;
    actualInductionEndDate?: string | null;
    actualTrainingStartDate?: string | null;
    actualTrainingEndDate?: string | null;
    actualCertificationStartDate?: string | null;
    actualCertificationEndDate?: string | null;
    actualOjtStartDate?: string | null;
    actualOjtEndDate?: string | null;
    actualOjtCertificationStartDate?: string | null;
    actualOjtCertificationEndDate?: string | null;
    actualHandoverToOpsDate?: string | null;
  };
  onUpdate?: () => void;
}

export function ActualDatesForm({ batch, onUpdate }: ActualDatesFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Convert string dates to Date objects for the form
  const getDefaultValues = (): ActualDatesFormValues => {
    const defaultValues: ActualDatesFormValues = {
      actualStartDate: batch.actualStartDate ? new Date(batch.actualStartDate) : null,
      actualEndDate: batch.actualEndDate ? new Date(batch.actualEndDate) : null,
      actualInductionStartDate: batch.actualInductionStartDate ? new Date(batch.actualInductionStartDate) : null,
      actualInductionEndDate: batch.actualInductionEndDate ? new Date(batch.actualInductionEndDate) : null,
      actualTrainingStartDate: batch.actualTrainingStartDate ? new Date(batch.actualTrainingStartDate) : null,
      actualTrainingEndDate: batch.actualTrainingEndDate ? new Date(batch.actualTrainingEndDate) : null,
      actualCertificationStartDate: batch.actualCertificationStartDate ? new Date(batch.actualCertificationStartDate) : null,
      actualCertificationEndDate: batch.actualCertificationEndDate ? new Date(batch.actualCertificationEndDate) : null,
      actualOjtStartDate: batch.actualOjtStartDate ? new Date(batch.actualOjtStartDate) : null,
      actualOjtEndDate: batch.actualOjtEndDate ? new Date(batch.actualOjtEndDate) : null,
      actualOjtCertificationStartDate: batch.actualOjtCertificationStartDate ? new Date(batch.actualOjtCertificationStartDate) : null,
      actualOjtCertificationEndDate: batch.actualOjtCertificationEndDate ? new Date(batch.actualOjtCertificationEndDate) : null,
      actualHandoverToOpsDate: batch.actualHandoverToOpsDate ? new Date(batch.actualHandoverToOpsDate) : null,
    };
    return defaultValues;
  };

  const form = useForm<ActualDatesFormValues>({
    resolver: zodResolver(actualDatesSchema),
    defaultValues: getDefaultValues(),
  });

  const updateMutation = useMutation({
    mutationFn: async (values: ActualDatesFormValues) => {
      // Convert Date objects to ISO strings for the API
      const dateValues: Record<string, string | null> = {};
      
      Object.entries(values).forEach(([key, value]) => {
        if (value instanceof Date) {
          dateValues[key] = format(value, 'yyyy-MM-dd');
        } else {
          dateValues[key] = null;
        }
      });
      
      return apiRequest(`/api/organizations/${batch.organizationId}/batches/${batch.id}/actual-dates`, {
        method: 'PATCH',
        body: JSON.stringify(dateValues),
      });
    },
    onSuccess: () => {
      toast({
        title: "Actual dates updated",
        description: "The batch's actual dates have been updated successfully.",
      });
      
      // Invalidate queries for batches to refresh data
      queryClient.invalidateQueries({ queryKey: ['/api/organizations'] });
      
      if (onUpdate) {
        onUpdate();
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update actual dates",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (values: ActualDatesFormValues) => {
    updateMutation.mutate(values);
  };

  // Helper to check if a date field should be displayed based on batch status
  const shouldShowDateField = (phaseKey: string): boolean => {
    const statusOrder = ['planned', 'induction', 'training', 'certification', 'ojt', 'ojt_certification', 'completed'];
    const phaseMap: Record<string, number> = {
      'actualStartDate': 0, // Always show actual start date
      'actualEndDate': 6, // Show for completed batches
      'actualInductionStartDate': 1,
      'actualInductionEndDate': 1,
      'actualTrainingStartDate': 2,
      'actualTrainingEndDate': 2,
      'actualCertificationStartDate': 3,
      'actualCertificationEndDate': 3,
      'actualOjtStartDate': 4,
      'actualOjtEndDate': 4,
      'actualOjtCertificationStartDate': 5,
      'actualOjtCertificationEndDate': 5,
      'actualHandoverToOpsDate': 6,
    };

    const batchStatusIndex = statusOrder.indexOf(batch.status);
    const phaseIndex = phaseMap[phaseKey];
    
    // Show fields for current and previous phases, or if they already have values
    return phaseIndex <= batchStatusIndex || Boolean(batch[phaseKey as keyof typeof batch]);
  };

  // Readable labels for form fields
  const fieldLabels: Record<string, string> = {
    'actualStartDate': 'Actual Start Date',
    'actualEndDate': 'Actual End Date',
    'actualInductionStartDate': 'Actual Induction Start',
    'actualInductionEndDate': 'Actual Induction End',
    'actualTrainingStartDate': 'Actual Training Start',
    'actualTrainingEndDate': 'Actual Training End',
    'actualCertificationStartDate': 'Actual Certification Start',
    'actualCertificationEndDate': 'Actual Certification End',
    'actualOjtStartDate': 'Actual OJT Start',
    'actualOjtEndDate': 'Actual OJT End',
    'actualOjtCertificationStartDate': 'Actual OJT Certification Start',
    'actualOjtCertificationEndDate': 'Actual OJT Certification End',
    'actualHandoverToOpsDate': 'Actual Handover to Ops',
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Update Actual Dates</CardTitle>
        <CardDescription>
          Manage the actual dates for each phase of the batch. These reflect when phase transitions actually happened.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.keys(actualDatesSchema.shape).map((key) => {
                if (!shouldShowDateField(key)) return null;
                
                return (
                  <FormField
                    key={key}
                    control={form.control}
                    name={key as keyof ActualDatesFormValues}
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>{fieldLabels[key]}</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant={"outline"}
                                className={cn(
                                  "w-full pl-3 text-left font-normal",
                                  !field.value && "text-muted-foreground"
                                )}
                              >
                                {field.value ? (
                                  format(field.value, "PPP")
                                ) : (
                                  <span>Not set</span>
                                )}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={field.value as Date}
                              onSelect={field.onChange}
                              disabled={(date) => date > new Date()}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                );
              })}
            </div>
            <Button 
              type="submit" 
              className="w-full" 
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? "Updating..." : "Update Actual Dates"}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}