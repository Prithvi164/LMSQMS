import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, addDays, isSunday } from "date-fns";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { CalendarIcon } from "lucide-react";
import { insertOrganizationBatchSchema, type InsertOrganizationBatch } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";

// Utility function to calculate working days excluding Sundays
const addWorkingDays = (startDate: Date, days: number): Date => {
  let currentDate = startDate;
  let remainingDays = days;

  while (remainingDays > 0) {
    currentDate = addDays(currentDate, 1);
    if (!isSunday(currentDate)) {
      remainingDays--;
    }
  }

  return currentDate;
};

export function CreateBatchForm() {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedLocation, setSelectedLocation] = useState<number | null>(null);
  const [selectedLob, setSelectedLob] = useState<number | null>(null);
  const [calculatedDates, setCalculatedDates] = useState<{
    batchStart: string;
    batchEnd: string;
    inductionStart: string;
    inductionEnd: string;
    trainingStart: string;
    trainingEnd: string;
    certificationStart: string;
    certificationEnd: string;
    ojtStart: string;
    ojtEnd: string;
    ojtCertificationStart: string;
    ojtCertificationEnd: string;
    handoverToOps: string;
  }>({
    batchStart: '',
    batchEnd: '',
    inductionStart: '',
    inductionEnd: '',
    trainingStart: '',
    trainingEnd: '',
    certificationStart: '',
    certificationEnd: '',
    ojtStart: '',
    ojtEnd: '',
    ojtCertificationStart: '',
    ojtCertificationEnd: '',
    handoverToOps: ''
  });

  const form = useForm<InsertOrganizationBatch>({
    resolver: zodResolver(insertOrganizationBatchSchema),
    defaultValues: {
      status: 'planned',
      organizationId: user?.organizationId || undefined,
      capacityLimit: 1,
      batchCode: '',
      name: '',
    },
  });

  // Step 1: Fetch Locations
  const {
    data: locations = [],
    isLoading: isLoadingLocations
  } = useQuery({
    queryKey: [`/api/organizations/${user?.organizationId}/locations`],
    enabled: !!user?.organizationId
  });

  // Step 2: Fetch LOBs based on selected location
  const {
    data: lobs = [],
    isLoading: isLoadingLobs
  } = useQuery({
    queryKey: [`/api/organizations/${user?.organizationId}/locations/${selectedLocation}/line-of-businesses`],
    enabled: !!selectedLocation && !!user?.organizationId
  });

  // Step 3: Fetch processes based on selected LOB
  const {
    data: processes = [],
    isLoading: isLoadingProcesses
  } = useQuery({
    queryKey: [`/api/organizations/${user?.organizationId}/line-of-businesses/${selectedLob}/processes`],
    enabled: !!selectedLob && !!user?.organizationId
  });

  // Fetch trainers with location filter
  const {
    data: trainers = [],
    isLoading: isLoadingTrainers
  } = useQuery({
    queryKey: [`/api/organizations/${user?.organizationId}/users`],
    select: (users) => users?.filter((user) =>
      user.role === 'trainer' &&
      (!selectedLocation || user.locationId === selectedLocation)
    ) || [],
    enabled: !!user?.organizationId
  });

  const createBatchMutation = useMutation({
    mutationFn: async (values: InsertOrganizationBatch) => {
      if (!user?.organizationId) {
        throw new Error('Organization ID is required');
      }

      try {
        console.log('Submitting batch data:', values);
        const response = await fetch(`/api/organizations/${user.organizationId}/batches`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(values),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Failed to create batch');
        }

        return await response.json();
      } catch (error) {
        console.error('API Error:', error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/organizations/${user?.organizationId}/batches`] });
      toast({
        title: "Success",
        description: "Batch created successfully",
      });
      form.reset();
      setSelectedLocation(null);
      setSelectedLob(null);
    },
    onError: (error: Error) => {
      console.error('Error creating batch:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to create batch. Please try again.",
        variant: "destructive",
      });
    },
  });

  async function onSubmit(values: InsertOrganizationBatch) {
    try {
      if (!values.batchCode) throw new Error('Batch code is required');
      if (!values.name) throw new Error('Batch name is required');
      if (!values.batchStartDate) throw new Error('Batch Start date is required');
      if (values.locationId === undefined) throw new Error('Location is required');
      if (values.lineOfBusinessId === undefined) throw new Error('Line of Business is required');
      if (values.processId === undefined) throw new Error('Process is required');
      if (values.trainerId === undefined) throw new Error('Trainer is required');
      if (values.capacityLimit === undefined) throw new Error('Capacity limit is required');

      await createBatchMutation.mutateAsync(values);
    } catch (error) {
      console.error('Form submission error:', error);
      toast({
        title: "Validation Error",
        description: error instanceof Error ? error.message : "Please fill all required fields",
        variant: "destructive",
      });
    }
  }

  // Add effect to calculate dates when process and start date change
  useEffect(() => {
    const process = processes.find(p => p.id === form.getValues('processId'));
    const batchStartDate = form.getValues('batchStartDate');

    if (process && batchStartDate) {
      try {
        const startDate = new Date(batchStartDate);

        // Calculate all dates based on process days
        const inductionEnd = addWorkingDays(startDate, process.inductionDays);
        const trainingStart = addWorkingDays(inductionEnd, 1);
        const trainingEnd = addWorkingDays(trainingStart, process.trainingDays);
        const certificationStart = addWorkingDays(trainingEnd, 1);
        const certificationEnd = addWorkingDays(certificationStart, process.certificationDays);
        const ojtStart = addWorkingDays(certificationEnd, 1);
        const ojtEnd = addWorkingDays(ojtStart, process.ojtDays);
        const ojtCertificationStart = addWorkingDays(ojtEnd, 1);
        const ojtCertificationEnd = addWorkingDays(ojtCertificationStart, process.ojtCertificationDays);
        const handoverToOps = addWorkingDays(ojtCertificationEnd, 1);

        // Format dates
        const formatDate = (date: Date) => format(date, 'yyyy-MM-dd');

        // Set form values
        form.setValue('inductionStartDate', batchStartDate); // Set induction start same as batch start
        form.setValue('inductionEndDate', formatDate(inductionEnd));
        form.setValue('trainingStartDate', formatDate(trainingStart));
        form.setValue('trainingEndDate', formatDate(trainingEnd));
        form.setValue('certificationStartDate', formatDate(certificationStart));
        form.setValue('certificationEndDate', formatDate(certificationEnd));
        form.setValue('ojtStartDate', formatDate(ojtStart));
        form.setValue('ojtEndDate', formatDate(ojtEnd));
        form.setValue('ojtCertificationStartDate', formatDate(ojtCertificationStart));
        form.setValue('ojtCertificationEndDate', formatDate(ojtCertificationEnd));
        form.setValue('handoverToOpsDate', formatDate(handoverToOps)); // Set handover date same as batch end

        // Update displayed dates
        setCalculatedDates({
          batchStart: batchStartDate,
          batchEnd: formatDate(ojtEnd),
          inductionStart: batchStartDate,
          inductionEnd: formatDate(inductionEnd),
          trainingStart: formatDate(trainingStart),
          trainingEnd: formatDate(trainingEnd),
          certificationStart: formatDate(certificationStart),
          certificationEnd: formatDate(certificationEnd),
          ojtStart: formatDate(ojtStart),
          ojtEnd: formatDate(ojtEnd),
          ojtCertificationStart: formatDate(ojtCertificationStart),
          ojtCertificationEnd: formatDate(ojtCertificationEnd),
          handoverToOps: formatDate(handoverToOps)
        });
      } catch (error) {
        console.error('Error calculating dates:', error);
      }
    }
  }, [form.watch('batchStartDate'), form.watch('processId'), processes]);

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          {/* Batch Code */}
          <FormField
            control={form.control}
            name="batchCode"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Batch Code</FormLabel>
                <FormControl>
                  <Input placeholder="Enter batch code" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Batch Name */}
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Batch Name</FormLabel>
                <FormControl>
                  <Input placeholder="Enter batch name" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Batch Start Date */}
          <FormField
            control={form.control}
            name="batchStartDate"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>Batch Start Date</FormLabel>
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
                          format(new Date(field.value), "PPP")
                        ) : (
                          <span>Pick a date</span>
                        )}
                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={field.value ? new Date(field.value) : undefined}
                      onSelect={(date) => {
                        const dateStr = date ? format(date, 'yyyy-MM-dd') : '';
                        field.onChange(dateStr);
                      }}
                      disabled={(date) => {
                        return isSunday(date) || date < new Date();
                      }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Batch End Date */}
          <FormField
            control={form.control}
            name="batchEndDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Batch End Date</FormLabel>
                <FormControl>
                  <Input
                    type="text"
                    value={calculatedDates.batchEnd ? format(new Date(calculatedDates.batchEnd), "PPP") : ''}
                    disabled
                  />
                </FormControl>
              </FormItem>
            )}
          />

          {/* Induction Start Date */}
          <FormField
            control={form.control}
            name="inductionStartDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Induction Start Date</FormLabel>
                <FormControl>
                  <Input
                    type="text"
                    value={calculatedDates.inductionStart ? format(new Date(calculatedDates.inductionStart), "PPP") : ''}
                    disabled
                  />
                </FormControl>
              </FormItem>
            )}
          />

          {/* Induction End Date */}
          <FormField
            control={form.control}
            name="inductionEndDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Induction End Date</FormLabel>
                <FormControl>
                  <Input
                    type="text"
                    value={calculatedDates.inductionEnd ? format(new Date(calculatedDates.inductionEnd), "PPP") : ''}
                    disabled
                  />
                </FormControl>
              </FormItem>
            )}
          />

          {/* Training Start/End */}
          <FormField
            control={form.control}
            name="trainingStartDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Training Start Date</FormLabel>
                <FormControl>
                  <Input
                    type="text"
                    value={calculatedDates.trainingStart ? format(new Date(calculatedDates.trainingStart), "PPP") : ''}
                    disabled
                  />
                </FormControl>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="trainingEndDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Training End Date</FormLabel>
                <FormControl>
                  <Input
                    type="text"
                    value={calculatedDates.trainingEnd ? format(new Date(calculatedDates.trainingEnd), "PPP") : ''}
                    disabled
                  />
                </FormControl>
              </FormItem>
            )}
          />

          {/* Certification Start/End */}
          <FormField
            control={form.control}
            name="certificationStartDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Certification Start Date</FormLabel>
                <FormControl>
                  <Input
                    type="text"
                    value={calculatedDates.certificationStart ? format(new Date(calculatedDates.certificationStart), "PPP") : ''}
                    disabled
                  />
                </FormControl>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="certificationEndDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Certification End Date</FormLabel>
                <FormControl>
                  <Input
                    type="text"
                    value={calculatedDates.certificationEnd ? format(new Date(calculatedDates.certificationEnd), "PPP") : ''}
                    disabled
                  />
                </FormControl>
              </FormItem>
            )}
          />

          {/* OJT Start/End */}
          <FormField
            control={form.control}
            name="ojtStartDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>OJT Start Date</FormLabel>
                <FormControl>
                  <Input
                    type="text"
                    value={calculatedDates.ojtStart ? format(new Date(calculatedDates.ojtStart), "PPP") : ''}
                    disabled
                  />
                </FormControl>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="ojtEndDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>OJT End Date</FormLabel>
                <FormControl>
                  <Input
                    type="text"
                    value={calculatedDates.ojtEnd ? format(new Date(calculatedDates.ojtEnd), "PPP") : ''}
                    disabled
                  />
                </FormControl>
              </FormItem>
            )}
          />

          {/* OJT Certification Start/End */}
          <FormField
            control={form.control}
            name="ojtCertificationStartDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>OJT Certification Start Date</FormLabel>
                <FormControl>
                  <Input
                    type="text"
                    value={calculatedDates.ojtCertificationStart ? format(new Date(calculatedDates.ojtCertificationStart), "PPP") : ''}
                    disabled
                  />
                </FormControl>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="ojtCertificationEndDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>OJT Certification End Date</FormLabel>
                <FormControl>
                  <Input
                    type="text"
                    value={calculatedDates.ojtCertificationEnd ? format(new Date(calculatedDates.ojtCertificationEnd), "PPP") : ''}
                    disabled
                  />
                </FormControl>
              </FormItem>
            )}
          />

          {/* Handover to Ops */}
          <FormField
            control={form.control}
            name="handoverToOpsDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Handover to Ops Date</FormLabel>
                <FormControl>
                  <Input
                    type="text"
                    value={calculatedDates.handoverToOps ? format(new Date(calculatedDates.handoverToOps), "PPP") : ''}
                    disabled
                  />
                </FormControl>
              </FormItem>
            )}
          />

          {/* Capacity Limit */}
          <FormField
            control={form.control}
            name="capacityLimit"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Capacity Limit</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={1}
                    placeholder="Enter capacity"
                    value={field.value || ''}
                    onChange={(e) => {
                      const value = e.target.value ? parseInt(e.target.value) : undefined;
                      field.onChange(value);
                    }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="col-span-2 flex justify-end space-x-2">
          <Button
            type="submit"
            disabled={
              createBatchMutation.isPending ||
              isLoadingLocations ||
              isLoadingLobs ||
              isLoadingProcesses ||
              isLoadingTrainers
            }
          >
            {createBatchMutation.isPending ? "Creating..." : "Create Batch"}
          </Button>
        </div>
      </form>
    </Form>
  );
}