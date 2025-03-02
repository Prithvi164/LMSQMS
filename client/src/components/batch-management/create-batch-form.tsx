import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { addDays, format, isSunday } from "date-fns";
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
import { insertOrganizationBatchSchema } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";

// Helper function to add working days (skip Sundays)
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

// Helper function to calculate batch dates
const calculateBatchDates = (startDate: string, process: any) => {
  if (!startDate || !process) return null;

  const inductionStartDate = new Date(startDate);

  // Skip if start date is Sunday
  const adjustedStartDate = isSunday(inductionStartDate)
    ? addDays(inductionStartDate, 1)
    : inductionStartDate;

  // Calculate end dates using working days
  const inductionEndDate = addWorkingDays(adjustedStartDate, process.inductionDays - 1);
  const trainingStartDate = addWorkingDays(inductionEndDate, 1);
  const trainingEndDate = addWorkingDays(trainingStartDate, process.trainingDays - 1);
  const certificationStartDate = addWorkingDays(trainingEndDate, 1);
  const certificationEndDate = addWorkingDays(certificationStartDate, process.certificationDays - 1);

  // Calculate OJT dates
  const ojtStartDate = addWorkingDays(certificationEndDate, 1);
  const ojtEndDate = addWorkingDays(ojtStartDate, process.ojtDays - 1);
  const ojtCertificationStartDate = addWorkingDays(ojtEndDate, 1);
  const ojtCertificationEndDate = addWorkingDays(ojtCertificationStartDate, process.ojtCertificationDays - 1);

  // Batch handover date is the next working day after OJT certification ends
  const batchHandoverDate = addWorkingDays(ojtCertificationEndDate, 1);

  return {
    inductionStart: format(adjustedStartDate, 'yyyy-MM-dd'),
    inductionEnd: format(inductionEndDate, 'yyyy-MM-dd'),
    trainingStart: format(trainingStartDate, 'yyyy-MM-dd'),
    trainingEnd: format(trainingEndDate, 'yyyy-MM-dd'),
    certificationStart: format(certificationStartDate, 'yyyy-MM-dd'),
    certificationEnd: format(certificationEndDate, 'yyyy-MM-dd'),
    ojtStart: format(ojtStartDate, 'yyyy-MM-dd'),
    ojtEnd: format(ojtEndDate, 'yyyy-MM-dd'),
    ojtCertificationStart: format(ojtCertificationStartDate, 'yyyy-MM-dd'),
    ojtCertificationEnd: format(ojtCertificationEndDate, 'yyyy-MM-dd'),
    batchHandover: format(batchHandoverDate, 'yyyy-MM-dd')
  };
};

export function CreateBatchForm() {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedLocation, setSelectedLocation] = useState<number | null>(null);
  const [selectedLob, setSelectedLob] = useState<number | null>(null);
  const [selectedTrainer, setSelectedTrainer] = useState<number | null>(null);
  const [selectedProcess, setSelectedProcess] = useState<any>(null);
  const [batchDates, setBatchDates] = useState<any>(null);

  // Step 1: Fetch Locations 
  const {
    data: locations = [],
    isLoading: isLoadingLocations
  } = useQuery({
    queryKey: [`/api/organizations/${user?.organizationId}/locations`]
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
    enabled: !!selectedLob,
    onSuccess: (data) => {
      // Reset selected process when processes change
      setSelectedProcess(null);
      setBatchDates(null);
    }
  });

  // Fetch trainers with location filter
  const {
    data: trainers = [],
    isLoading: isLoadingTrainers
  } = useQuery({
    queryKey: [`/api/organizations/${user?.organizationId}/users`],
    select: (users) => users.filter((user) =>
      user.role === 'trainer' &&
      (!selectedLocation || user.locationId === selectedLocation)
    ),
    enabled: !!user?.organizationId
  });

  // Fetch trainer's manager when trainer is selected
  const {
    data: trainerManager,
    isLoading: isLoadingManager
  } = useQuery({
    queryKey: [`/api/organizations/${user?.organizationId}/users/${selectedTrainer}`],
    enabled: !!selectedTrainer && !!user?.organizationId,
    select: (trainer) => {
      if (!trainer?.managerId) {
        return null;
      }
      // Find manager from trainers list
      return trainers.find(u => u.id === trainer.managerId);
    }
  });

  const form = useForm({
    resolver: zodResolver(insertOrganizationBatchSchema),
    defaultValues: {
      status: 'planning', // Set default status to 'planning'
      organizationId: user?.organizationId,
    },
  });

  const createBatchMutation = useMutation({
    mutationFn: async (data) => {
      const response = await fetch(`/api/organizations/${user?.organizationId}/batches`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create batch');
      }

      return response.json();
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
      setSelectedTrainer(null);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create batch. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Effect to update batch dates when start date or process changes
  useEffect(() => {
    const startDate = form.getValues('startDate');
    if (startDate && selectedProcess) {
      const dates = calculateBatchDates(startDate, selectedProcess);
      setBatchDates(dates);
      // Update end date in form
      if (dates) {
        form.setValue('endDate', dates.certificationEnd);
      }
    }
  }, [form.watch('startDate'), selectedProcess]);

  const onSubmit = (data) => {
    // Include all necessary fields
    const batchData = {
      ...data,
      organizationId: user?.organizationId,
      status: 'planning',
      endDate: batchDates?.certificationEnd || data.endDate,
    };
    createBatchMutation.mutate(batchData);
  };

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
                    // Reset dependent fields
                    setSelectedLob(null);
                    form.setValue('lineOfBusinessId', null);
                    form.setValue('processId', null);
                    form.setValue('trainerId', null);
                    setSelectedTrainer(null);
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
                    form.setValue('processId', null);
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

          {/* Process selection - updated to store selected process */}
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
                    const process = processes.find(p => p.id === processId);
                    setSelectedProcess(process);

                    // If there's already a start date, recalculate dates
                    const startDate = form.getValues('startDate');
                    if (startDate && process) {
                      const dates = calculateBatchDates(startDate, process);
                      setBatchDates(dates);
                      if (dates) {
                        form.setValue('endDate', dates.certificationEnd);
                      }
                    }
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
                    setSelectedTrainer(trainerId);
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

          {/* Reporting Manager (Read-only) */}
          <FormItem>
            <FormLabel>Reporting Manager</FormLabel>
            <FormControl>
              <Input
                value={trainerManager?.fullName || 'No manager assigned'}
                disabled={true}
                readOnly={true}
                placeholder={isLoadingManager ? 'Loading manager...' : 'No manager assigned'}
              />
            </FormControl>
          </FormItem>

          {/* Start Date */}
          <FormField
            control={form.control}
            name="startDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Batch Start Date (Induction Start)</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Batch Status */}
          <FormField
            control={form.control}
            name="status"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Batch Status</FormLabel>
                <FormControl>
                  <Input
                    value="Planning – Before training begins"
                    disabled
                    readOnly
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Display calculated dates */}
          {batchDates && (
            <>
              <FormItem>
                <FormLabel>Induction End Date</FormLabel>
                <FormControl>
                  <Input
                    type="date"
                    value={batchDates.inductionEnd}
                    disabled
                    readOnly
                  />
                </FormControl>
              </FormItem>

              <FormItem>
                <FormLabel>Training Start Date</FormLabel>
                <FormControl>
                  <Input
                    type="date"
                    value={batchDates.trainingStart}
                    disabled
                    readOnly
                  />
                </FormControl>
              </FormItem>

              <FormItem>
                <FormLabel>Training End Date</FormLabel>
                <FormControl>
                  <Input
                    type="date"
                    value={batchDates.trainingEnd}
                    disabled
                    readOnly
                  />
                </FormControl>
              </FormItem>

              <FormItem>
                <FormLabel>Certification Start Date</FormLabel>
                <FormControl>
                  <Input
                    type="date"
                    value={batchDates.certificationStart}
                    disabled
                    readOnly
                  />
                </FormControl>
              </FormItem>

              <FormItem>
                <FormLabel>Certification End Date</FormLabel>
                <FormControl>
                  <Input
                    type="date"
                    value={batchDates.certificationEnd}
                    disabled
                    readOnly
                  />
                </FormControl>
              </FormItem>

              <FormItem>
                <FormLabel>OJT Start Date</FormLabel>
                <FormControl>
                  <Input
                    type="date"
                    value={batchDates.ojtStart}
                    disabled
                    readOnly
                  />
                </FormControl>
              </FormItem>

              <FormItem>
                <FormLabel>OJT End Date</FormLabel>
                <FormControl>
                  <Input
                    type="date"
                    value={batchDates.ojtEnd}
                    disabled
                    readOnly
                  />
                </FormControl>
              </FormItem>

              <FormItem>
                <FormLabel>OJT Certification Start Date</FormLabel>
                <FormControl>
                  <Input
                    type="date"
                    value={batchDates.ojtCertificationStart}
                    disabled
                    readOnly
                  />
                </FormControl>
              </FormItem>

              <FormItem>
                <FormLabel>OJT Certification End Date</FormLabel>
                <FormControl>
                  <Input
                    type="date"
                    value={batchDates.ojtCertificationEnd}
                    disabled
                    readOnly
                  />
                </FormControl>
              </FormItem>

              <FormItem>
                <FormLabel>BATCH HANDOVER TO OPS DATE</FormLabel>
                <FormControl>
                  <Input
                    type="date"
                    value={batchDates.batchHandover}
                    disabled
                    readOnly
                  />
                </FormControl>
              </FormItem>
            </>
          )}

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
                    {...field}
                    onChange={(e) => field.onChange(parseInt(e.target.value))}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="flex justify-end space-x-2">
          <Button
            type="submit"
            disabled={
              createBatchMutation.isPending ||
              !form.formState.isValid ||
              isLoadingLocations ||
              isLoadingLobs ||
              isLoadingProcesses ||
              isLoadingTrainers ||
              isLoadingManager
            }
          >
            {createBatchMutation.isPending ? "Creating..." : "Create Batch"}
          </Button>
        </div>
      </form>
    </Form>
  );
}