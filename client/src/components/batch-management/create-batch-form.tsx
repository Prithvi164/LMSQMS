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
import { insertOrganizationBatchSchema, type InsertOrganizationBatch, type OrganizationProcess, type OrganizationLineOfBusiness, type User } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";

export function CreateBatchForm() {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedLob, setSelectedLob] = useState<number | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<number | null>(null);
  const [selectedTrainer, setSelectedTrainer] = useState<number | null>(null);
  const [selectedProcess, setSelectedProcess] = useState<number | null>(null); // Added state for selected process

  // Fetch LOBs
  const { data: lobs = [] } = useQuery<OrganizationLineOfBusiness[]>({
    queryKey: [`/api/organizations/${user?.organizationId}/line-of-businesses`],
    enabled: !!user?.organizationId,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch all processes
  const { data: allProcesses = [], isLoading: isLoadingProcesses } = useQuery<OrganizationProcess[]>({
    queryKey: [`/api/organizations/${user?.organizationId}/processes`],
    enabled: !!user?.organizationId,
    staleTime: 5 * 60 * 1000,
  });

  // Filter processes based on selected LOB
  const filteredProcesses = selectedLob
    ? allProcesses.filter((process) => process.lineOfBusinessId === selectedLob)
    : [];

  // Fetch locations
  const { data: locations = [] } = useQuery({
    queryKey: [`/api/organizations/${user?.organizationId}/locations`],
    enabled: !!user?.organizationId,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch all users
  const { data: allUsers = [], isLoading: isLoadingUsers } = useQuery<User[]>({
    queryKey: [`/api/organizations/${user?.organizationId}/users`],
    enabled: !!user?.organizationId,
    staleTime: 5 * 60 * 1000,
  });

  // Filter trainers based on location, active status, and selected process
  const filteredTrainers = allUsers.filter((user) => {
    const isTrainer = user.role === "trainer";
    const isActive = user.active && user.category === "active";
    const matchesLocation = !selectedLocation || user.locationId === selectedLocation;
    const matchesProcess = !selectedProcess || (user.processes && user.processes.includes(selectedProcess));
    return isTrainer && isActive && matchesLocation && matchesProcess;
  });

  // Filter co-trainers based on selected trainer, active status, and selected process
  const filteredCoTrainers = allUsers.filter((user) => {
    const isTrainer = user.role === "trainer";
    const isActive = user.active && user.category === "active";
    const matchesTrainer = !selectedTrainer || user.managerId === selectedTrainer;
    const matchesProcess = !selectedProcess || (user.processes && user.processes.includes(selectedProcess));
    return isTrainer && isActive && matchesTrainer && matchesProcess;
  });

  const form = useForm<InsertOrganizationBatch>({
    resolver: zodResolver(insertOrganizationBatchSchema),
    defaultValues: {
      status: "planned",
      organizationId: user?.organizationId,
    },
  });

  const createBatchMutation = useMutation({
    mutationFn: async (data: InsertOrganizationBatch) => {
      return apiRequest("POST", `/api/organizations/${user?.organizationId}/batches`, data);
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
      setSelectedTrainer(null);
      setSelectedProcess(null); // Reset selected process
    },
    onError: (error: Error) => {
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

  console.log("Current form state:", {
    selectedLob,
    selectedLocation,
    selectedTrainer,
    filteredTrainers,
    isLoadingUsers,
    filteredCoTrainers,
    filteredProcesses,
    isLoadingProcesses,
  });

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
                    const lobId = parseInt(value);
                    field.onChange(lobId);
                    setSelectedLob(lobId);
                    // Reset dependent fields
                    form.setValue("processId", undefined);
                    form.setValue("managerId", undefined);
                    form.setValue("trainerId", undefined);
                    setSelectedTrainer(null);
                    setSelectedProcess(null); //Reset selected process when LOB changes
                  }}
                  value={field.value?.toString()}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select Line of Business" />
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
                    setSelectedProcess(processId); // Update selectedProcess state
                    // Reset trainer and co-trainer when process changes
                    form.setValue("managerId", undefined);
                    form.setValue("trainerId", undefined);
                    setSelectedTrainer(null);
                  }}
                  value={field.value?.toString()}
                  disabled={!selectedLob || isLoadingProcesses}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder={isLoadingProcesses ? "Loading processes..." : "Select process"} />
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
            name="locationId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Location</FormLabel>
                <Select
                  onValueChange={(value) => {
                    const locationId = parseInt(value);
                    field.onChange(locationId);
                    setSelectedLocation(locationId);
                    // Reset trainer and co-trainer when location changes
                    form.setValue("managerId", undefined);
                    form.setValue("trainerId", undefined);
                    setSelectedTrainer(null);
                    setSelectedProcess(null); //Reset selected process when location changes
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

          <FormField
            control={form.control}
            name="managerId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Trainer</FormLabel>
                <Select
                  onValueChange={(value) => {
                    const trainerId = parseInt(value);
                    field.onChange(trainerId);
                    setSelectedTrainer(trainerId);
                    // Reset co-trainer when trainer changes
                    form.setValue("trainerId", undefined);
                  }}
                  value={field.value?.toString()}
                  disabled={!selectedLocation || isLoadingUsers}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder={isLoadingUsers ? "Loading trainers..." : "Select trainer"} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {filteredTrainers.map((trainer) => (
                      <SelectItem key={trainer.id} value={trainer.id.toString()}>
                        {trainer.username} ({trainer.role})
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
                <FormLabel>Co-Trainer</FormLabel>
                <Select
                  onValueChange={(value) => field.onChange(parseInt(value))}
                  value={field.value?.toString()}
                  disabled={!selectedTrainer || isLoadingUsers}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder={isLoadingUsers ? "Loading co-trainers..." : "Select co-trainer"} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {filteredCoTrainers.map((trainer) => (
                      <SelectItem key={trainer.id} value={trainer.id.toString()}>
                        {trainer.username} ({trainer.role})
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
          <Button type="submit" disabled={createBatchMutation.isPending}>
            Create Batch
          </Button>
        </div>
      </form>
    </Form>
  );
}