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
import { CalendarIcon } from "lucide-react";
import { insertOrganizationBatchSchema, type InsertOrganizationBatch, insertBatchTemplateSchema, type InsertBatchTemplate, type BatchTemplate } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { motion } from "framer-motion";

// Interface for date range
interface DateRange {
  start: Date;
  end: Date;
  label: string;
  status: 'induction' | 'training' | 'certification' | 'ojt' | 'ojt-certification';
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

export function CreateBatchForm() {
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

  // Fetch templates
  const {
    data: templates = [],
    isLoading: isLoadingTemplates
  } = useQuery({
    queryKey: [`/api/organizations/${user?.organizationId}/batch-templates`],
    enabled: !!user?.organizationId
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

  // Save template mutation
  const saveTemplateMutation = useMutation({
    mutationFn: async (template: InsertBatchTemplate) => {
      if (!user?.organizationId) {
        throw new Error('Organization ID is required');
      }

      try {
        const response = await fetch(`/api/organizations/${user.organizationId}/batch-templates`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(template),
        });

        if (!response.ok) {
          // Try to parse error response as JSON
          try {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to save template');
          } catch (parseError) {
            // If JSON parsing fails, use the response status text
            throw new Error(`Failed to save template: ${response.statusText}`);
          }
        }

        const data = await response.json();
        return data;
      } catch (error) {
        console.error('Template save error:', error);
        throw error;
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
      console.error('Template save error:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to save template",
        variant: "destructive",
      });
    }
  });

  // Function to handle template selection
  const handleTemplateSelect = (templateId: string) => {
    const template = templates.find(t => t.id.toString() === templateId);
    if (template) {
      setSelectedLocation(template.locationId);
      setSelectedLob(template.lineOfBusinessId);
      form.setValue('locationId', template.locationId);
      form.setValue('lineOfBusinessId', template.lineOfBusinessId);
      form.setValue('processId', template.processId);
      form.setValue('trainerId', template.trainerId);
      form.setValue('capacityLimit', template.capacityLimit);
    }
  };

  // Function to save current configuration as template
  const handleSaveTemplate = async () => {
    try {
      if (!templateName) throw new Error('Template name is required');

      const template: InsertBatchTemplate = {
        name: templateName,
        description: templateDescription,
        organizationId: user?.organizationId!,
        locationId: form.getValues('locationId')!,
        lineOfBusinessId: form.getValues('lineOfBusinessId')!,
        processId: form.getValues('processId')!,
        trainerId: form.getValues('trainerId')!,
        capacityLimit: form.getValues('capacityLimit')!
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

      // Set the initial status based on the current date and batch dates
      const currentStatus = determineBatchStatus(values);
      const formattedValues = {
        ...values,
        status: currentStatus
      };

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

  const BatchProgressVisualizer = ({ dateRanges, currentStatus }: { dateRanges: DateRange[], currentStatus: string }) => {
    const getProgressPercentage = () => {
      if (!dateRanges.length) return 0;
      const firstDate = dateRanges[0].start;
      const lastDate = dateRanges[dateRanges.length - 1].end;
      const today = new Date();

      if (today < firstDate) return 0;
      if (today > lastDate) return 100;

      const totalDuration = lastDate.getTime() - firstDate.getTime();
      const elapsed = today.getTime() - firstDate.getTime();
      return Math.round((elapsed / totalDuration) * 100);
    };

    const progressPercentage = getProgressPercentage();

    return (
      <div className="col-span-2 space-y-4 p-6 border rounded-lg bg-card">
        <h3 className="font-semibold text-lg mb-4">Batch Progress Visualization</h3>

        {/* Overall Progress */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Overall Progress</span>
            <span>{progressPercentage}%</span>
          </div>
          <div className="relative h-2 bg-gray-200 rounded-full overflow-hidden">
            <motion.div
              className="absolute h-full bg-primary"
              initial={{ width: 0 }}
              animate={{ width: `${progressPercentage}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
        </div>

        {/* Phase Timeline */}
        <div className="grid grid-cols-5 gap-2 mt-6">
          {dateRanges.map((range, index) => (
            <motion.div
              key={index}
              className={cn(
                "relative p-4 rounded-lg",
                {
                  'bg-blue-100 border-blue-500': range.status === 'induction',
                  'bg-green-100 border-green-500': range.status === 'training',
                  'bg-yellow-100 border-yellow-500': range.status === 'certification',
                  'bg-purple-100 border-purple-500': range.status === 'ojt',
                  'bg-pink-100 border-pink-500': range.status === 'ojt-certification',
                },
                currentStatus === range.status ? 'border-2' : 'border',
              )}
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{
                scale: currentStatus === range.status ? 1.05 : 1,
                opacity: 1,
              }}
              transition={{ duration: 0.3 }}
            >
              <div className="text-center">
                <motion.div
                  className="font-medium mb-1"
                  animate={{
                    scale: currentStatus === range.status ? 1.1 : 1,
                  }}
                  transition={{ duration: 0.3 }}
                >
                  {range.label}
                </motion.div>
                <div className="text-xs opacity-75">
                  {format(range.start, "MMM d")} - {format(range.end, "MMM d")}
                </div>
              </div>
              {currentStatus === range.status && (
                <motion.div
                  className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-primary"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ duration: 0.3 }}
                />
              )}
            </motion.div>
          ))}
        </div>

        {/* Connection Lines */}
        <div className="relative h-1 -mt-8 mb-4">
          <div className="absolute w-full h-0.5 bg-gray-200 top-1/2 transform -translate-y-1/2" />
          {dateRanges.map((_, index) => (
            index < dateRanges.length - 1 && (
              <motion.div
                key={index}
                className="absolute h-2 w-2 rounded-full bg-gray-400"
                style={{ left: `${(index + 1) * (100 / dateRanges.length)}%` }}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: index * 0.1 }}
              />
            )
          ))}
        </div>
      </div>
    );
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="relative space-y-6 h-[calc(100vh-4rem)] flex flex-col">
        {isCreating && (
          <div className="sticky top-0 z-10 bg-background space-y-2 p-4 border-b">
            <div className="flex items-center justify-between text-sm font-medium">
              <span>Creating batch...</span>
              <span>{progress}%</span>
            </div>
            <Progress value={progress} className="w-full" />
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          <div className="space-y-4 border rounded-lg overflow-hidden">
            <h3 className="font-semibold p-4 bg-muted">Date Range Preview</h3>
            <div className="p-4 overflow-x-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2 min-w-[600px]">
                {dateRanges.map((range, index) => (
                  <div
                    key={index}
                    className={cn(
                      "p-2 rounded text-sm",
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
                    <div className="text-xs">
                      {format(range.start, "MMM d, yyyy")} - {format(range.end, "MMM d, yyyy")}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {dateRanges.length > 0 && (
            <div className="space-y-4 border rounded-lg overflow-hidden">
              <div className="p-4 overflow-x-auto">
                <BatchProgressVisualizer
                  dateRanges={dateRanges}
                  currentStatus={form.getValues('status')}
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto">
            <FormField
              control={form.control}
              name="template"
              render={({ field }) => (
                <FormItem className="col-span-1 md:col-span-2">
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

            <div className="col-span-1 md:col-span-2 flex justify-end">
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
            </div>

            <div className="space-y-4 col-span-1">
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
            </div>

            <div className="space-y-4 col-span-1">
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
            </div>

            <div className="space-y-4 col-span-1">
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
            </div>

            <div className="space-y-4 col-span-1">
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
                              let current = new Date(range.start);
                              const end = new Date(range.end);
                              while (current <= end) {
                                dates.push(new Date(current));
                                current = addDays(current, 1);
                              }
                              return dates;
                            })
                          }}
                          modifiersClassNames={{
                            highlighted: (date) => getDateRangeClassName(new Date(date))
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
            </div>

            <div className="col-span-1 md:col-span-2">
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
                        placeholder="Enter capacity limit"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 left-0 right-0 p-4 bg-background border-t mt-auto flex justify-end">
          <Button
            type="submit"
            size="lg"
            disabled={
              createBatchMutation.isPending ||
              isCreating ||
              isLoadingLocations ||
              isLoadingLobs ||
              isLoadingProcesses ||
              isLoadingTrainers ||
              isLoadingTemplates
            }
          >
            {createBatchMutation.isPending ? "Creating..." : "Create Batch"}
          </Button>
        </div>
      </form>
    </Form>
  );
}