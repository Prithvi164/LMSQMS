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
import { insertOrganizationBatchSchema, type InsertOrganizationBatch } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";

interface CreateBatchFormProps {
  onSuccess: () => void;
}

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
  const adjustedStartDate = isSunday(inductionStartDate)
    ? addDays(inductionStartDate, 1)
    : inductionStartDate;

  const inductionEndDate = addWorkingDays(adjustedStartDate, process.inductionDays - 1);
  const trainingStartDate = addWorkingDays(inductionEndDate, 1);
  const trainingEndDate = addWorkingDays(trainingStartDate, process.trainingDays - 1);
  const certificationStartDate = addWorkingDays(trainingEndDate, 1);
  const certificationEndDate = addWorkingDays(certificationStartDate, process.certificationDays - 1);

  const ojtStartDate = addWorkingDays(certificationEndDate, 1);
  const ojtEndDate = addWorkingDays(ojtStartDate, process.ojtDays - 1);
  const ojtCertificationStartDate = addWorkingDays(ojtEndDate, 1);
  const ojtCertificationEndDate = addWorkingDays(ojtCertificationStartDate, process.ojtCertificationDays - 1);
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

export function CreateBatchForm({ onSuccess }: CreateBatchFormProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedLocation, setSelectedLocation] = useState<number | null>(null);
  const [selectedLob, setSelectedLob] = useState<number | null>(null);
  const [selectedTrainer, setSelectedTrainer] = useState<number | null>(null);
  const [selectedProcess, setSelectedProcess] = useState<any>(null);
  const [batchDates, setBatchDates] = useState<any>(null);

  const form = useForm<InsertOrganizationBatch>({
    resolver: zodResolver(insertOrganizationBatchSchema),
    defaultValues: {
      batchCode: "",
      name: "",
      startDate: "",
      endDate: "",
      capacityLimit: 50,
      status: "planning",
      processId: 0,
      locationId: 0,
      trainerId: 0,
      organizationId: user?.organizationId || 0,
      lineOfBusinessId: 0, // Added lineOfBusinessId
    },
  });

  const { data: locations = [] } = useQuery({
    queryKey: [`/api/organizations/${user?.organizationId}/locations`]
  });

  const { data: lobs = [] } = useQuery({
    queryKey: [`/api/organizations/${user?.organizationId}/locations/${selectedLocation}/line-of-businesses`],
    enabled: !!selectedLocation && !!user?.organizationId
  });

  const { data: processes = [] } = useQuery({
    queryKey: [`/api/organizations/${user?.organizationId}/line-of-businesses/${selectedLob}/processes`],
    enabled: !!selectedLob
  });

  const { data: trainers = [] } = useQuery({
    queryKey: [`/api/organizations/${user?.organizationId}/users`],
    select: (users: any[]) => users.filter((user) =>
      user.role === 'trainer' &&
      (!selectedLocation || user.locationId === selectedLocation)
    ),
    enabled: !!user?.organizationId
  });

  const { data: trainerManager } = useQuery({
    queryKey: [`/api/organizations/${user?.organizationId}/users/${selectedTrainer}`],
    enabled: !!selectedTrainer && !!user?.organizationId,
    select: (trainer: any) => {
      if (!trainer?.managerId) return null;
      return trainers.find(u => u.id === trainer.managerId);
    }
  });

  const createBatchMutation = useMutation({
    mutationFn: async (data: InsertOrganizationBatch) => {
      const formattedData = {
        ...data,
        startDate: format(new Date(data.startDate), 'yyyy-MM-dd'),
        endDate: format(new Date(data.endDate), 'yyyy-MM-dd'),
        capacityLimit: Number(data.capacityLimit),
        processId: Number(data.processId),
        locationId: Number(data.locationId),
        trainerId: Number(data.trainerId),
        lineOfBusinessId: Number(data.lineOfBusinessId), // Added lineOfBusinessId
        organizationId: Number(user?.organizationId),
      };

      console.log('Submitting batch data:', formattedData);

      const response = await fetch(`/api/organizations/${user?.organizationId}/batches`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formattedData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Server error:', errorData);
        throw new Error(errorData.message || 'Failed to create batch');
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
      onSuccess();
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

  useEffect(() => {
    const startDate = form.getValues('startDate');
    if (startDate && selectedProcess) {
      const dates = calculateBatchDates(startDate, selectedProcess);
      setBatchDates(dates);
      if (dates) {
        form.setValue('endDate', dates.certificationEnd);
      }
    }
  }, [form.watch('startDate'), selectedProcess]);

  const onSubmit = async (data: InsertOrganizationBatch) => {
    try {
      if (!user?.organizationId) {
        throw new Error('Organization ID is required');
      }

      const batchData = {
        ...data,
        organizationId: Number(user.organizationId),
        status: 'planning' as const,
        endDate: batchDates?.certificationEnd || data.endDate,
        lineOfBusinessId: selectedLob || 0, //Added lineOfBusinessId
      };

      console.log('Form submitted with data:', batchData);
      await createBatchMutation.mutateAsync(batchData);
    } catch (error) {
      console.error('Form submission error:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create batch",
        variant: "destructive",
      });
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
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
                    form.setValue('processId', 0);
                    form.setValue('trainerId', 0);
                    setSelectedTrainer(null);
                  }}
                  value={field.value?.toString() || ""}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select location" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {locations.map((location: any) => (
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
                    form.setValue('processId', 0);
                  }}
                  value={field.value?.toString() || ""}
                  disabled={!selectedLocation}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder={selectedLocation ? "Select LOB" : "Select location first"} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {lobs.map((lob: any) => (
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
                    const process = processes.find((p: any) => p.id === processId);
                    setSelectedProcess(process);
                    const startDate = form.getValues('startDate');
                    if (startDate && process) {
                      const dates = calculateBatchDates(startDate, process);
                      setBatchDates(dates);
                      if (dates) {
                        form.setValue('endDate', dates.certificationEnd);
                      }
                    }
                  }}
                  value={field.value?.toString() || ""}
                  disabled={!selectedLob}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder={selectedLob ? "Select process" : "Select LOB first"} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {processes.map((process: any) => (
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
                  value={field.value?.toString() || ""}
                  disabled={!selectedLocation}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder={selectedLocation ? "Select trainer" : "Select location first"} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {trainers.map((trainer: any) => (
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

          <FormItem>
            <FormLabel>Reporting Manager</FormLabel>
            <FormControl>
              <Input
                value={trainerManager?.fullName || 'No manager assigned'}
                disabled
                readOnly
                placeholder="No manager assigned"
              />
            </FormControl>
          </FormItem>

          <FormField
            control={form.control}
            name="startDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Start Date</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

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
        </div>

        <div className="flex justify-end space-x-2">
          <Button
            type="submit"
            disabled={createBatchMutation.isPending}
          >
            {createBatchMutation.isPending ? "Creating..." : "Create Batch"}
          </Button>
        </div>
      </form>
    </Form>
  );
}