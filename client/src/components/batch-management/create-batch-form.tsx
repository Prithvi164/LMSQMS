import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, addDays, isSunday, isWithinInterval, isSameDay, eachDayOfInterval } from "date-fns";
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
import { insertOrganizationBatchSchema, type InsertOrganizationBatch, insertBatchTemplateSchema, type InsertBatchTemplate, type BatchTemplate, type OrganizationBatch, type User } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";

// Interface for date range
interface DateRange {
  start: Date;
  end: Date;
  label: string;
  status: 'induction' | 'training' | 'certification' | 'ojt' | 'ojt-certification';
}

// Update CreateBatchFormProps interface
interface CreateBatchFormProps {
  editMode?: boolean;
  batchData?: OrganizationBatch;
  onSuccess?: () => void;
}

// Add this type definition near other interfaces
interface TrainerConflict {
  batchName: string;
  startDate: Date;
  endDate: Date;
}

// Add this near the top where other fields are defined
const batchCategories = [
  { value: 'new_training', label: 'New Training' },
  { value: 'upskill', label: 'Upskill' }
] as const;

// Function to determine batch status based on current date and phase dates
const determineBatchStatus = (batch: InsertOrganizationBatch): "planned" | "induction" | "training" | "certification" | "ojt" | "ojt_certification" | "completed" => {
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
  } else if (dates.trainingEnd && dates.trainingStart && isWithinInterval(today, { start: dates.trainingStart, end: dates.trainingEnd })) {
    return 'training';
  } else if (dates.certificationEnd && dates.certificationStart && isWithinInterval(today, { start: dates.certificationStart, end: dates.certificationEnd })) {
    return 'certification';
  } else if (dates.ojtEnd && dates.ojtStart && isWithinInterval(today, { start: dates.ojtStart, end: dates.ojtEnd })) {
    return 'ojt';
  } else if (dates.ojtCertificationEnd && dates.ojtCertificationStart && isWithinInterval(today, { start: dates.ojtCertificationStart, end: dates.ojtCertificationEnd })) {
    return 'ojt_certification';
  } else if (dates.handoverToOps && today >= dates.handoverToOps) {
    return 'completed';
  }

  return 'planned'; // Default status
};

// Add this function before the CreateBatchForm component
const checkTrainerAvailability = (
  trainerId: number,
  startDate: string,
  endDate: string,
  existingBatches: OrganizationBatch[]
): TrainerConflict[] => {
  if (!trainerId || !startDate || !endDate) return [];

  const requestedInterval = {
    start: new Date(startDate),
    end: new Date(endDate)
  };

  return existingBatches
    .filter(batch =>
      batch.trainerId === trainerId &&
      batch.startDate &&
      batch.endDate
    )
    .map(batch => ({
      batchName: batch.name,
      startDate: new Date(batch.startDate),
      endDate: new Date(batch.endDate)
    }))
    .filter(batch => {
      const batchDays = eachDayOfInterval({
        start: batch.startDate,
        end: batch.endDate
      });

      const requestedDays = eachDayOfInterval(requestedInterval);

      return batchDays.some(day =>
        requestedDays.some(reqDay =>
          isSameDay(day, reqDay)
        )
      );
    });
};

// Date Range Preview Component
const DateRangePreview: React.FC<{ dateRanges: DateRange[], trainerConflicts: TrainerConflict[] }> = ({ dateRanges, trainerConflicts }) => (
  <div className="mt-4">
    <h3 className="text-lg font-semibold mb-2">Date Range Preview</h3>
    <div className="space-y-2">
      {dateRanges.map((range, index) => (
        <div
          key={index}
          className={cn(
            "p-3 rounded-lg",
            "border-2 border-dashed border-gray-400",
            {
              'bg-blue-200': range.status === 'induction',
              'bg-green-200': range.status === 'training',
              'bg-yellow-200': range.status === 'certification',
              'bg-purple-200': range.status === 'ojt',
              'bg-pink-200': range.status === 'ojt-certification',
            }
          )}
        >
          <div className="flex items-center justify-between">
            <span className="font-medium">{range.label}</span>
            <div className="text-sm">
              {format(range.start, 'MMM d, yyyy')}
              {' - '}
              {format(range.end, 'MMM d, yyyy')}
            </div>
          </div>
          {trainerConflicts.length > 0 && (
            trainerConflicts.map((conflict) => {
              const hasConflict = isWithinInterval(range.start, { start: conflict.startDate, end: conflict.endDate }) ||
                isWithinInterval(range.end, { start: conflict.startDate, end: conflict.endDate });

              if (hasConflict) {
                return (
                  <div
                    key={`${range.label}-conflict`}
                    className="border-2 border-red-500 p-2 mt-2 rounded text-sm text-red-600"
                  >
                    Warning: Trainer has conflicting assignments during {range.label} phase
                  </div>
                );
              }
              return null;
            })
          )}
        </div>
      ))}
    </div>
  </div>
);

// Trainer Conflicts Preview Component
const TrainerConflictsPreview: React.FC<{ trainerConflicts: TrainerConflict[] }> = ({ trainerConflicts }) => {
  if (!trainerConflicts.length) return null;

  return (
    <div className="mt-4 p-4 border-2 border-red-200 rounded-lg bg-red-50">
      <h3 className="text-lg font-semibold text-red-700 mb-2">
        ⚠️ Trainer Schedule Conflicts
      </h3>
      <div className="space-y-2">
        {trainerConflicts.map((conflict, index) => (
          <div key={index} className="text-sm text-red-600">
            Conflict with batch "{conflict.batchName}":
            <br />
            {format(conflict.startDate, 'MMM d, yyyy')} - {format(conflict.endDate, 'MMM d, yyyy')}
          </div>
        ))}
      </div>
    </div>
  );
};

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
  const [trainerConflicts, setTrainerConflicts] = useState<TrainerConflict[]>([]);

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
      organizationId: user?.organizationId || undefined,
      locationId: batchData.locationId,
      lineOfBusinessId: batchData.lineOfBusinessId,
      processId: batchData.processId,
      trainerId: batchData.trainerId,
      capacityLimit: batchData.capacityLimit,
      batchCategory: batchData.batchCategory,
      status: batchData.status
    } : {
      status: 'planned',
      organizationId: user?.organizationId || undefined,
      startDate: '',
      endDate: '',
      inductionStartDate: '',
      capacityLimit: 1,
      name: '',
      batchCategory: 'new_training'
    },
  });

  const {
    data: templates = [],
    isLoading: isLoadingTemplates
  } = useQuery<BatchTemplate[]>({
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
  } = useQuery<User[]>({
    queryKey: [`/api/organizations/${user?.organizationId}/users`],
    enabled: !!user?.organizationId,
    select: (users: User[]) => users.filter(user => 
      user.role === 'trainer' && (!selectedLocation || user.locationId === selectedLocation)
    )
  });

  const { data: existingBatches = [] } = useQuery<OrganizationBatch[]>({
    queryKey: [`/api/organizations/${user?.organizationId}/batches`],
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

  const addWorkingDays = (startDate: Date, days: number, isEndDate: boolean = false): Date => {
    try {
      if (days === 0) {
        console.log(`Zero days calculation for ${format(startDate, 'yyyy-MM-dd')}`);
        return startDate;
      }

      let currentDate = startDate;
      let daysToAdd = isEndDate ? days - 1 : days;
      let remainingDays = daysToAdd;

      console.log(`Adding ${daysToAdd} working days to ${format(startDate, 'yyyy-MM-dd')}`);

      while (remainingDays > 0) {
        currentDate = addDays(currentDate, 1);
        if (!isSunday(currentDate)) {
          remainingDays--;
        }
      }

      console.log(`Result date: ${format(currentDate, 'yyyy-MM-dd')}`);
      return currentDate;
    } catch (error) {
      console.error('Error in addWorkingDays:', error);
      throw error;
    }
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

  useEffect(() => {
    const trainerId = form.getValues('trainerId');
    const startDate = form.getValues('startDate');
    const endDate = form.getValues('endDate');

    if (trainerId && startDate && endDate) {
      const conflicts = checkTrainerAvailability(
        trainerId,
        startDate,
        endDate,
        existingBatches
      );
      setTrainerConflicts(conflicts);
    }
  }, [form.watch('trainerId'), form.watch('startDate'), form.watch('endDate'), existingBatches]);


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


      if (trainerConflicts.length > 0) {
        throw new Error('Cannot create batch: Trainer has scheduling conflicts');
      }

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
    const ranges = dateRanges.filter(r =>
      dateStr >= format(r.start, 'yyyy-MM-dd') &&
      dateStr <= format(r.end, 'yyyy-MM-dd')
    );

    if (ranges.length === 0) return '';

    if (ranges.length > 1) {
      return cn(
        'bg-gradient-to-r',
        'from-blue-200 via-green-200 to-yellow-200',
        'border-2 border-dashed border-gray-400',
        'rounded-sm',
        'bg-opacity-50'
      );
    }

    const range = ranges[0];
    return cn(
      'bg-opacity-50',
      'rounded-sm',
      {
        'bg-blue-200': range.status === 'induction',
        'bg-green-200': range.status === 'training',
        'bg-yellow-200': range.status === 'certification',
        'bg-purple-200': range.status === 'ojt',
        'bg-pink-200': range.status === 'ojt-certification',
      },
      {
        'border-2 border-dashed border-gray-400': isSameDay(range.start, range.end)
      }
    );
  };

  useEffect(() => {
    if (editMode && batchData) {
      setSelectedLocation(batchData.locationId);
      setSelectedLob(batchData.lineOfBusinessId);
    }
  }, [editMode, batchData]);

  useEffect(() => {
    const process = processes.find(p => p.id === form.getValues('processId'));
    const startDateStr = form.getValues('startDate');

    if (!process || !startDateStr) {
      console.log('No process or start date selected yet');
      return;
    }

    try {
      console.log('Starting date calculations with process:', {
        processId: process.id,
        startDate: startDateStr,
        phases: {
          induction: process.inductionDays,
          training: process.trainingDays,
          certification: process.certificationDays,
          ojt: process.ojtDays,
          ojtCertification: process.ojtCertificationDays
        }
      });

      const startDate = new Date(startDateStr);

      form.setValue('inductionStartDate', format(startDate, 'yyyy-MM-dd'));
      const inductionEnd = process.inductionDays === 0 ? startDate :
        addWorkingDays(startDate, process.inductionDays, true);
      form.setValue('inductionEndDate', format(inductionEnd, 'yyyy-MM-dd'));

      const trainingStart = process.inductionDays === 0 ? inductionEnd :
        addWorkingDays(inductionEnd, 1);
      const trainingEnd = process.trainingDays === 0 ? trainingStart :
        addWorkingDays(trainingStart, process.trainingDays, true);
      form.setValue('trainingStartDate', format(trainingStart, 'yyyy-MM-dd'));
      form.setValue('trainingEndDate', format(trainingEnd, 'yyyy-MM-dd'));

      const certificationStart = process.trainingDays === 0 ? trainingEnd :
        addWorkingDays(trainingEnd, 1);
      const certificationEnd = process.certificationDays === 0 ? certificationStart :
        addWorkingDays(certificationStart, process.certificationDays, true);
      form.setValue('certificationStartDate', format(certificationStart, 'yyyy-MM-dd'));
      form.setValue('certificationEndDate', format(certificationEnd, 'yyyy-MM-dd'));

      const ojtStart = process.certificationDays === 0 ? certificationEnd :
        addWorkingDays(certificationEnd, 1);
      const ojtEnd = process.ojtDays === 0 ? ojtStart :
        addWorkingDays(ojtStart, process.ojtDays, true);
      form.setValue('ojtStartDate', format(ojtStart, 'yyyy-MM-dd'));
      form.setValue('ojtEndDate', format(ojtEnd, 'yyyy-MM-dd'));

      const ojtCertificationStart = process.ojtDays === 0 ? ojtEnd :
        addWorkingDays(ojtEnd, 1);
      const ojtCertificationEnd = process.ojtCertificationDays === 0 ? ojtCertificationStart :
        addWorkingDays(ojtCertificationStart, process.ojtCertificationDays, true);
      form.setValue('ojtCertificationStartDate', format(ojtCertificationStart, 'yyyy-MM-dd'));
      form.setValue('ojtCertificationEndDate', format(ojtCertificationEnd, 'yyyy-MM-dd'));

      const handoverToOps = process.ojtCertificationDays === 0 ? ojtCertificationEnd :
        addWorkingDays(ojtCertificationEnd, 1);
      form.setValue('handoverToOpsDate', format(handoverToOps, 'yyyy-MM-dd'));
      form.setValue('endDate', format(handoverToOps, 'yyyy-MM-dd'));

      console.log('Final calculated dates:', {
        induction: { start: startDate, end: inductionEnd, days: process.inductionDays },
        training: { start: trainingStart, end: trainingEnd, days: process.trainingDays },
        certification: { start: certificationStart, end: certificationEnd, days: process.certificationDays },
        ojt: { start: ojtStart, end: ojtEnd, days: process.ojtDays },
        ojtCertification: { start: ojtCertificationStart, end: ojtCertificationEnd, days: process.ojtCertificationDays },
        handover: handoverToOps
      });

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

    } catch (error) {
      console.error('Error calculating dates:', error);
      toast({
        title: "Error",
        description: "Failed to calculate batch dates. Please try again.",
        variant: "destructive",
      });
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
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        {isCreating && (
          <div className="space-y-2">
            <Progress value={progress} />
          </div>
        )}

        {!editMode && templates && templates.length > 0 && (
          <div className="mb-6">
            <Select<replit_final_file>
 onValueChange={handleTemplateSelect}>
              <SelectTrigger>
                <SelectValue placeholder="Load from template" />
              </SelectTrigger>
              <SelectContent>
                {templates.map((template) => (
                  <SelectItem key={template.id} value={template.id.toString()}>
                    {template.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

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
          <FormField
            control={form.control}
            name="batchCategory"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Batch Category</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select batch category" />
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
            name="locationId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Location</FormLabel>
                <Select
                  onValueChange={(value) => {
                    setSelectedLocation(parseInt(value));
                    field.onChange(parseInt(value));
                    form.setValue('lineOfBusinessId', undefined);
                    form.setValue('processId', undefined);
                  }}
                  defaultValue={field.value?.toString()}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select location" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {locations.map((location) => (
                      <SelectItem
                        key={location.id}
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
            name="lineOfBusinessId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Line of Business</FormLabel>
                <Select
                  onValueChange={(value) => {
                    setSelectedLob(parseInt(value));
                    field.onChange(parseInt(value));
                    form.setValue('processId', undefined);
                  }}
                  defaultValue={field.value?.toString()}
                  disabled={!selectedLocation}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select line of business" />
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
                  onValueChange={(value) => field.onChange(parseInt(value))}
                  defaultValue={field.value?.toString()}
                  disabled={!selectedLob}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select process" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {processes.map((process) => (
                      <SelectItem
                        key={process.id}
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
                  onValueChange={(value) => field.onChange(parseInt(value))}
                  defaultValue={field.value?.toString()}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select trainer" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {trainers.map((trainer) => (
                      <SelectItem
                        key={trainer.id}
                        value={trainer.id.toString()}
                      >
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
                    onChange={(e) =>
                      field.onChange(parseInt(e.target.value))
                    }
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="startDate"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>Start Date</FormLabel>
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
                      onSelect={(date) =>
                        field.onChange(
                          date ? format(date, "yyyy-MM-dd") : undefined
                        )
                      }
                      disabled={(date) =>
                        date < new Date() || isSunday(date)
                      }
                      modifiers={{
                        conflict: (date) => {
                          if (!trainerConflicts.length) return false;
                          return trainerConflicts.some(conflict =>
                            isWithinInterval(date, {
                              start: conflict.startDate,
                              end: conflict.endDate
                            })
                          );
                        }
                      }}
                      modifiersStyles={{
                        conflict: {
                          backgroundColor: 'rgba(239, 68, 68, 0.1)',
                          color: 'rgb(239, 68, 68)',
                          fontWeight: '500'
                        }
                      }}
                    />
                  </PopoverContent>
                </Popover>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <DateRangePreview dateRanges={dateRanges} trainerConflicts={trainerConflicts} />
        <TrainerConflictsPreview trainerConflicts={trainerConflicts} />

        {!editMode && (
          <Dialog open={isSavingTemplate} onOpenChange={setIsSavingTemplate}>
            <DialogTrigger asChild>
              <Button
                variant="outline"
                className="w-full"
                type="button"
                disabled={!form.getValues('locationId') ||
                  !form.getValues('lineOfBusinessId') ||
                  !form.getValues('processId') ||
                  !form.getValues('trainerId')}
              >
                Save as Template
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Save as Template</DialogTitle>
                <DialogDescription>
                  Create a reusable template from the current batch settings
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <label
                    htmlFor="templateName"
                    className="text-sm font-medium"
                  >
                    Template Name
                  </label>
                  <Input
                    id="templateName"
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    placeholder="Enter template name"
                  />
                </div>
                <div className="space-y-2">
                  <label
                    htmlFor="templateDescription"
                    className="text-sm font-medium"
                  >
                    Description
                  </label>
                  <Input
                    id="templateDescription"
                    value={templateDescription}
                    onChange={(e) =>
                      setTemplateDescription(e.target.value)
                    }
                    placeholder="Enter template description"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setIsSavingTemplate(false)}
                >
                  Cancel
                </Button>
                <Button onClick={handleSaveTemplate}>Save Template</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}

        <div className="flex justify-end space-x-2 pt-4">
          <Button
            variant="outline"
            onClick={() => {
              form.reset();
              if (onSuccess) onSuccess();
            }}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isCreating}>
            {isCreating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {editMode ? "Update" : "Create"} Batch
          </Button>
        </div>
      </form>
    </Form>
  );
}