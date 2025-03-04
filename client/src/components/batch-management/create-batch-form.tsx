import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, addDays, isSunday, parse } from "date-fns";
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
      startDate: '',
      inductionStartDate: '',
      capacityLimit: 1,
      batchCode: '',
      name: '',
      inductionEndDate: '',
      trainingStartDate: '',
      trainingEndDate: '',
      certificationStartDate: '',
      certificationEndDate: '',
      ojtStartDate: '',
      ojtEndDate: '',
      ojtCertificationStartDate: '',
      ojtCertificationEndDate: '',
      handoverToOpsDate: ''
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
      if (!values.startDate) throw new Error('Batch start date is required');
      if (!values.inductionStartDate) throw new Error('Induction Start date is required');
      if (values.locationId === undefined) throw new Error('Location is required');
      if (values.lineOfBusinessId === undefined) throw new Error('Line of Business is required');
      if (values.processId === undefined) throw new Error('Process is required');
      if (values.trainerId === undefined) throw new Error('Trainer is required');
      if (values.capacityLimit === undefined) throw new Error('Capacity limit is required');

      // Convert any Date objects to strings before submitting
      const formattedValues: InsertOrganizationBatch = {
        ...values,
        startDate: typeof values.startDate === 'string'
          ? values.startDate
          : format(values.startDate as unknown as Date, 'yyyy-MM-dd'),
        inductionStartDate: typeof values.inductionStartDate === 'string'
          ? values.inductionStartDate
          : format(values.inductionStartDate as unknown as Date, 'yyyy-MM-dd'),
        inductionEndDate: typeof values.inductionEndDate === 'string' ? values.inductionEndDate : format(values.inductionEndDate as unknown as Date, 'yyyy-MM-dd'),
        trainingStartDate: typeof values.trainingStartDate === 'string' ? values.trainingStartDate : format(values.trainingStartDate as unknown as Date, 'yyyy-MM-dd'),
        trainingEndDate: typeof values.trainingEndDate === 'string' ? values.trainingEndDate : format(values.trainingEndDate as unknown as Date, 'yyyy-MM-dd'),
        certificationStartDate: typeof values.certificationStartDate === 'string' ? values.certificationStartDate : format(values.certificationStartDate as unknown as Date, 'yyyy-MM-dd'),
        certificationEndDate: typeof values.certificationEndDate === 'string' ? values.certificationEndDate : format(values.certificationEndDate as unknown as Date, 'yyyy-MM-dd'),
        ojtStartDate: typeof values.ojtStartDate === 'string' ? values.ojtStartDate : format(values.ojtStartDate as unknown as Date, 'yyyy-MM-dd'),
        ojtEndDate: typeof values.ojtEndDate === 'string' ? values.ojtEndDate : format(values.ojtEndDate as unknown as Date, 'yyyy-MM-dd'),
        ojtCertificationStartDate: typeof values.ojtCertificationStartDate === 'string' ? values.ojtCertificationStartDate : format(values.ojtCertificationStartDate as unknown as Date, 'yyyy-MM-dd'),
        ojtCertificationEndDate: typeof values.ojtCertificationEndDate === 'string' ? values.ojtCertificationEndDate : format(values.ojtCertificationEndDate as unknown as Date, 'yyyy-MM-dd'),
        handoverToOpsDate: typeof values.handoverToOpsDate === 'string' ? values.handoverToOpsDate : format(values.handoverToOpsDate as unknown as Date, 'yyyy-MM-dd')

      };

      console.log('Submitting with formatted values:', formattedValues);
      await createBatchMutation.mutateAsync(formattedValues);
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
      try {
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

        // Update form values with formatted dates
        const formatDate = (date: Date) => format(date, 'yyyy-MM-dd');

        form.setValue('inductionEndDate', formatDate(inductionEnd));
        form.setValue('trainingStartDate', formatDate(trainingStart));
        form.setValue('trainingEndDate', formatDate(trainingEnd));
        form.setValue('certificationStartDate', formatDate(certificationStart));
        form.setValue('certificationEndDate', formatDate(certificationEnd));
        form.setValue('ojtStartDate', formatDate(ojtStart));
        form.setValue('ojtEndDate', formatDate(ojtEnd));
        form.setValue('ojtCertificationStartDate', formatDate(ojtCertificationStart));
        form.setValue('ojtCertificationEndDate', formatDate(ojtCertificationEnd));
        form.setValue('handoverToOpsDate', formatDate(handoverToOps));

        // Update displayed dates
        setCalculatedDates({
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
  }, [form.watch('inductionStartDate'), form.watch('processId'), processes]);

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

          {/* Batch Start Date */}
          <FormField
            control={form.control}
            name="startDate"
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
                        // Convert Date to string in YYYY-MM-DD format
                        const dateStr = date ? format(date, 'yyyy-MM-dd') : '';
                        console.log('Selected batch start date:', dateStr);
                        field.onChange(dateStr);
                        // Set the same date for induction start
                        form.setValue('inductionStartDate', dateStr);
                      }}
                      disabled={(date) => {
                        // Disable Sundays and past dates
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

          {/* Start Date */}
          <FormField
            control={form.control}
            name="inductionStartDate"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>Induction Start Date</FormLabel>
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
                        // Convert Date to string in YYYY-MM-DD format
                        const dateStr = date ? format(date, 'yyyy-MM-dd') : '';
                        console.log('Selected date:', dateStr);
                        field.onChange(dateStr);
                      }}
                      disabled={(date) => {
                        // Disable Sundays and past dates
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

          {/* Display calculated dates as read-only fields */}
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