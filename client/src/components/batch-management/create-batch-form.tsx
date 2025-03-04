import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, addDays, isSunday, isWithinInterval } from "date-fns";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { CalendarIcon, Loader2 } from "lucide-react";
import { insertOrganizationBatchSchema, type InsertOrganizationBatch, insertBatchTemplateSchema, type InsertBatchTemplate, type BatchTemplate } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";


// Interface for date range
interface DateRange {
  start: Date;
  end: Date;
  label: string;
  status: 'induction' | 'training' | 'certification' | 'ojt' | 'ojt-certification';
}

// Interface for CreateBatchForm props
interface CreateBatchFormProps {
  editMode?: boolean;
  batchData?: any;
  onSuccess?: () => void;
}

// Function to determine batch status based on current date and phase dates
const determineBatchStatus = (batch: InsertOrganizationBatch): string => {
  const today = new Date();

  // Convert string dates to Date objects
  const dates = {
    inductionStart: new Date(batch.inductionStartDate),
    inductionEnd: batch.inductionEndDate ? new Date(batch.inductionEndDate) : null,
    trainingStart: batch.trainingStartDate ? new Date(batch.trainingStartDate) : null,
    trainingEnd: batch.trainingEndDate ? new Date(batch.trainingEndDate) : null,
    certificationStart: batch.certificationStartDate ? new Date(batch.certificationStartDate) : null,
    certificationEnd: batch.certificationEndDate ? new Date(batch.certificationEndDate) : null,
    ojtStart: batch.ojtStartDate ? new Date(batch.ojtStartDate) : null,
    ojtEnd: batch.ojtEndDate ? new Date(batch.ojtEndDate) : null,
    ojtCertificationStart: batch.ojtCertificationStartDate ? new Date(batch.ojtCertificationStartDate) : null,
    ojtCertificationEnd: batch.ojtCertificationEndDate ? new Date(batch.ojtCertificationEndDate) : null,
    handoverToOps: batch.handoverToOpsDate ? new Date(batch.handoverToOpsDate) : null
  };

  // Check which phase we're in based on current date
  if (today < dates.inductionStart) {
    return 'planned';
  } else if (dates.inductionEnd && isWithinInterval(today, { start: dates.inductionStart, end: dates.inductionEnd })) {
    return 'induction';
  } else if (dates.trainingEnd && isWithinInterval(today, { start: dates.trainingStart!, end: dates.trainingEnd })) {
    return 'training';
  } else if (dates.certificationEnd && isWithinInterval(today, { start: dates.certificationStart!, end: dates.certificationEnd })) {
    return 'certification';
  } else if (dates.ojtEnd && isWithinInterval(today, { start: dates.ojtStart!, end: dates.ojtEnd })) {
    return 'ojt';
  } else if (dates.ojtCertificationEnd && isWithinInterval(today, { start: dates.ojtCertificationStart!, end: dates.ojtCertificationEnd })) {
    return 'ojt_certification';
  } else if (dates.handoverToOps && today >= dates.handoverToOps) {
    return 'completed';
  }

  return 'planned'; // Default status
};

// Add this near the top where other fields are defined
const batchCategories = [
  { value: 'new_training', label: 'New Training' },
  { value: 'upskill', label: 'Upskill' },
  { value: 'recertification', label: 'Recertification' }
] as const;

export function CreateBatchForm({ editMode = false, batchData, onSuccess }: CreateBatchFormProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedLocation, setSelectedLocation] = useState<number | null>(null);
  const [selectedLob, setSelectedLob] = useState<number | null>(null);
  const [dateRanges, setDateRanges] = useState<DateRange[]>([]);
  const [progress, setProgress] = useState(0);
  const [isCreating, setIsCreating] = useState(false);
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');

  const form = useForm<InsertOrganizationBatch>({
    resolver: zodResolver(insertOrganizationBatchSchema),
    defaultValues: editMode && batchData ? {
      ...batchData,
      startDate: batchData.startDate ? format(new Date(batchData.startDate), 'yyyy-MM-dd') : '',
      endDate: batchData.endDate ? format(new Date(batchData.endDate), 'yyyy-MM-dd') : '',
      inductionStartDate: batchData.inductionStartDate ? format(new Date(batchData.inductionStartDate), 'yyyy-MM-dd') : '',
      inductionEndDate: batchData.inductionEndDate ? format(new Date(batchData.inductionEndDate), 'yyyy-MM-dd') : '',
      trainingStartDate: batchData.trainingStartDate ? format(new Date(batchData.trainingStartDate), 'yyyy-MM-dd') : '',
      trainingEndDate: batchData.trainingEndDate ? format(new Date(batchData.trainingEndDate), 'yyyy-MM-dd') : '',
      certificationStartDate: batchData.certificationStartDate ? format(new Date(batchData.certificationStartDate), 'yyyy-MM-dd') : '',
      certificationEndDate: batchData.certificationEndDate ? format(new Date(batchData.certificationEndDate), 'yyyy-MM-dd') : '',
      ojtStartDate: batchData.ojtStartDate ? format(new Date(batchData.ojtStartDate), 'yyyy-MM-dd') : '',
      ojtEndDate: batchData.ojtEndDate ? format(new Date(batchData.ojtEndDate), 'yyyy-MM-dd') : '',
      ojtCertificationStartDate: batchData.ojtCertificationStartDate ? format(new Date(batchData.ojtCertificationStartDate), 'yyyy-MM-dd') : '',
      ojtCertificationEndDate: batchData.ojtCertificationEndDate ? format(new Date(batchData.ojtCertificationEndDate), 'yyyy-MM-dd') : '',
      handoverToOpsDate: batchData.handoverToOpsDate ? format(new Date(batchData.handoverToOpsDate), 'yyyy-MM-dd') : '',
    } : {
      status: 'planned',
      organizationId: user?.organizationId || undefined,
      startDate: '',
      endDate: '',
      inductionStartDate: '',
      capacityLimit: 1,
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
      handoverToOpsDate: '',
      batchCategory: 'new_training'
    },
  });

  const {
    data: templates = [],
    isLoading: isLoadingTemplates,
    error: templatesError
  } = useQuery<BatchTemplate[]>({
    queryKey: [`/api/organizations/${user?.organizationId}/batch-templates`],
    enabled: !!user?.organizationId,
    staleTime: 30000,
    retry: 1,
    onError: (error) => {
      console.error('Error loading templates:', error);
      toast({
        title: "Error",
        description: "Failed to load templates. Please try again.",
        variant: "destructive",
      });
    }
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

  const saveTemplateMutation = useMutation({
    mutationFn: async (template: InsertBatchTemplate) => {
      if (!user?.organizationId) {
        throw new Error('Organization ID is required');
      }

      try {
        if (!template.name) throw new Error('Template name is required');
        if (!template.locationId) throw new Error('Location is required');
        if (!template.lineOfBusinessId) throw new Error('Line of Business is required');
        if (!template.processId) throw new Error('Process is required');
        if (!template.trainerId) throw new Error('Trainer is required');
        if (!template.capacityLimit || template.capacityLimit < 1) throw new Error('Capacity must be at least 1');

        const response = await fetch(`/api/organizations/${user.organizationId}/batch-templates`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(template),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Failed to save template');
        }

        return await response.json();
      } catch (error) {
        console.error('Template save error:', error);
        throw error instanceof Error ? error : new Error('Failed to save template');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/organizations/${user?.organizationId}/batch-templates`] });
      toast({
        title: "Success",
        description: "Template saved successfully",
      });
      setIsSavingTemplate(false);
      setTemplateName('');
      setTemplateDescription('');
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save template",
        variant: "destructive",
      });
    }
  });

  const handleTemplateSelect = async (templateId: string) => {
    const template = templates.find(t => t.id.toString() === templateId);
    if (template) {
      try {
        const locationId = parseInt(template.locationId.toString());
        if (!isNaN(locationId)) {
          setSelectedLocation(locationId);
          form.setValue('locationId', locationId);
        }

        await new Promise(resolve => setTimeout(resolve, 100));

        const lobId = parseInt(template.lineOfBusinessId.toString());
        if (!isNaN(lobId)) {
          setSelectedLob(lobId);
          form.setValue('lineOfBusinessId', lobId);
        }

        await new Promise(resolve => setTimeout(resolve, 100));

        const processId = parseInt(template.processId.toString());
        if (!isNaN(processId)) {
          form.setValue('processId', processId);
        }

        const trainerId = parseInt(template.trainerId.toString());
        if (!isNaN(trainerId)) {
          form.setValue('trainerId', trainerId);
        }

        if (template.capacityLimit) {
          form.setValue('capacityLimit', parseInt(template.capacityLimit.toString()));
        }

        if (template.batchCategory) {
          form.setValue('batchCategory', template.batchCategory);
        }

        toast({
          title: "Template Loaded",
          description: "All template values have been applied successfully.",
        });
      } catch (error) {
        console.error('Error applying template:', error);
        toast({
          title: "Error",
          description: "Failed to apply template values. Please try again.",
          variant: "destructive",
        });
      }
    }
  };

  const handleSaveTemplate = async () => {
    try {
      if (!templateName) throw new Error('Template name is required');

      const currentLocationId = parseInt(form.getValues('locationId')?.toString() || '');
      const currentLineOfBusinessId = parseInt(form.getValues('lineOfBusinessId')?.toString() || '');
      const currentProcessId = parseInt(form.getValues('processId')?.toString() || '');
      const currentTrainerId = parseInt(form.getValues('trainerId')?.toString() || '');
      const currentCapacityLimit = parseInt(form.getValues('capacityLimit')?.toString() || '');
      const currentBatchCategory = form.getValues('batchCategory');

      if (isNaN(currentLocationId)) throw new Error('Please select a location before saving template');
      if (isNaN(currentLineOfBusinessId)) throw new Error('Please select a line of business before saving template');
      if (isNaN(currentProcessId)) throw new Error('Please select a process before saving template');
      if (isNaN(currentTrainerId)) throw new Error('Please select a trainer before saving template');
      if (isNaN(currentCapacityLimit) || currentCapacityLimit < 1) throw new Error('Please set a valid capacity limit');
      if (!currentBatchCategory) throw new Error('Please select a batch category before saving template');

      const template: InsertBatchTemplate = {
        name: templateName,
        description: templateDescription,
        organizationId: user?.organizationId!,
        locationId: currentLocationId,
        lineOfBusinessId: currentLineOfBusinessId,
        processId: currentProcessId,
        trainerId: currentTrainerId,
        capacityLimit: currentCapacityLimit,
        batchCategory: currentBatchCategory
      };

      await saveTemplateMutation.mutateAsync(template);
    } catch (error) {
      console.error('Error saving template:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save template",
        variant: "destructive",
      });
    }
  };

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

  const createBatchMutation = useMutation({
    mutationFn: async (values: InsertOrganizationBatch) => {
      if (!user?.organizationId) {
        throw new Error('Organization ID is required');
      }

      try {
        setIsCreating(true);
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
      } finally {
        setTimeout(() => {
          setIsCreating(false);
        }, 500);
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
      if (onSuccess) {
        onSuccess();
      }
    },
    onError: (error: Error) => {
      console.error('Error creating batch:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to create batch. Please try again.",
        variant: "destructive",
      });
    }
  });

  const updateBatchMutation = useMutation({
    mutationFn: async (values: InsertOrganizationBatch) => {
      if (!user?.organizationId || !batchData?.id) {
        throw new Error('Organization ID and Batch ID are required for update');
      }

      try {
        setIsCreating(true);
        const response = await fetch(`/api/organizations/${user.organizationId}/batches/${batchData.id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(values),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Failed to update batch');
        }

        return await response.json();
      } catch (error) {
        console.error('API Error:', error);
        throw error;
      } finally {
        setTimeout(() => {
          setIsCreating(false);
        }, 500);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/organizations/${user?.organizationId}/batches`] });
      toast({
        title: "Success",
        description: "Batch updated successfully",
      });
      form.reset();
      if (onSuccess) {
        onSuccess();
      }
    },
    onError: (error: Error) => {
      console.error('Error updating batch:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to update batch. Please try again.",
        variant: "destructive",
      });
    }
  });


  async function onSubmit(values: InsertOrganizationBatch) {
    try {
      if (!values.name) throw new Error('Batch name is required');
      if (!values.startDate) throw new Error('Batch start date is required');
      if (values.locationId === undefined) throw new Error('Location is required');
      if (values.lineOfBusinessId === undefined) throw new Error('Line of Business is required');
      if (values.processId === undefined) throw new Error('Process is required');
      if (values.trainerId === undefined) throw new Error('Trainer is required');
      if (values.capacityLimit === undefined) throw new Error('Capacity limit is required');
      if (values.batchCategory === undefined) throw new Error('Batch Category is required');


      const currentStatus = determineBatchStatus(values);
      const formattedValues = {
        ...values,
        status: currentStatus
      };

      if (editMode) {
        await updateBatchMutation.mutateAsync(formattedValues);
      } else {
        await createBatchMutation.mutateAsync(formattedValues);
      }
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

      } catch (error) {
        console.error('Error calculating dates:', error);
      }
    }
  }, [form.watch('startDate'), form.watch('processId'), processes]);

  useEffect(() => {
    if (isCreating) {
      const timer = setInterval(() => {
        setProgress(prev => {
          if (prev >= 100) {
            clearInterval(timer);
            return 100;
          }
          return prev + 10;
        });
      }, 100);

      return () => clearInterval(timer);
    } else {
      setProgress(0);
    }
  }, [isCreating]);

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8 max-h-[calc(100vh-100px)] overflow-y-auto pr-4">
        {isCreating && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm font-medium">
              <span>Creating batch...</span>
              <span>{progress}%</span>
            </div>
            <Progress value={progress} className="w-full" />
          </div>
        )}

        <div className="grid grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="template"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Load from Template</FormLabel>
                <Select
                  onValueChange={handleTemplateSelect}
                  disabled={isLoadingTemplates}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a template" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {templates.map((template) => (
                      <SelectItem key={template.id} value={template.id.toString()}>
                        {template.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <Dialog>
            <DialogTrigger asChild>
              <Button
                type="button"
                variant="outline"
                disabled={!form.getValues('locationId') || !form.getValues('processId')}
              >
                Save as Template
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Save as Template</DialogTitle>
                <DialogDescription>
                  Save the current batch configuration as a template for future use.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <FormItem>
                  <FormLabel>Template Name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Enter template name"
                      value={templateName}
                      onChange={(e) => setTemplateName(e.target.value)}
                    />
                  </FormControl>
                </FormItem>
                <FormItem>
                  <FormLabel>Description (Optional)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Enter template description"
                      value={templateDescription}
                      onChange={(e) => setTemplateDescription(e.target.value)}
                    />
                  </FormControl>
                </FormItem>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  onClick={handleSaveTemplate}
                  disabled={saveTemplateMutation.isPending}
                >
                  {saveTemplateMutation.isPending ? "Saving..." : "Save Template"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <FormField
            control={form.control}
            name="batchCategory"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Batch Category</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  value={field.value}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {batchCategories.map((category) => (
                      <SelectItem key={category.value} value={category.value}>
                        {category.label}
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

        <div className="mt-8 flex justify-end"> {/* Adjusted to right-align the button */}
          <Button
            type="submit"
            disabled={
              createBatchMutation.isPending ||
              updateBatchMutation.isPending ||
              isCreating ||
              isLoadingLocations ||
              isLoadingLobs ||
              isLoadingProcesses ||
              isLoadingTrainers ||
              isLoadingTemplates
            }
          >
            {isCreating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {editMode ? "Updating..." : "Creating..."}
              </>
            ) : (
              editMode ? "Update Batch" : "Create Batch"
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}