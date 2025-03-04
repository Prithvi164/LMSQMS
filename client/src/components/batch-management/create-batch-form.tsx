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
      inductionStartDate: '',
      capacityLimit: 1,
      batchCode: '',
      name: '',
      inductionEndDate:'',
      trainingStartDate:'',
      trainingEndDate:'',
      certificationStartDate:'',
      certificationEndDate:'',
      ojtStartDate:'',
      ojtEndDate:'',
      ojtCertificationStartDate:'',
      ojtCertificationEndDate:'',
      handoverToOpsDate:''
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
    ) || [], // Handle potential null or undefined users
    enabled: !!user?.organizationId
  });

  const createBatchMutation = useMutation({
    mutationFn: async (values: InsertOrganizationBatch) => {
      if (!user?.organizationId) {
        throw new Error('Organization ID is required');
      }

      try {
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
      //Added stricter validation
      if (!values.batchCode) throw new Error('Batch code is required');
      if (!values.name) throw new Error('Batch name is required');
      if (values.locationId === undefined) throw new Error('Location is required');
      if (values.lineOfBusinessId === undefined) throw new Error('Line of Business is required');
      if (values.processId === undefined) throw new Error('Process is required');
      if (values.trainerId === undefined) throw new Error('Trainer is required');
      if (!values.inductionStartDate) throw new Error('Start date is required');
      if (!values.capacityLimit) throw new Error('Capacity limit is required');


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
    const startDateStr = form.getValues('inductionStartDate');

    if (process && startDateStr) {
      const startDate = new Date(startDateStr);

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

      // Update form values
      form.setValue('inductionEndDate', format(inductionEnd, 'yyyy-MM-dd'));
      form.setValue('trainingStartDate', format(trainingStart, 'yyyy-MM-dd'));
      form.setValue('trainingEndDate', format(trainingEnd, 'yyyy-MM-dd'));
      form.setValue('certificationStartDate', format(certificationStart, 'yyyy-MM-dd'));
      form.setValue('certificationEndDate', format(certificationEnd, 'yyyy-MM-dd'));
      form.setValue('ojtStartDate', format(ojtStart, 'yyyy-MM-dd'));
      form.setValue('ojtEndDate', format(ojtEnd, 'yyyy-MM-dd'));
      form.setValue('ojtCertificationStartDate', format(ojtCertificationStart, 'yyyy-MM-dd'));
      form.setValue('ojtCertificationEndDate', format(ojtCertificationEnd, 'yyyy-MM-dd'));
      form.setValue('handoverToOpsDate', format(handoverToOps, 'yyyy-MM-dd'));

      // Update displayed dates
      setCalculatedDates({
        inductionEnd: format(inductionEnd, 'yyyy-MM-dd'),
        trainingStart: format(trainingStart, 'yyyy-MM-dd'),
        trainingEnd: format(trainingEnd, 'yyyy-MM-dd'),
        certificationStart: format(certificationStart, 'yyyy-MM-dd'),
        certificationEnd: format(certificationEnd, 'yyyy-MM-dd'),
        ojtStart: format(ojtStart, 'yyyy-MM-dd'),
        ojtEnd: format(ojtEnd, 'yyyy-MM-dd'),
        ojtCertificationStart: format(ojtCertificationStart, 'yyyy-MM-dd'),
        ojtCertificationEnd: format(ojtCertificationEnd, 'yyyy-MM-dd'),
        handoverToOps: format(handoverToOps, 'yyyy-MM-dd')
      });
    }
  }, [form.watch('inductionStartDate'), form.watch('processId'), processes]);

  // Add date fields to the form
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

          {/* Location */}
          <FormField
            control={form.control}
            name="locationId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Location</FormLabel>
                <Select
                  onValueChange={(value) => {
                    const locationId = parseInt(value);
                    field.onChange(locationId);
                    setSelectedLocation(locationId);
                    setSelectedLob(null);
                    form.setValue('lineOfBusinessId', undefined);
                    form.setValue('processId', undefined);
                    form.setValue('trainerId', undefined);
                  }}
                  value={field.value?.toString()}
                  disabled={isLoadingLocations}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select location" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {locations.map((location) => (
                      <SelectItem key={location.id} value={location.id.toString()}>
                        {location.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Line of Business */}
          <FormField
            control={form.control}
            name="lineOfBusinessId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Line of Business</FormLabel>
                <Select
                  onValueChange={(value) => {
                    const lobId = parseInt(value);
                    field.onChange(lobId);
                    setSelectedLob(lobId);
                    form.setValue('processId', undefined);
                  }}
                  value={field.value?.toString()}
                  disabled={!selectedLocation || isLoadingLobs}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder={selectedLocation ? "Select LOB" : "Select location first"} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {lobs.map((lob) => (
                      <SelectItem key={lob.id} value={lob.id.toString()}>
                        {lob.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Process */}
          <FormField
            control={form.control}
            name="processId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Process</FormLabel>
                <Select
                  onValueChange={(value) => {
                    const processId = parseInt(value);
                    field.onChange(processId);
                  }}
                  value={field.value?.toString()}
                  disabled={!selectedLob || isLoadingProcesses}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder={selectedLob ? "Select process" : "Select LOB first"} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {processes.map((process) => (
                      <SelectItem key={process.id} value={process.id.toString()}>
                        {process.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Trainer */}
          <FormField
            control={form.control}
            name="trainerId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Trainer</FormLabel>
                <Select
                  onValueChange={(value) => {
                    const trainerId = parseInt(value);
                    field.onChange(trainerId);
                  }}
                  value={field.value?.toString()}
                  disabled={!selectedLocation || isLoadingTrainers}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder={selectedLocation ? "Select trainer" : "Select location first"} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {trainers.map((trainer) => (
                      <SelectItem key={trainer.id} value={trainer.id.toString()}>
                        {trainer.fullName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Start Date */}
          <FormField
            control={form.control}
            name="inductionStartDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Induction Start Date</FormLabel>
                <FormControl>
                  <Input
                    type="date"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Display calculated dates as read-only fields */}
          <FormField
            control={form.control}
            name="inductionEndDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Induction End Date</FormLabel>
                <FormControl>
                  <Input
                    type="date"
                    value={calculatedDates.inductionEnd}
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
                    type="date"
                    value={calculatedDates.trainingStart}
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
                    type="date"
                    value={calculatedDates.trainingEnd}
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
                    type="date"
                    value={calculatedDates.certificationStart}
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
                    type="date"
                    value={calculatedDates.certificationEnd}
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
                    type="date"
                    value={calculatedDates.ojtStart}
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
                    type="date"
                    value={calculatedDates.ojtEnd}
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
                    type="date"
                    value={calculatedDates.ojtCertificationStart}
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
                    type="date"
                    value={calculatedDates.ojtCertificationEnd}
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
                    type="date"
                    value={calculatedDates.handoverToOps}
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