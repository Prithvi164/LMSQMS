import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { Loader2, CalendarIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { TrainerInsights } from "./trainer-insights";
import { format, addDays, isSunday } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

// Trainer field rendering component for cleaner code
const TrainerField = ({ form, trainers = [], isLoadingTrainers = false }) => (
  <FormField
    control={form.control}
    name="trainerId"
    render={({ field }) => (
      <FormItem>
        <div className="flex justify-between items-center mb-2">
          <FormLabel className="flex-none">Trainer</FormLabel>
          {field.value && (
            <div className="flex-none ml-2">
              <TrainerInsights trainerId={parseInt(field.value.toString())} />
            </div>
          )}
        </div>
        <Select
          onValueChange={(value) => {
            const trainerId = parseInt(value);
            field.onChange(trainerId);
          }}
          value={field.value?.toString()}
          disabled={isLoadingTrainers}
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
                {trainer.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <FormMessage />
      </FormItem>
    )}
  />
);

// Main form component
export function CreateBatchForm({ editMode = false, batchData, onSuccess }: CreateBatchFormProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dateRanges, setDateRanges] = useState([]);
  const [templateName, setTemplateName] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');
  const [selectedLocation, setSelectedLocation] = useState<number | null>(null);
  const [selectedLob, setSelectedLob] = useState<number | null>(null);

  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Form setup
  const form = useForm({
    resolver: zodResolver(batchSchema),
    defaultValues: batchData || {},
  });

  // Data fetching queries
  const { data: locations = [], isLoading: isLoadingLocations } = useQuery({
    queryKey: ['locations'],
    queryFn: async () => {
      const response = await fetch('/api/locations');
      if (!response.ok) throw new Error('Failed to fetch locations');
      return response.json();
    },
  });

  const { data: lobs = [], isLoading: isLoadingLobs } = useQuery({
    queryKey: ['lobs', selectedLocation],
    queryFn: () => selectedLocation ? getLobs(selectedLocation) : [],
    enabled: !!selectedLocation,
  });

  const { data: processes = [], isLoading: isLoadingProcesses } = useQuery({
    queryKey: ['processes', selectedLob],
    queryFn: () => selectedLob ? getProcesses(selectedLob) : [],
    enabled: !!selectedLob,
  });

  const { data: trainers = [], isLoading: isLoadingTrainers } = useQuery({
    queryKey: ['trainers'],
    queryFn: async () => {
      const response = await fetch('/api/trainers');
      if (!response.ok) throw new Error('Failed to fetch trainers');
      return response.json();
    },
  });

  const { data: templates = [], isLoading: isLoadingTemplates } = useQuery({
    queryKey: ['templates'],
    queryFn: () => getTemplates(),
  });


  const [createBatchMutation, { error: createBatchError }] = useMutation({
    mutationFn: (data: any) => createBatch(data),
    onSuccess: () => {
      toast({
        title: "Batch created successfully!",
        description: "The new batch has been created.",
      });
      queryClient.invalidateQueries({ queryKey: ['batches'] });
      onSuccess();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to create batch. Please try again.",
        variant: "destructive",
      });
    },
  });

  const [updateBatchMutation, { error: updateBatchError }] = useMutation({
    mutationFn: (data: any) => updateBatch(data),
    onSuccess: () => {
      toast({
        title: "Batch updated successfully!",
        description: "The batch has been updated.",
      });
      queryClient.invalidateQueries({ queryKey: ['batches'] });
      onSuccess();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update batch. Please try again.",
        variant: "destructive",
      });
    },
  });

  const [saveTemplateMutation] = useMutation({
    mutationFn: (data: any) => saveTemplate(data),
    onSuccess: () => {
      toast({
        title: "Template saved successfully!",
        description: "The template has been saved.",
      });
      queryClient.invalidateQueries({ queryKey: ['templates'] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to save template. Please try again.",
        variant: "destructive",
      });
    },
  });

  const batchCategories = [
    { value: 'Category A', label: 'Category A' },
    { value: 'Category B', label: 'Category B' },
    // Add more categories as needed
  ];

  const onSubmit = async (data: any) => {
    setIsCreating(true);
    try {
      const startDate = new Date(data.startDate);
      const process = processes.find(p => p.id === data.processId);

      const inductionEnd = process?.inductionDays === 0 ? startDate :
        addDays(startDate, process.inductionDays);
      setValue('inductionEndDate', format(inductionEnd, 'yyyy-MM-dd'));

      const trainingStart = process?.inductionDays === 0 ? inductionEnd :
        addDays(inductionEnd, 1);
      const trainingEnd = process?.trainingDays === 0 ? trainingStart :
        addDays(trainingStart, process.trainingDays);
      setValue('trainingStartDate', format(trainingStart, 'yyyy-MM-dd'));
      setValue('trainingEndDate', format(trainingEnd, 'yyyy-MM-dd'));

      const certificationStart = process?.trainingDays === 0 ? trainingEnd :
        addDays(trainingEnd, 1);
      const certificationEnd = process?.certificationDays === 0 ? certificationStart :
        addDays(certificationStart, process.certificationDays);
      setValue('certificationStartDate', format(certificationStart, 'yyyy-MM-dd'));
      setValue('certificationEndDate', format(certificationEnd, 'yyyy-MM-dd'));

      const ojtStart = process?.certificationDays === 0 ? certificationEnd :
        addDays(certificationEnd, 1);
      const ojtEnd = process?.ojtDays === 0 ? ojtStart :
        addDays(ojtStart, process.ojtDays);
      setValue('ojtStartDate', format(ojtStart, 'yyyy-MM-dd'));
      setValue('ojtEndDate', format(ojtEnd, 'yyyy-MM-dd'));

      const ojtCertificationStart = process?.ojtDays === 0 ? ojtEnd :
        addDays(ojtEnd, 1);
      const ojtCertificationEnd = process?.ojtCertificationDays === 0 ? ojtCertificationStart :
        addDays(ojtCertificationStart, process.ojtCertificationDays);
      setValue('ojtCertificationStartDate', format(ojtCertificationStart, 'yyyy-MM-dd'));
      setValue('ojtCertificationEndDate', format(ojtCertificationEnd, 'yyyy-MM-dd'));

      const handoverToOps = process?.ojtCertificationDays === 0 ? ojtCertificationEnd :
        addDays(ojtCertificationEnd, 1);
      setValue('handoverToOpsDate', format(handoverToOps, 'yyyy-MM-dd'));
      setValue('endDate', format(handoverToOps, 'yyyy-MM-dd'));

      setDateRanges([
        { start: startDate, end: inductionEnd, label: 'Induction', status: 'induction' },
        { start: trainingStart, end: trainingEnd, label: 'Training', status: 'training' },
        { start: certificationStart, end: certificationEnd, label: 'Certification', status: 'certification' },
        { start: ojtStart, end: ojtEnd, label: 'OJT', status: 'ojt' },
        { start: ojtCertificationStart, end: ojtCertificationEnd, label: 'OJT Certification', status: 'ojt-certification' }
      ]);

      if (editMode) {
        await updateBatchMutation.mutateAsync({ ...data, id: batchData.id });
      } else {
        await createBatchMutation.mutateAsync(data);
      }
    } catch (error) {
      console.error('Error calculating dates:', error);
      toast({
        title: "Error",
        description: "Failed to calculate batch dates. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleTemplateSelect = (id: string) => {
    const selectedTemplate = templates.find(template => template.id === parseInt(id));
    if(selectedTemplate){
        form.reset(selectedTemplate);
        setSelectedLocation(parseInt(selectedTemplate.locationId))
        setSelectedLob(parseInt(selectedTemplate.lineOfBusinessId))
    }
  };

  const handleSaveTemplate = () => {
    saveTemplateMutation.mutateAsync({ name: templateName, description: templateDescription, ...form.getValues() });
  };

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

  const calculateDates = () => {
    //This function remains unchanged.
  };

  const getDateRangeClassName = (date: Date) => {
    //This function remains unchanged.
  };

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

          {/* Trainer field with insights */}
          <TrainerField
            form={form}
            trainers={trainers}
            isLoadingTrainers={isLoadingTrainers}
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

        <div className="mt-8 flex justify-end">
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