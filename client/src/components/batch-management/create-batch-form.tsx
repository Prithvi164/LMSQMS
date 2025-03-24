import { useState, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, addDays, isSunday, isWithinInterval, isSameDay } from "date-fns";
import { getAllSubordinates, getReportingChainUsers } from "@/lib/hierarchy-utils";
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
import { insertOrganizationBatchSchema, type InsertOrganizationBatch, insertBatchTemplateSchema, type InsertBatchTemplate, type BatchTemplate, type OrganizationBatch } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { TrainerInsights } from "./trainer-insights";


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
  { value: 'upskill', label: 'Upskill' }
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

  // Get all processes for the org
  const {
    data: allProcesses = [],
    isLoading: isLoadingAllProcesses
  } = useQuery({
    queryKey: [`/api/organizations/${user?.organizationId}/processes`],
    enabled: !!user?.organizationId
  });
  
  // Get trainer's processes
  const {
    data: trainerProcesses = [],
    isLoading: isLoadingTrainerProcesses
  } = useQuery({
    queryKey: [`/api/users/${form.getValues('trainerId')}/processes`],
    enabled: !!form.getValues('trainerId') && !!user?.organizationId,
  });
  
  // Filter processes to show only those assigned to the selected trainer
  const processes = useMemo(() => {
    const trainerId = form.getValues('trainerId');
    
    if (!trainerId) {
      return [];
    }
    
    // Get process details by joining trainer processes with all processes
    const trainerProcessIds = trainerProcesses.map(p => p.processId);
    console.log('Trainer process IDs:', trainerProcessIds);
    console.log('All processes:', allProcesses);
    
    const trainerProcessesWithDetails = allProcesses.filter(process => 
      trainerProcessIds.includes(process.id)
    );
    
    console.log('Trainer processes with details:', trainerProcessesWithDetails);
    return trainerProcessesWithDetails;
    
  }, [allProcesses, trainerProcesses, form.getValues('trainerId')]);

  // Get the selected trainer's location
  const selectedTrainerLocation = useMemo(() => {
    const trainerId = form.getValues('trainerId');
    if (!trainerId || !allUsers.length) return null;
    
    const trainer = allUsers.find(user => user.id === trainerId);
    if (trainer && trainer.locationId) {
      return locations.find(loc => loc.id === trainer.locationId) || null;
    }
    return null;
  }, [form.getValues('trainerId'), allUsers, locations]);

  // Get the selected process's line of business
  const selectedProcessLineOfBusiness = useMemo(() => {
    const processId = form.getValues('processId');
    if (!processId || !allProcesses.length) return null;
    
    const process = allProcesses.find(p => p.id === processId);
    if (process && process.lineOfBusinessId) {
      return lobs.find(lob => lob.id === process.lineOfBusinessId) || null;
    }
    return null;
  }, [form.getValues('processId'), allProcesses, lobs]);
  
  const isLoadingProcesses = isLoadingAllProcesses || isLoadingTrainerProcesses;

  const {
    data: allUsers = [],
    isLoading: isLoadingAllUsers
  } = useQuery({
    queryKey: [`/api/organizations/${user?.organizationId}/users`],
    enabled: !!user?.organizationId
  });
  
  // Compute trainers from the reporting hierarchy
  const trainers = useMemo(() => {
    if (!allUsers.length || !user) return [];
    
    // DEBUG: Log all users with their location info
    console.log('All users location info:', allUsers.map(u => ({
      id: u.id, 
      name: u.fullName, 
      role: u.role,
      locationId: u.locationId,
      selected: selectedLocation
    })));
    
    // Handle special roles (admin and owner) - they can see all trainers
    if (user.role === 'owner' || user.role === 'admin') {
      return allUsers.filter(u => 
        u.role === 'trainer' && 
        (!selectedLocation || u.locationId === selectedLocation)
      );
    }
    
    // For other roles, get all users who report to the current user (direct or indirect)
    const subordinates = getAllSubordinates(user.id, allUsers);
    
    // Include the current user in the list if they are a trainer
    const eligibleUsers = user.role === 'trainer' ? [user] : [];
    
    // Add all subordinates with trainer role
    const trainersInHierarchy = [
      ...eligibleUsers,
      ...subordinates.filter(u => u.role === 'trainer')
    ];
    
    // Log trainer info for debugging
    console.log('Current user:', user?.id, user?.username, user?.role, 'location:', user?.locationId);
    console.log('Subordinates:', subordinates.map(u => ({ id: u.id, name: u.fullName, role: u.role, locationId: u.locationId })));
    console.log('Trainer subordinates:', subordinates.filter(u => u.role === 'trainer')
      .map(u => ({ id: u.id, name: u.fullName, locationId: u.locationId })));
    console.log('Selected location:', selectedLocation);
    
    // Filter trainers for the selected location - this is important!
    // This ensures we only see trainers that are assigned to the location we're creating the batch for
    const locationFilteredTrainers = trainersInHierarchy.filter(u => 
      !selectedLocation || u.locationId === selectedLocation
    );
    
    console.log('Final trainers after location filter:', locationFilteredTrainers
      .map(u => ({ id: u.id, name: u.fullName, location: u.locationId }))
    );
    
    return locationFilteredTrainers;
  }, [allUsers, user, selectedLocation]);
  
  const isLoadingTrainers = isLoadingAllUsers;

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

  // Update the date calculation functions with new logic for phase transitions
  const addWorkingDays = (startDate: Date, days: number, isEndDate: boolean = false): Date => {
    try {
      // For 0 days, return the start date as is
      if (days === 0) {
        console.log(`Zero days calculation for ${format(startDate, 'yyyy-MM-dd')}`);
        return startDate;
      }

      let currentDate = startDate;
      // For end date calculation when days > 0, subtract 1 from days
      let daysToAdd = isEndDate ? days - 1 : days;
      let remainingDays = daysToAdd;

      console.log(`Adding ${daysToAdd} working days to ${format(startDate, 'yyyy-MM-dd')}`);

      while (remainingDays > 0) {
        currentDate = addDays(currentDate, 1);
        // Skip Sundays when counting working days
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

  // Update the date ranges visualization
  const getDateRangeClassName = (date: Date): string => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const ranges = dateRanges.filter(r =>
      dateStr >= format(r.start, 'yyyy-MM-dd') &&
      dateStr <= format(r.end, 'yyyy-MM-dd')
    );

    if (ranges.length === 0) return '';

    // Multiple phases on same day - use gradient
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
      // Special styling for zero-day phases to make them more visible
      {
        'border-2 border-dashed border-gray-400': isSameDay(range.start, range.end)
      }
    );
  };

  // Initialize state based on batchData if in edit mode
  useEffect(() => {
    if (editMode && batchData) {
      setSelectedLocation(batchData.locationId);
      setSelectedLob(batchData.lineOfBusinessId);
    }
  }, [editMode, batchData]);
  
  // Auto-select location based on trainer selection
  useEffect(() => {
    const trainerId = form.getValues('trainerId');
    if (trainerId && allUsers.length) {
      const trainer = allUsers.find(user => user.id === trainerId);
      if (trainer && trainer.locationId) {
        console.log('Auto-selecting location based on trainer:', trainer.fullName, 'Location ID:', trainer.locationId);
        setSelectedLocation(trainer.locationId);
        form.setValue('locationId', trainer.locationId);
      }
    }
  }, [form.getValues('trainerId'), allUsers]);
  
  // Auto-select line of business based on process selection
  useEffect(() => {
    const processId = form.getValues('processId');
    if (processId && allProcesses.length) {
      const process = allProcesses.find(p => p.id === processId);
      if (process && process.lineOfBusinessId) {
        console.log('Auto-selecting line of business based on process:', process.name, 'LOB ID:', process.lineOfBusinessId);
        setSelectedLob(process.lineOfBusinessId);
        form.setValue('lineOfBusinessId', process.lineOfBusinessId);
      }
    }
  }, [form.getValues('processId'), allProcesses]);

  // Update the useEffect for date calculations with proper error handling
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

      // Induction Phase
      form.setValue('inductionStartDate', format(startDate, 'yyyy-MM-dd'));
      const inductionEnd = process.inductionDays === 0 ? startDate :
        addWorkingDays(startDate, process.inductionDays, true);
      form.setValue('inductionEndDate', format(inductionEnd, 'yyyy-MM-dd'));

      // Training Phase
      const trainingStart = process.inductionDays === 0 ? inductionEnd :
        addWorkingDays(inductionEnd, 1);
      const trainingEnd = process.trainingDays === 0 ? trainingStart :
        addWorkingDays(trainingStart, process.trainingDays, true);
      form.setValue('trainingStartDate', format(trainingStart, 'yyyy-MM-dd'));
      form.setValue('trainingEndDate', format(trainingEnd, 'yyyy-MM-dd'));

      // Certification Phase
      const certificationStart = process.trainingDays === 0 ? trainingEnd :
        addWorkingDays(trainingEnd, 1);
      const certificationEnd = process.certificationDays === 0 ? certificationStart :
        addWorkingDays(certificationStart, process.certificationDays, true);
      form.setValue('certificationStartDate', format(certificationStart, 'yyyy-MM-dd'));
      form.setValue('certificationEndDate', format(certificationEnd, 'yyyy-MM-dd'));

      // OJT Phase
      const ojtStart = process.certificationDays === 0 ? certificationEnd :
        addWorkingDays(certificationEnd, 1);
      const ojtEnd = process.ojtDays === 0 ? ojtStart :
        addWorkingDays(ojtStart, process.ojtDays, true);
      form.setValue('ojtStartDate', format(ojtStart, 'yyyy-MM-dd'));
      form.setValue('ojtEndDate', format(ojtEnd, 'yyyy-MM-dd'));

      // OJT Certification Phase
      const ojtCertificationStart = process.ojtDays === 0 ? ojtEnd :
        addWorkingDays(ojtEnd, 1);
      const ojtCertificationEnd = process.ojtCertificationDays === 0 ? ojtCertificationStart :
        addWorkingDays(ojtCertificationStart, process.ojtCertificationDays, true);
      form.setValue('ojtCertificationStartDate', format(ojtCertificationStart, 'yyyy-MM-dd'));
      form.setValue('ojtCertificationEndDate', format(ojtCertificationEnd, 'yyyy-MM-dd'));

      // Handover and Batch End Date
      const handoverToOps = process.ojtCertificationDays === 0 ? ojtCertificationEnd :
        addWorkingDays(ojtCertificationEnd, 1);
      form.setValue('handoverToOpsDate', format(handoverToOps, 'yyyy-MM-dd'));
      form.setValue('endDate', format(handoverToOps, 'yyyy-MM-dd'));

      // Log final calculated dates
      console.log('Final calculated dates:', {
        induction: { start: startDate, end: inductionEnd, days: process.inductionDays },
        training: { start: trainingStart, end: trainingEnd, days: process.trainingDays },
        certification: { start: certificationStart, end: certificationEnd, days: process.certificationDays },
        ojt: { start: ojtStart, end: ojtEnd, days: process.ojtDays },
        ojtCertification: { start: ojtCertificationStart, end: ojtCertificationEnd, days: process.ojtCertificationDays },
        handover: handoverToOps
      });

      // Update date ranges for calendar visualization
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

  // Update the date range preview section with correct formatting
  const DateRangePreview = () => (
    <div className="mt-4">
      <h3 className="text-lg font-semibold mb-2">Date Range Preview</h3>
      <div className="space-y-2">
        {dateRanges.map((range, index) => {
          const process = processes.find(p => p.id === form.getValues('processId'));
          const isZeroDayPhase = process && (
            (range.status === 'induction' && process.inductionDays === 0) ||
            (range.status === 'training' && process.trainingDays === 0) ||
            (range.status === 'certification' && process.certificationDays === 0) ||
            (range.status === 'ojt' && process.ojtDays === 0) ||
            (range.status === 'ojt-certification' && process.ojtCertificationDays === 0)
          );

          return (
            <div
              key={index}
              className={cn(
                "p-3 rounded-lg",
                "border-2 border-dashed border-gray-400",
                getDateRangeClassName(range.start),
                "flex items-center justify-between"
              )}
            >
              <div className="flex items-center">
                <span className="font-medium">{range.label}</span>
                {isZeroDayPhase && (
                  <span className="ml-2 text-sm text-gray-500 italic">
                    (Zero-day phase)
                  </span>
                )}
              </div>
              <div className="text-sm">
                {format(range.start, 'MMM d, yyyy')}
                {' - '}
                {format(range.end, 'MMM d, yyyy')}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

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
            name="trainerId"
            render={({ field }) => {
              const [searchTerm, setSearchTerm] = useState("");
              const filteredTrainers = trainers.filter(trainer => 
                trainer.fullName.toLowerCase().includes(searchTerm.toLowerCase())
              );
              
              return (
                <FormItem>
                  <div className="flex justify-between items-center">
                    <FormLabel>Trainer</FormLabel>
                    {field.value && <TrainerInsights trainerId={field.value} />}
                  </div>
                  <Select
                    onValueChange={(trainerId) => {
                      const id = parseInt(trainerId);
                      if (!isNaN(id)) {
                        field.onChange(id);
                        
                        // Reset the process selection to force the user to select a process from this trainer
                        form.setValue('processId', undefined);
                        
                        // If there's only one process available for this trainer, auto-select it
                        setTimeout(() => {
                          const availableProcesses = processes;
                          if (availableProcesses.length === 1) {
                            console.log('Auto-selecting the only available process:', availableProcesses[0]);
                            form.setValue('processId', availableProcesses[0].id);
                          }
                        }, 100);
                      }
                    }}
                    value={field.value?.toString()}
                    disabled={isLoadingTrainers}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select trainer" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="max-h-[300px]">
                      <div className="px-2 py-2 sticky top-0 bg-background z-10">
                        <Input 
                          placeholder="Search trainers..." 
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="mb-1"
                        />
                      </div>
                      <div className="max-h-[250px] overflow-y-auto">
                        {filteredTrainers.length > 0 ? (
                          filteredTrainers.map((trainer) => (
                            <SelectItem key={trainer.id} value={trainer.id.toString()}>
                              {trainer.fullName}
                            </SelectItem>
                          ))
                        ) : (
                          <div className="px-2 py-4 text-center text-muted-foreground">
                            No trainers found
                          </div>
                        )}
                      </div>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              );
            }}
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
                    
                    // After process selection, we could auto-select location and LOB based on trainer's info
                    // This would need to be implemented based on your data structure
                  }}
                  value={field.value?.toString()}
                  disabled={!form.getValues('trainerId') || isLoadingProcesses}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder={form.getValues('trainerId') ? "Select process" : "Select Trainer first"} />
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
            name="locationId"
            render={({ field }) => {
              // Find the selected location name
              const locationName = selectedTrainerLocation ? 
                selectedTrainerLocation.name : 
                locations.find(loc => loc.id === field.value)?.name || '';
              
              return (
                <FormItem>
                  <FormLabel>Location</FormLabel>
                  {selectedTrainerLocation ? (
                    // Show as read-only when auto-selected from trainer
                    <div className="flex items-center space-x-2">
                      <FormControl>
                        <Input 
                          value={locationName}
                          readOnly 
                          className="bg-muted cursor-not-allowed"
                        />
                      </FormControl>
                      <Badge variant="outline" className="bg-muted-foreground/20">
                        Auto-selected
                      </Badge>
                    </div>
                  ) : (
                    // Show as dropdown when not auto-selected
                    <Select
                      onValueChange={(value) => {
                        const locationId = parseInt(value);
                        field.onChange(locationId);
                        setSelectedLocation(locationId);
                        setSelectedLob(null);
                        
                        // We'd no longer reset Process and Trainer since they're selected first
                        form.setValue('lineOfBusinessId', undefined);
                      }}
                      value={field.value?.toString()}
                      disabled={isLoadingLocations || !form.getValues('processId')}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={form.getValues('processId') ? "Auto-selected location" : "Select Process first"} />
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
                  )}
                  <FormMessage />
                </FormItem>
              );
            }}
          />

          <FormField
            control={form.control}
            name="lineOfBusinessId"
            render={({ field }) => {
              // Find the selected LOB's name if it exists
              const lobName = selectedProcessLineOfBusiness ? 
                selectedProcessLineOfBusiness.name : 
                lobs.find(lob => lob.id === field.value)?.name || '';
              
              return (
                <FormItem>
                  <FormLabel>Line of Business</FormLabel>
                  {selectedProcessLineOfBusiness ? (
                    // Show as read-only when auto-selected from process
                    <div className="flex items-center space-x-2">
                      <FormControl>
                        <Input 
                          value={lobName}
                          readOnly 
                          className="bg-muted cursor-not-allowed"
                        />
                      </FormControl>
                      <Badge variant="outline" className="bg-muted-foreground/20">
                        Auto-selected
                      </Badge>
                    </div>
                  ) : (
                    // Show as dropdown when not auto-selected
                    <Select
                      onValueChange={(value) => {
                        const lobId = parseInt(value);
                        field.onChange(lobId);
                        setSelectedLob(lobId);
                      }}
                      value={field.value?.toString()}
                      disabled={!selectedLocation || isLoadingLobs || !form.getValues('processId')}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={form.getValues('processId') ? "Auto-selected LOB" : "Select Process first"} />
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
                  )}
                  <FormMessage />
                </FormItem>
              );
            }}
          />

          <FormField
            control={form.control}
            name="capacityLimit"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Capacity</FormLabel>
                <Input
                  type="number"
                  min={1}
                  {...field}
                  onChange={(e) => {
                    const value = parseInt(e.target.value);
                    field.onChange(isNaN(value) ? 1 : Math.max(1, value));
                  }}
                />
                <FormMessage />
              </FormItem>
            )}
          />

        </div>

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
                          "w-full pl-3 text-left font-normal",
                          !field.value && "text-muted-foreground"
                        )}
                      >
                        {field.value ? (
                          format(new Date(field.value), "PPP")
                        ) : (
                          <span>Pick a date</span>
                        )}
                        <CalendarIcon className="ml-auto h-4 w4 opacity-50" />
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={field.value ? new Date(field.value) : undefined}
                      onSelect={(date) => {
                        field.onChange(date ? format(date, 'yyyy-MM-dd') : '');
                      }}
                      disabled={(date) =>
                        date < new Date() || isSunday(date)
                      }
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

          <DateRangePreview />
        

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