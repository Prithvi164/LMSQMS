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

// Interface for date range
interface DateRange {
  start: Date;
  end: Date;
  label: string;
  status: 'induction' | 'training' | 'certification' | 'ojt' | 'ojt-certification';
}

export function CreateBatchForm() {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedLocation, setSelectedLocation] = useState<number | null>(null);
  const [selectedLob, setSelectedLob] = useState<number | null>(null);
  const [dateRanges, setDateRanges] = useState<DateRange[]>([]);
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
      endDate: '',
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

  const {
    data: locations = [],
    isLoading: isLoadingLocations
  } = useQuery({
    queryKey: [`/api/organizations/${user?.organizationId}/locations`],
    enabled: !!user?.organizationId
  });

  const {
    data: lobs = [],
    isLoading: isLoadingLobs
  } = useQuery({
    queryKey: [`/api/organizations/${user?.organizationId}/locations/${selectedLocation}/line-of-businesses`],
    enabled: !!selectedLocation && !!user?.organizationId
  });

  const {
    data: processes = [],
    isLoading: isLoadingProcesses
  } = useQuery({
    queryKey: [`/api/organizations/${user?.organizationId}/line-of-businesses/${selectedLob}/processes`],
    enabled: !!selectedLob && !!user?.organizationId
  });

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
      setDateRanges([]);
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

  const getDateRangeClassName = (date: Date): string => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const range = dateRanges.find(r => 
      dateStr >= format(r.start, 'yyyy-MM-dd') && 
      dateStr <= format(r.end, 'yyyy-MM-dd')
    );

    if (!range) return '';

    return cn(
      'bg-opacity-50',
      {
        'bg-blue-200': range.status === 'induction',
        'bg-green-200': range.status === 'training',
        'bg-yellow-200': range.status === 'certification',
        'bg-purple-200': range.status === 'ojt',
        'bg-pink-200': range.status === 'ojt-certification',
      }
    );
  };

  useEffect(() => {
    const process = processes.find(p => p.id === form.getValues('processId'));
    const startDateStr = form.getValues('startDate');

    if (process && startDateStr) {
      try {
        const startDate = new Date(startDateStr);
        form.setValue('inductionStartDate', format(startDate, 'yyyy-MM-dd'));

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

        // Update date ranges for visualization
        setDateRanges([
          {
            start: startDate,
            end: inductionEnd,
            label: 'Induction',
            status: 'induction'
          },
          {
            start: trainingStart,
            end: trainingEnd,
            label: 'Training',
            status: 'training'
          },
          {
            start: certificationStart,
            end: certificationEnd,
            label: 'Certification',
            status: 'certification'
          },
          {
            start: ojtStart,
            end: ojtEnd,
            label: 'OJT',
            status: 'ojt'
          },
          {
            start: ojtCertificationStart,
            end: ojtCertificationEnd,
            label: 'OJT Certification',
            status: 'ojt-certification'
          }
        ]);

        form.setValue('endDate', format(handoverToOps, 'yyyy-MM-dd'));
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
      } catch (error) {
        console.error('Error calculating dates:', error);
      }
    }
  }, [form.watch('startDate'), form.watch('processId'), processes]);

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
                      onSelect={(date) => field.onChange(date ? format(date, 'yyyy-MM-dd') : '')}
                      disabled={(date) => isSunday(date) || date < new Date()}
                      modifiers={{
                        highlighted: dateRanges.flatMap(range => {
                          const dates = [];
                          let current = range.start;
                          while (current <= range.end) {
                            dates.push(current);
                            current = addDays(current, 1);
                          }
                          return dates;
                        })
                      }}
                      modifiersClassNames={{
                        highlighted: (date) => getDateRangeClassName(date)
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
            name="endDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Batch End Date</FormLabel>
                <FormControl>
                  <Input
                    type="text"
                    value={field.value ? format(new Date(field.value), "PPP") : ''}
                    disabled
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Date Range Preview */}
          <div className="col-span-2 space-y-2 p-4 border rounded-lg">
            <h3 className="font-semibold">Date Range Preview</h3>
            <div className="grid grid-cols-2 gap-2">
              {dateRanges.map((range, index) => (
                <div
                  key={index}
                  className={cn(
                    "p-2 rounded",
                    {
                      'bg-blue-200': range.status === 'induction',
                      'bg-green-200': range.status === 'training',
                      'bg-yellow-200': range.status === 'certification',
                      'bg-purple-200': range.status === 'ojt',
                      'bg-pink-200': range.status === 'ojt-certification',
                    }
                  )}
                >
                  <div className="font-medium">{range.label}</div>
                  <div className="text-sm">
                    {format(range.start, "MMM d, yyyy")} - {format(range.end, "MMM d, yyyy")}
                  </div>
                </div>
              ))}
            </div>
          </div>

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