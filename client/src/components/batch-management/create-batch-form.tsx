import { useState, useEffect } from "react";
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
import { insertOrganizationBatchSchema, type InsertOrganizationBatch } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { Loader2 } from "lucide-react";

export function CreateBatchForm() {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedLocation, setSelectedLocation] = useState<number | null>(null);
  const [selectedLob, setSelectedLob] = useState<number | null>(null);
  const [selectedProcess, setSelectedProcess] = useState<number | null>(null);

  // Fetch locations
  const { 
    data: locations = [], 
    isLoading: isLoadingLocations,
    error: locationsError
  } = useQuery({
    queryKey: [`/api/organizations/${user?.organizationId}/locations`],
  });

  // Fetch LOBs based on selected location
  const { 
    data: lobs = [], 
    isLoading: isLoadingLobs,
    error: lobsError
  } = useQuery({
    queryKey: [`/api/organizations/${user?.organizationId}/locations/${selectedLocation}/line-of-businesses`],
    enabled: !!selectedLocation && !!user?.organizationId,
    onSuccess: (data) => {
      console.log('[Batch Form] DEBUG: LOBs fetched:', { 
        locationId: selectedLocation,
        organizationId: user?.organizationId,
        data 
      });
      // Reset LOB selection when new LOBs are loaded
      if (selectedLob && !data.some(lob => lob.id === selectedLob)) {
        setSelectedLob(null);
        form.setValue('lineOfBusinessId', undefined);
      }
    },
    onError: (error: any) => {
      console.error('[Batch Form] Error fetching LOBs:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch line of businesses',
        variant: 'destructive',
      });
    }
  });

  // Add debugging logs for LOB changes
  useEffect(() => {
    console.log('[Batch Form] DEBUG: Location/LOB state changed:', { 
      selectedLocation,
      lobsData: lobs,
      organizationId: user?.organizationId
    });
  }, [selectedLocation, lobs, user?.organizationId]);

  // Fetch processes filtered by selected LOB
  const { 
    data: processes = [], 
    isLoading: isLoadingProcesses,
    error: processesError
  } = useQuery({
    queryKey: [`/api/organizations/${user?.organizationId}/line-of-businesses/${selectedLob}/processes`],
    enabled: !!selectedLob,
  });

  // Fetch trainers based on selected location and process
  const { 
    data: trainers = [], 
    isLoading: isLoadingTrainers,
    error: trainersError
  } = useQuery({
    queryKey: [`/api/locations/${selectedLocation}/processes/${selectedProcess}/trainers`],
    enabled: !!(selectedLocation && selectedProcess),
  });

  const form = useForm<InsertOrganizationBatch>({
    resolver: zodResolver(insertOrganizationBatchSchema),
    defaultValues: {
      status: 'planned',
      organizationId: user?.organizationId,
    },
  });

  const createBatchMutation = useMutation({
    mutationFn: async (data: InsertOrganizationBatch) => {
      return apiRequest(`/api/organizations/${user?.organizationId}/batches`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
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
      setSelectedProcess(null);
    },
    onError: (error) => {
      console.error('Batch creation error:', error);
      toast({
        title: "Error",
        description: "Failed to create batch. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: InsertOrganizationBatch) => {
    console.log('Submitting batch data:', data);
    createBatchMutation.mutate(data);
  };

  // Show error states
  if (locationsError || lobsError || processesError || trainersError) {
    console.error('Form errors:', { locationsError, lobsError, processesError, trainersError });
    // Consider adding UI feedback for errors here.  For example, a message above the form.
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          {/* Batch Code and Name */}
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

          {/* Location Selection */}
          <FormField
            control={form.control}
            name="locationId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Location</FormLabel>
                <Select
                  onValueChange={(value) => {
                    const locationId = parseInt(value);
                    console.log('Location selected:', locationId);
                    field.onChange(locationId);
                    setSelectedLocation(locationId);
                    // Reset dependent fields
                    setSelectedLob(null);
                    setSelectedProcess(null);
                    form.setValue('lineOfBusinessId', undefined);
                    form.setValue('processId', undefined);
                    form.setValue('trainerId', undefined);
                  }}
                  value={field.value?.toString()}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder={isLoadingLocations ? "Loading..." : "Select location"} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {isLoadingLocations ? (
                      <div className="flex items-center justify-center p-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                      </div>
                    ) : (
                      locations.map((location: any) => (
                        <SelectItem key={location.id} value={location.id.toString()}>
                          {location.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* LOB Selection */}
          <FormField
            control={form.control}
            name="lineOfBusinessId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Line of Business</FormLabel>
                <Select
                  onValueChange={(value) => {
                    const lobId = parseInt(value);
                    console.log('[Batch Form] LOB selected:', lobId);
                    field.onChange(lobId);
                    setSelectedLob(lobId);
                    // Reset dependent fields
                    setSelectedProcess(null);
                    form.setValue('processId', undefined);
                    form.setValue('trainerId', undefined);
                  }}
                  value={field.value?.toString()}
                  disabled={!selectedLocation || isLoadingLobs}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue 
                        placeholder={
                          !selectedLocation 
                            ? "Select a location first" 
                            : isLoadingLobs 
                            ? "Loading..." 
                            : "Select LOB"
                        } 
                      />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {isLoadingLobs ? (
                      <div className="flex items-center justify-center p-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                      </div>
                    ) : lobs.length === 0 ? (
                      <div className="flex items-center justify-center p-2 text-sm text-muted-foreground">
                        No LOBs available for this location
                      </div>
                    ) : (
                      lobs.map((lob: any) => (
                        <SelectItem key={lob.id} value={lob.id.toString()}>
                          {lob.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Process Selection */}
          <FormField
            control={form.control}
            name="processId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Process</FormLabel>
                <Select
                  onValueChange={(value) => {
                    const processId = parseInt(value);
                    console.log('Process selected:', processId);
                    field.onChange(processId);
                    setSelectedProcess(processId);
                    form.setValue('trainerId', undefined);
                  }}
                  value={field.value?.toString()}
                  disabled={!selectedLob}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder={!selectedLob ? "Select LOB first" : isLoadingProcesses ? "Loading..." : "Select process"} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {isLoadingProcesses ? (
                      <div className="flex items-center justify-center p-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                      </div>
                    ) : (
                      processes.map((process: any) => (
                        <SelectItem key={process.id} value={process.id.toString()}>
                          {process.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Trainer Selection */}
          <FormField
            control={form.control}
            name="trainerId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Trainer</FormLabel>
                <Select
                  onValueChange={(value) => field.onChange(parseInt(value))}
                  value={field.value?.toString()}
                  disabled={!selectedProcess}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder={!selectedProcess ? "Select process first" : isLoadingTrainers ? "Loading..." : "Select trainer"} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {isLoadingTrainers ? (
                      <div className="flex items-center justify-center p-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                      </div>
                    ) : (
                      trainers.map((trainer: any) => (
                        <SelectItem key={trainer.id} value={trainer.id.toString()}>
                          {trainer.fullName}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Date Selections */}
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
            name="endDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>End Date</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

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
            disabled={createBatchMutation.isPending}
          >
            {createBatchMutation.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Create Batch
          </Button>
        </div>
      </form>
    </Form>
  );
}