import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format, addDays } from "date-fns";
import { CalendarIcon, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

// Import UI components
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

// Define types
interface CurrentUser {
  id: number;
  organizationId: number;
  role: string;
}

interface Process {
  id: number;
  name: string;
  lineOfBusiness: string;
  inductionDays: number;
  trainingDays: number;
  certificationDays: number;
  ojtDays: number;
  ojtCertificationDays: number;
}

interface Trainer {
  id: number;
  name: string;
  managerId?: number;
  manager?: {
    id: number;
    name: string;
  };
}

interface Location {
  id: number;
  name: string;
  parentId?: number;
}

interface OrganizationSettings {
  processes: Process[];
  locations: Location[];
  roles: string[];
}

const batchCategoryEnum = z.enum([
  "New_Hire_Training",
  "Upskill_Training",
  "Recertification"
]);

const batchStatusEnum = z.enum([
  "planning",
  "induction",
  "training",
  "certification",
  "ojt",
  "ojt_certification",
  "closed",
  "cancelled",
  "rescheduled"
]);

const formSchema = z.object({
  // Account Details
  name: z.string().min(1, "Batch name is required"),
  lineOfBusiness: z.string().min(1, "Line of Business is required"),
  processId: z.string().min(1, "Process Name is required"),
  trainerId: z.string().min(1, "Trainer selection is required"),
  managerId: z.string().min(1, "Manager selection is required"),
  locationId: z.string().min(1, "Location is required"),

  // Batch Details
  category: batchCategoryEnum,
  status: batchStatusEnum.default("planning"),
  participantCount: z.number().min(1, "Participant count must be at least 1"),
  capacityLimit: z.number().min(1, "Capacity limit must be at least 1"),
  inductionStartDate: z.date(),
  inductionEndDate: z.date().optional(),
  trainingStartDate: z.date().optional(),
  trainingEndDate: z.date().optional(),
  certificationStartDate: z.date().optional(),
  certificationEndDate: z.date().optional(),

  // OJT Details
  ojtStartDate: z.date().optional(),
  ojtEndDate: z.date().optional(),
  ojtCertificationStartDate: z.date().optional(),
  ojtCertificationEndDate: z.date().optional(),
  handoverToOpsDate: z.date().optional(),

  // For rescheduled batches
  originalStartDate: z.date().optional(),
  rescheduleReason: z.string().optional(),
});

type BatchFormValues = z.infer<typeof formSchema>;

interface CreateBatchFormProps {
  onClose: () => void;
}

export function CreateBatchForm({ onClose }: CreateBatchFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedProcess, setSelectedProcess] = useState<Process | null>(null);
  const [selectedTrainer, setSelectedTrainer] = useState<Trainer | null>(null);
  const [batchNumber, setBatchNumber] = useState("");
  const [filteredProcesses, setFilteredProcesses] = useState<Process[]>([]);
  const [uniqueLOBs, setUniqueLOBs] = useState<string[]>([]);

  // Get the current user's organization ID with better error handling
  const { data: currentUser } = useQuery<CurrentUser>({
    queryKey: ['/api/user'],
    retry: 3,
    onError: (error: Error) => {
      console.error('Error fetching user:', error);
      toast({
        title: "Error fetching user data",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Fetch organization settings with improved error handling
  const {
    data: settings,
    isLoading: isSettingsLoading,
    error: settingsError
  } = useQuery<OrganizationSettings>({
    queryKey: [`/api/organizations/${currentUser?.organizationId}/settings`],
    enabled: !!currentUser?.organizationId,
    onSuccess: (data) => {
      console.log('Successfully fetched settings:', data);
      // Extract unique LOBs from processes
      if (data?.processes) {
        const lobs = Array.from(new Set(data.processes.map(p => p.lineOfBusiness)));
        console.log('Unique LOBs:', lobs);
        setUniqueLOBs(lobs);
      }
    },
    onError: (error: Error) => {
      console.error('Error fetching settings:', error);
      toast({
        title: "Error fetching organization settings",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Fetch trainers with improved error handling
  const {
    data: trainers = [],
    isLoading: isTrainersLoading,
    error: trainersError
  } = useQuery<Trainer[]>({
    queryKey: ['/api/users', currentUser?.organizationId],
    enabled: !!currentUser?.organizationId,
    onSuccess: (data) => {
      console.log('Successfully fetched trainers:', data);
    },
    select: (data: any[]) => {
      if (!Array.isArray(data)) {
        console.error('Expected array of users, got:', data);
        return [];
      }
      return data
        .filter(user => user.role === 'trainer')
        .map(trainer => ({
          id: trainer.id,
          name: trainer.fullName || trainer.username || `Trainer ${trainer.id}`,
          managerId: trainer.managerId,
          manager: trainer.managerId ? {
            id: trainer.managerId,
            name: data.find(u => u.id === trainer.managerId)?.fullName ||
                 data.find(u => u.id === trainer.managerId)?.username ||
                 `Manager ${trainer.managerId}`
          } : undefined
        }));
    },
    onError: (error: Error) => {
      console.error('Error fetching trainers:', error);
      toast({
        title: "Error fetching trainers",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Initialize form
  const form = useForm<BatchFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      status: "planning",
      category: "New_Hire_Training",
      participantCount: 1,
      capacityLimit: 1,
    },
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

  // Filter processes when LOB changes with improved error handling
  useEffect(() => {
    const selectedLOB = form.watch('lineOfBusiness');
    if (selectedLOB && settings?.processes) {
      try {
        console.log('Filtering processes for LOB:', selectedLOB);
        console.log('Available processes:', settings.processes);

        const filtered = settings.processes.filter(
          (process: Process) => process.lineOfBusiness === selectedLOB
        );
        console.log('Filtered processes:', filtered);

        setFilteredProcesses(filtered);
        form.setValue('processId', '');
        setSelectedProcess(null);
      } catch (error) {
        console.error('Error filtering processes:', error);
        toast({
          title: "Error filtering processes",
          description: "Failed to filter processes for selected line of business",
          variant: "destructive",
        });
      }
    }
  }, [form.watch('lineOfBusiness'), settings?.processes]);

  // Update all dates when process or start date changes
  useEffect(() => {
    if (selectedProcess && form.getValues('inductionStartDate')) {
      const startDate = form.getValues('inductionStartDate');

      // Calculate all dates based on process durations
      const inductionEndDate = addDays(startDate, selectedProcess.inductionDays);
      const trainingStartDate = addDays(inductionEndDate, 1);
      const trainingEndDate = addDays(trainingStartDate, selectedProcess.trainingDays);
      const certificationStartDate = addDays(trainingEndDate, 1);
      const certificationEndDate = addDays(certificationStartDate, selectedProcess.certificationDays);
      const ojtStartDate = addDays(certificationEndDate, 1);
      const ojtEndDate = addDays(ojtStartDate, selectedProcess.ojtDays);
      const ojtCertificationStartDate = addDays(ojtEndDate, 1);
      const ojtCertificationEndDate = addDays(ojtCertificationStartDate, selectedProcess.ojtCertificationDays);

      // Update form values
      form.setValue('inductionEndDate', inductionEndDate);
      form.setValue('trainingStartDate', trainingStartDate);
      form.setValue('trainingEndDate', trainingEndDate);
      form.setValue('certificationStartDate', certificationStartDate);
      form.setValue('certificationEndDate', certificationEndDate);
      form.setValue('ojtStartDate', ojtStartDate);
      form.setValue('ojtEndDate', ojtEndDate);
      form.setValue('ojtCertificationStartDate', ojtCertificationStartDate);
      form.setValue('ojtCertificationEndDate', ojtCertificationEndDate);
    }
  }, [selectedProcess, form.watch('inductionStartDate')]);

  // Improved manager auto-selection with better error handling
  useEffect(() => {
    if (selectedTrainer?.managerId) {
      try {
        const manager = trainers.find(t => t.manager?.id === selectedTrainer.managerId);
        if (manager) {
          form.setValue('managerId', selectedTrainer.managerId.toString());
        }
      } catch (error) {
        console.error('Error setting manager:', error);
        toast({
          title: "Error setting manager",
          description: "Failed to auto-select manager for trainer",
          variant: "destructive",
        });
      }
    }
  }, [selectedTrainer]);

  const createBatchMutation = useMutation({
    mutationFn: async (values: BatchFormValues) => {
      const formatDate = (date: Date | undefined) => {
        if (!date) return undefined;
        return format(date, "yyyy-MM-dd");
      };

      if (!currentUser?.organizationId) {
        throw new Error('Organization ID is required');
      }

      const response = await fetch('/api/batches', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: values.name,
          batchNumber,
          category: values.category,
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
          ojtStartDate: formatDate(values.ojtStartDate),
          ojtEndDate: formatDate(values.ojtEndDate),
          ojtCertificationStartDate: formatDate(values.ojtCertificationStartDate),
          ojtCertificationEndDate: formatDate(values.ojtCertificationEndDate),
          handoverToOpsDate: formatDate(values.handoverToOpsDate),
          originalStartDate: formatDate(values.originalStartDate),
          rescheduleReason: values.rescheduleReason,
          organizationId: currentUser.organizationId,
        }),
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

  // Show loading states
  if (!currentUser || isSettingsLoading || isTrainersLoading) {
    return (
      <div className="flex items-center justify-center p-6">
        <Loader2 className="h-6 w-6 animate-spin" />
        <span className="ml-2">Loading form data...</span>
      </div>
    );
  }

  // Handle API errors
  if (settingsError || trainersError) {
    return (
      <div className="flex items-center justify-center p-6">
        <Button
          variant="outline"
          onClick={() => {
            queryClient.invalidateQueries({ queryKey: [`/api/organizations/${currentUser.organizationId}/settings`] });
            queryClient.invalidateQueries({ queryKey: ['/api/users', currentUser?.organizationId] });
          }}
        >
          Retry Loading Data
        </Button>
      </div>
    );
  }

  return (
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
                        {settings?.locations?.map((location: Location) => (
                          <SelectItem 
                            key={`location-${location.id}`} 
                            value={location.id.toString()}
                          >
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
                        {uniqueLOBs.map((lob: string) => (
                          <SelectItem 
                            key={`lob-${lob}`} 
                            value={lob}
                          >
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
                    <FormLabel>Process</FormLabel>
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
                        {filteredProcesses.map((process: Process) => (
                          <SelectItem 
                            key={`process-${process.id}`} 
                            value={process.id.toString()}
                          >
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
                        {trainers.map((trainer: Trainer) => (
                          <SelectItem 
                            key={`trainer-${trainer.id}`} 
                            value={trainer.id.toString()}
                          >
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
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Manager will be auto-selected based on trainer" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {trainers
                          .filter(trainer => trainer.manager)
                          .map(trainer => (
                            <SelectItem
                              key={`manager-${trainer.manager?.id}`}
                              value={trainer.manager?.id.toString() || ""}
                            >
                              {trainer.manager?.name}
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
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Batch Category</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="New_Hire_Training">New Hire Training</SelectItem>
                        <SelectItem value="Upskill_Training">Upskill Training</SelectItem>
                        <SelectItem value="Recertification">Recertification</SelectItem>
                      </SelectContent>
                    </Select>
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

              <div>
                <FormLabel>Batch Number</FormLabel>
                <Input value={batchNumber} disabled />
              </div>

              <FormField
                control={form.control}
                name="capacityLimit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Batch Capacity</FormLabel>
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

              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Batch Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="planning">Planning</SelectItem>
                        <SelectItem value="induction">Induction</SelectItem>
                        <SelectItem value="training">Training</SelectItem>
                        <SelectItem value="certification">Certification</SelectItem>
                        <SelectItem value="ojt">OJT</SelectItem>
                        <SelectItem value="ojt_certification">OJT Certification</SelectItem>
                        <SelectItem value="closed">Closed</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                        <SelectItem value="rescheduled">Rescheduled</SelectItem>
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
            </div>

            {/* Schedule Preview */}
            {selectedProcess && form.watch('inductionStartDate') && (
              <div className="mt-4 space-y-2">
                <h4 className="font-medium">Schedule Preview</h4>
                <div className="text-sm space-y-2 bg-muted p-4 rounded-md">
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                    <div>
                      <span className="font-medium">Induction:</span>
                      <div className="text-muted-foreground">
                        {format(form.getValues('inductionStartDate'), "MMM d, yyyy")} -
                        {format(form.getValues('inductionEndDate') || new Date(), "MMM d, yyyy")}
                      </div>
                    </div>

                    <div>
                      <span className="font-medium">Training:</span>
                      <div className="text-muted-foreground">
                        {format(form.getValues('trainingStartDate') || new Date(), "MMM d, yyyy")} -
                        {format(form.getValues('trainingEndDate') || new Date(), "MMM d, yyyy")}
                      </div>
                    </div>

                    <div>
                      <span className="font-medium">Certification:</span>
                      <div className="text-muted-foreground">
                        {format(form.getValues('certificationStartDate') || new Date(), "MMM d, yyyy")} -
                        {format(form.getValues('certificationEndDate') || new Date(), "MMM d, yyyy")}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* OJT Details Section */}
        <Card>
          <CardHeader>
            <CardTitle>OJT Details</CardTitle>
          </CardHeader>
          <CardContent>
            {selectedProcess && form.watch('inductionStartDate') && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="font-medium">OJT Period:</span>
                    <div className="text-muted-foreground">
                      {format(form.getValues('ojtStartDate') || new Date(), "MMM d, yyyy")} -
                      {format(form.getValues('ojtEndDate') || new Date(), "MMM d, yyyy")}
                    </div>
                  </div>

                  <div>
                    <span className="font-medium">OJT Certification:</span>
                    <div className="text-muted-foreground">
                      {format(form.getValues('ojtCertificationStartDate') || new Date(), "MMM d, yyyy")} -
                      {format(form.getValues('ojtCertificationEndDate') || new Date(), "MMM d, yyyy")}
                    </div>
                  </div>
                </div>

                <FormField
                  control={form.control}
                  name="handoverToOpsDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Handover to Ops Date</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant={"outline"}
                              className={cn(
                                "w-[240px] pl-3 text-left font-normal",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              {field.value ? (
                                format(field.value, "MMMM d, yyyy")
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
                            disabled={(date) =>
                              date < (form.getValues('ojtCertificationEndDate') || new Date())
                            }
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Form Actions */}
        <div className="flex justify-end space-x-4">
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
              "Create Batch"
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}