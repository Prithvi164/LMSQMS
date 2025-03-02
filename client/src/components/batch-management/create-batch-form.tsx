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
import { insertOrganizationBatchSchema, type InsertOrganizationBatch } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";

export function CreateBatchForm() {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedLob, setSelectedLob] = useState<number | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<number | null>(null);
  const [selectedManager, setSelectedManager] = useState<number | null>(null);

  // Fetch LOBs
  const { data: lobs = [] } = useQuery({
    queryKey: [`/api/organizations/${user?.organizationId}/line-of-businesses`],
  });

  // Fetch processes filtered by selected LOB
  const { data: processes = [] } = useQuery({
    queryKey: [`/api/organizations/${user?.organizationId}/processes`, selectedLob],
    enabled: !!selectedLob,
  });

  // Fetch locations
  const { data: locations = [] } = useQuery({
    queryKey: [`/api/organizations/${user?.organizationId}/locations`],
  });

  // Fetch managers based on selected location
  const { data: managers = [] } = useQuery({
    queryKey: [`/api/locations/${selectedLocation}/managers`],
    enabled: !!selectedLocation,
  });

  // Fetch trainers based on selected manager
  const { data: trainers = [] } = useQuery({
    queryKey: [`/api/managers/${selectedManager}/trainers`],
    enabled: !!selectedManager,
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
      setSelectedLob(null);
      setSelectedLocation(null);
      setSelectedManager(null);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to create batch. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: InsertOrganizationBatch) => {
    createBatchMutation.mutate(data);
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
            name="lineOfBusinessId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Line of Business</FormLabel>
                <Select
                  onValueChange={(value) => {
                    field.onChange(parseInt(value));
                    setSelectedLob(parseInt(value));
                  }}
                  value={field.value?.toString()}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select LOB" />
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
                  value={field.value?.toString()}
                  disabled={!selectedLob}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select process" />
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
            render={({ field }) => (
              <FormItem>
                <FormLabel>Location</FormLabel>
                <Select
                  onValueChange={(value) => {
                    const locationId = parseInt(value);
                    field.onChange(locationId);
                    setSelectedLocation(locationId);
                    setSelectedManager(null); // Reset manager when location changes
                    form.setValue('trainerId', undefined); // Reset trainer when location changes
                  }}
                  value={field.value?.toString()}
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

          {/* Manager Selection - Always visible but disabled until location is selected */}
          <FormField
            control={form.control}
            name="managerId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Manager</FormLabel>
                <Select
                  onValueChange={(value) => {
                    const managerId = parseInt(value);
                    setSelectedManager(managerId);
                    form.setValue('trainerId', undefined); // Reset trainer when manager changes
                  }}
                  value={selectedManager?.toString()}
                  disabled={!selectedLocation}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select manager" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {managers.map((manager) => (
                      <SelectItem key={manager.id} value={manager.id.toString()}>
                        {manager.fullName}
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
                  value={field.value?.toString()}
                  disabled={!selectedManager}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select trainer" />
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
            Create Batch
          </Button>
        </div>
      </form>
    </Form>
  );
}