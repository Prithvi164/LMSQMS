import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format, addDays } from "date-fns";
import { CalendarIcon, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

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
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface CreateBatchFormProps {
  onClose: () => void;
}

// Define interfaces for API data
interface Process {
  id: number;
  name: string;
  lineOfBusiness: string;
  inductionDays: number;
  trainingDays: number;
  certificationDays: number;
}

interface Trainer {
  id: number;
  name: string;
  managerId: number;
  manager?: {
    id: number;
    name: string;
  };
}

interface Location {
  id: number;
  name: string;
}

interface Settings {
  processes: Process[];
  locations: Location[];
}

const formSchema = z.object({
  name: z.string().min(1, "Batch name is required"),
  lineOfBusiness: z.string().min(1, "Line of Business is required"),
  processId: z.string().min(1, "Process Name is required"),
  trainerId: z.string().min(1, "Trainer selection is required"),
  managerId: z.string().min(1, "Manager selection is required"),
  locationId: z.string().min(1, "Location is required"),
  status: z.enum(["planned", "ongoing", "completed"]),
  participantCount: z.number().min(1, "Participant count must be at least 1"),
  capacityLimit: z.number().min(1, "Capacity limit must be at least 1"),
  inductionStartDate: z.date(),
  inductionEndDate: z.date().optional(),
  trainingStartDate: z.date().optional(),
  trainingEndDate: z.date().optional(),
  certificationStartDate: z.date().optional(),
  certificationEndDate: z.date().optional(),
});

type BatchFormValues = z.infer<typeof formSchema>;

export function CreateBatchForm({ onClose }: CreateBatchFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedProcess, setSelectedProcess] = useState<Process | null>(null);
  const [selectedTrainer, setSelectedTrainer] = useState<Trainer | null>(null);
  const [batchNumber, setBatchNumber] = useState("");
  const [filteredProcesses, setFilteredProcesses] = useState<Process[]>([]);

  // Fetch all settings including processes and LOBs
  const { data: settings } = useQuery<Settings>({
    queryKey: ['/api/organizations/settings'],
  });

  // Fetch trainers (users with trainer role)
  const { data: trainers } = useQuery<Trainer[]>({
    queryKey: ['/api/users'],
    select: (data) => data?.filter((user: any) => user.role === 'trainer') || [],
  });

  // Generate batch number
  useEffect(() => {
    const generateBatchNumber = () => {
      const date = new Date();
      const year = date.getFullYear();
      const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
      return `B${year}-${random}`;
    };
    setBatchNumber(generateBatchNumber());
  }, []);

  const form = useForm<BatchFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      status: "planned",
      participantCount: 1,
      capacityLimit: 1,
    },
  });

  // Filter processes when LOB changes
  useEffect(() => {
    const selectedLOB = form.watch('lineOfBusiness');
    if (selectedLOB && settings?.processes) {
      const filtered = settings.processes.filter(
        (process) => process.lineOfBusiness === selectedLOB
      );
      setFilteredProcesses(filtered);
      // Reset process selection when LOB changes
      form.setValue('processId', '');
      setSelectedProcess(null);
    }
  }, [form.watch('lineOfBusiness'), settings?.processes]);

  // Update dates when process is selected
  useEffect(() => {
    if (selectedProcess && form.getValues('inductionStartDate')) {
      const startDate = form.getValues('inductionStartDate');

      // Calculate all dates based on process days
      const inductionEndDate = addDays(startDate, selectedProcess.inductionDays);
      const trainingStartDate = addDays(inductionEndDate, 1);
      const trainingEndDate = addDays(trainingStartDate, selectedProcess.trainingDays);
      const certificationStartDate = addDays(trainingEndDate, 1);
      const certificationEndDate = addDays(certificationStartDate, selectedProcess.certificationDays);

      form.setValue('inductionEndDate', inductionEndDate);
      form.setValue('trainingStartDate', trainingStartDate);
      form.setValue('trainingEndDate', trainingEndDate);
      form.setValue('certificationStartDate', certificationStartDate);
      form.setValue('certificationEndDate', certificationEndDate);
    }
  }, [selectedProcess, form.watch('inductionStartDate')]);

  // Update manager when trainer is selected
  useEffect(() => {
    if (selectedTrainer?.managerId) {
      form.setValue('managerId', selectedTrainer.managerId.toString());
    }
  }, [selectedTrainer]);

  const createBatchMutation = useMutation({
    mutationFn: async (values: BatchFormValues) => {
      const formatDate = (date: Date | undefined) => {
        if (!date) return undefined;
        return format(date, "yyyy-MM-dd'T'HH:mm:ss.SSSxxx");
      };

      const data = {
        name: values.name,
        batchNumber,
        status: values.status,
        lineOfBusiness: values.lineOfBusiness,
        processId: parseInt(values.processId, 10),
        trainerId: parseInt(values.trainerId, 10),
        managerId: parseInt(values.managerId, 10),
        locationId: parseInt(values.locationId, 10),
        participantCount: values.participantCount,
        capacityLimit: values.capacityLimit,
        inductionStartDate: formatDate(values.inductionStartDate),
        inductionEndDate: formatDate(values.inductionEndDate),
        trainingStartDate: formatDate(values.trainingStartDate),
        trainingEndDate: formatDate(values.trainingEndDate),
        certificationStartDate: formatDate(values.certificationStartDate),
        certificationEndDate: formatDate(values.certificationEndDate),
      };

      const response = await fetch('/api/batches', {
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
      queryClient.invalidateQueries({ queryKey: ['/api/batches'] });
      toast({
        title: "Success",
        description: "Batch created successfully",
      });
      onClose();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = async (data: BatchFormValues) => {
    try {
      await createBatchMutation.mutateAsync(data);
    } catch (error) {
      console.error("Error creating batch:", error);
    }
  };

  if (!settings || !trainers) {
    return (
      <div className="flex items-center justify-center p-6">
        <Loader2 className="h-6 w-6 animate-spin" />
        <span className="ml-2">Loading...</span>
      </div>
    );
  }

  const uniqueLOBs = Array.from(new Set(settings.processes.map(p => p.lineOfBusiness)));

  return (
    <div className="space-y-6">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          {/* Account Details Section */}
          <Card>
            <CardHeader>
              <CardTitle>Account Details</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-6">
              <div className="grid grid-cols-2 gap-4">
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

                <div>
                  <FormLabel>Batch Number</FormLabel>
                  <Input value={batchNumber} disabled />
                </div>

                <FormField
                  control={form.control}
                  name="lineOfBusiness"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Line of Business</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select Line of Business" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {uniqueLOBs.map((lob) => (
                            <SelectItem key={lob} value={lob}>
                              {lob}
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
                      <FormLabel>Process Name</FormLabel>
                      <Select 
                        onValueChange={(value) => {
                          field.onChange(value);
                          const process = filteredProcesses.find(p => p.id.toString() === value);
                          setSelectedProcess(process || null);
                        }} 
                        value={field.value}
                        disabled={!form.getValues('lineOfBusiness')}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select Process" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {filteredProcesses.map((process) => (
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
                      <FormLabel>Select Trainer</FormLabel>
                      <Select 
                        onValueChange={(value) => {
                          field.onChange(value);
                          const trainer = trainers.find(t => t.id.toString() === value);
                          setSelectedTrainer(trainer || null);
                        }}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select Trainer" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {trainers.map((trainer) => (
                            <SelectItem key={trainer.id} value={trainer.id.toString()}>
                              {trainer.name}
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
                  name="managerId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Manager</FormLabel>
                      <FormControl>
                        <Input 
                          value={selectedTrainer?.manager?.name || ''} 
                          disabled 
                          placeholder="Manager will be auto-selected based on trainer"
                        />
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
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select Location" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {settings.locations?.map((location) => (
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
              </div>
            </CardContent>
          </Card>

          {/* Batch Details Section */}
          <Card>
            <CardHeader>
              <CardTitle>Batch Details</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-6">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Batch Status</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="planned">Planned</SelectItem>
                          <SelectItem value="ongoing">Ongoing</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="participantCount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Participant Count</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="Enter participant count"
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value, 10))}
                        />
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
                          placeholder="Enter capacity limit"
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value, 10))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          {/* Training Schedule Section */}
          <Card>
            <CardHeader>
              <CardTitle>Training & Certification Schedule</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="inductionStartDate"
                  render={({ field }) => (
                    <FormItem>
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
                                format(field.value, "PPP")
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
                            selected={field.value}
                            onSelect={field.onChange}
                            disabled={(date) => date < new Date()}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {selectedProcess && form.watch('inductionStartDate') && (
                  <div className="space-y-2">
                    <p className="font-medium">Schedule Preview:</p>
                    <div className="text-sm text-muted-foreground space-y-1">
                      <p>Induction: {format(form.getValues('inductionStartDate'), "PPP")} to {format(form.getValues('inductionEndDate') || new Date(), "PPP")}</p>
                      <p>Training: {format(form.getValues('trainingStartDate') || new Date(), "PPP")} to {format(form.getValues('trainingEndDate') || new Date(), "PPP")}</p>
                      <p>Certification: {format(form.getValues('certificationStartDate') || new Date(), "PPP")} to {format(form.getValues('certificationEndDate') || new Date(), "PPP")}</p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end gap-4">
            <Button
              variant="outline"
              type="button"
              onClick={onClose}
              disabled={createBatchMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createBatchMutation.isPending}
            >
              {createBatchMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                "Add Batch"
              )}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}