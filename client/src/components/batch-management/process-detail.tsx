import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";

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
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

// Define interfaces
interface User {
  id: number;
  username: string;
  fullName: string | null;
  role: string;
  locationId: number | null;
  locationName: string | null;
  email: string;
}

interface Location {
  id: number;
  name: string;
}

interface LineOfBusiness {
  id: number;
  name: string;
}

// Form schema
const processFormSchema = z.object({
  name: z.string().min(1, "Process name is required"),
  inductionDays: z.number().min(1, "Induction days must be at least 1"),
  trainingDays: z.number().min(1, "Training days must be at least 1"),
  certificationDays: z.number().min(1, "Certification days must be at least 1"),
  ojtDays: z.number().min(0, "OJT days cannot be negative"),
  ojtCertificationDays: z.number().min(0, "OJT certification days cannot be negative"),
  lineOfBusinessId: z.number().min(1, "Line of Business is required"),
  locationId: z.number().min(1, "Location is required"),
  role: z.string().min(1, "Role is required"),
  userId: z.number().min(1, "User is required"),
});

type ProcessFormValues = z.infer<typeof processFormSchema>;

export function ProcessDetail() {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedLocationId, setSelectedLocationId] = useState<string>("");
  const [selectedRole, setSelectedRole] = useState<string>("");

  const form = useForm<ProcessFormValues>({
    resolver: zodResolver(processFormSchema),
    defaultValues: {
      name: "",
      inductionDays: 1,
      trainingDays: 1,
      certificationDays: 1,
      ojtDays: 0,
      ojtCertificationDays: 0,
      lineOfBusinessId: undefined,
      locationId: undefined,
      role: "",
      userId: undefined,
    },
  });

  // Fetch line of businesses
  const { data: lineOfBusinesses = [], isLoading: isLoadingLOB } = useQuery({
    queryKey: ['line-of-businesses', user?.organizationId],
    queryFn: async () => {
      const response = await fetch(`/api/organizations/${user?.organizationId}/line-of-businesses`, {
        headers: { Accept: 'application/json' },
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch line of businesses');
      return response.json();
    },
    enabled: !!user?.organizationId,
  });

  // Fetch locations
  const { data: locations = [], isLoading: isLoadingLocations } = useQuery({
    queryKey: ['locations', user?.organizationId],
    queryFn: async () => {
      const response = await fetch(`/api/organizations/${user?.organizationId}/locations`, {
        headers: { Accept: 'application/json' },
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch locations');
      return response.json();
    },
    enabled: !!user?.organizationId,
  });

  // Fetch users with location information
  const { data: users = [], isLoading: isLoadingUsers } = useQuery({
    queryKey: ['users', user?.organizationId],
    queryFn: async () => {
      const response = await fetch(`/api/organizations/${user?.organizationId}/users`, {
        headers: { Accept: 'application/json' },
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch users');
      const data = await response.json();
      console.log('Users data:', data);
      return data;
    },
    enabled: !!user?.organizationId,
  });

  // Get roles based on selected location
  const roles = Array.from(new Set(
    users
      .filter(u => !selectedLocationId || u.locationId === parseInt(selectedLocationId, 10))
      .map(u => u.role)
  )).sort();

  // Filter users based on location and role
  const filteredUsers = users.filter(u => {
    const locationMatch = !selectedLocationId || u.locationId === parseInt(selectedLocationId, 10);
    const roleMatch = !selectedRole || u.role === selectedRole;
    return locationMatch && roleMatch;
  });

  // Create process mutation
  const createProcessMutation = useMutation({
    mutationFn: async (data: ProcessFormValues) => {
      const response = await fetch(`/api/organizations/${user?.organizationId}/processes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create process');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['processes'] });
      toast({
        title: "Success",
        description: "Process created successfully",
      });
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    },
  });

  const onSubmit = (data: ProcessFormValues) => {
    createProcessMutation.mutate(data);
  };

  if (!user?.organizationId) {
    return null;
  }

  const isLoading = isLoadingLOB || isLoadingLocations || isLoadingUsers;

  return (
    <Card>
      <CardContent className="p-6">
        {isLoading ? (
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
            <span className="ml-2">Loading...</span>
          </div>
        ) : (
          <>
            <h2 className="text-2xl font-bold mb-6">Add New Process</h2>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Process Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter process name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="inductionDays"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Induction Days</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="1"
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
                    name="trainingDays"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Training Days</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="1"
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
                    name="certificationDays"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Certification Days</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="1"
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
                    name="ojtDays"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>OJT Days</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="0"
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
                    name="ojtCertificationDays"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>OJT Certification Days</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="0"
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value, 10))}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="lineOfBusinessId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Line of Business</FormLabel>
                      <Select
                        onValueChange={(value) => field.onChange(parseInt(value, 10))}
                        value={field.value?.toString()}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select Line of Business" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {lineOfBusinesses.map((lob) => (
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
                  name="locationId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Location</FormLabel>
                      <Select
                        onValueChange={(value) => {
                          field.onChange(parseInt(value, 10));
                          setSelectedLocationId(value);
                          // Reset role when location changes
                          setSelectedRole("");
                          form.setValue("role", "");
                          form.setValue("userId", undefined);
                        }}
                        value={field.value?.toString()}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select Location" />
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
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Role</FormLabel>
                      <Select
                        onValueChange={(value) => {
                          field.onChange(value);
                          setSelectedRole(value);
                          // Reset user when role changes
                          form.setValue("userId", undefined);
                        }}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select Role" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {roles.map((role) => (
                            <SelectItem key={role} value={role}>
                              {role}
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
                  name="userId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>User</FormLabel>
                      <Select
                        onValueChange={(value) => field.onChange(parseInt(value, 10))}
                        value={field.value?.toString()}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select User" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {filteredUsers.map((user) => (
                            <SelectItem key={user.id} value={user.id.toString()}>
                              {user.fullName || user.username}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  disabled={createProcessMutation.isPending}
                  className="w-full"
                >
                  {createProcessMutation.isPending ? "Creating..." : "Create Process"}
                </Button>
              </form>
            </Form>
          </>
        )}
      </CardContent>
    </Card>
  );
}