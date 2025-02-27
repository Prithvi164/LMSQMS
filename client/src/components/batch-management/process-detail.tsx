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

// Types for data
interface User {
  id: number;
  username: string;
  fullName?: string;
  role: string;
  locationId: number;
  email: string;
}

interface Location {
  id: number;
  name: string;
  address: string;
  city: string;
  state: string;
  country: string;
}

interface LineOfBusiness {
  id: number;
  name: string;
}

// Form schema
const processFormSchema = z.object({
  name: z.string().min(1, "Process name is required"),
  inductionDays: z.number().int().min(1, "Induction days must be at least 1"),
  trainingDays: z.number().int().min(1, "Training days must be at least 1"),
  certificationDays: z.number().int().min(1, "Certification days must be at least 1"),
  ojtDays: z.number().int().min(0, "OJT days cannot be negative"),
  ojtCertificationDays: z.number().int().min(0, "OJT certification days cannot be negative"),
  lineOfBusinessId: z.number().int().positive("Line of Business is required"),
  locationId: z.number().int().positive("Location is required"),
  role: z.string().min(1, "Role is required"),
  userId: z.number().int().positive("User is required"),
});

export function ProcessDetail() {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedLocation, setSelectedLocation] = useState<string>("");
  const [selectedRole, setSelectedRole] = useState<string>("");

  const form = useForm<z.infer<typeof processFormSchema>>({
    resolver: zodResolver(processFormSchema),
    defaultValues: {
      name: "",
      inductionDays: 1,
      trainingDays: 1,
      certificationDays: 1,
      ojtDays: 0,
      ojtCertificationDays: 0,
      lineOfBusinessId: 0,
      locationId: 0,
      role: "",
      userId: 0,
    },
  });

  // Fetch line of businesses
  const { data: lineOfBusinesses = [], isLoading: isLoadingLOB } = useQuery({
    queryKey: ['lineOfBusinesses', user?.organizationId],
    queryFn: async () => {
      try {
        const response = await fetch(`/api/organizations/${user?.organizationId}/line-of-businesses`);
        if (!response.ok) throw new Error('Failed to fetch line of businesses');
        const data = await response.json();
        console.log('Line of Business data:', data);
        return data;
      } catch (error) {
        console.error('Line of Business error:', error);
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to load line of businesses",
        });
        return [];
      }
    },
    enabled: !!user?.organizationId,
  });

  // Fetch locations
  const { data: locations = [], isLoading: isLoadingLocations } = useQuery({
    queryKey: ['locations', user?.organizationId],
    queryFn: async () => {
      try {
        const response = await fetch(`/api/organizations/${user?.organizationId}/locations`);
        const text = await response.text(); // First get the response as text
        console.log('Raw locations response:', text);

        try {
          const data = JSON.parse(text); // Try to parse it as JSON
          console.log('Parsed locations data:', data);
          return data;
        } catch (e) {
          console.error('JSON parse error:', e);
          throw new Error('Invalid JSON response from locations endpoint');
        }
      } catch (error) {
        console.error('Locations fetch error:', error);
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to load locations",
        });
        return [];
      }
    },
    enabled: !!user?.organizationId,
  });

  // Fetch users
  const { data: users = [], isLoading: isLoadingUsers } = useQuery({
    queryKey: ['users', user?.organizationId],
    queryFn: async () => {
      try {
        const response = await fetch(`/api/organizations/${user?.organizationId}/users`);
        const text = await response.text(); // First get the response as text
        console.log('Raw users response:', text);

        try {
          const data = JSON.parse(text); // Try to parse it as JSON
          console.log('Parsed users data:', data);
          return data;
        } catch (e) {
          console.error('JSON parse error:', e);
          throw new Error('Invalid JSON response from users endpoint');
        }
      } catch (error) {
        console.error('Users fetch error:', error);
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to load users",
        });
        return [];
      }
    },
    enabled: !!user?.organizationId,
  });

  // Get unique roles from users
  const roles = Array.from(new Set(users.map(user => user.role))).sort();

  // Filter users based on selected location and role
  const filteredUsers = users.filter(u => 
    (!selectedLocation || u.locationId === parseInt(selectedLocation)) &&
    (!selectedRole || u.role === selectedRole)
  );

  const createProcessMutation = useMutation({
    mutationFn: async (data: z.infer<typeof processFormSchema>) => {
      const response = await fetch('/api/processes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          organizationId: user?.organizationId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create process');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['processes', user?.organizationId] });
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

  const onSubmit = async (data: z.infer<typeof processFormSchema>) => {
    try {
      await createProcessMutation.mutateAsync(data);
    } catch (error) {
      console.error("Error creating process:", error);
    }
  };

  const isLoading = isLoadingLOB || isLoadingLocations || isLoadingUsers;

  if (!user?.organizationId) {
    toast({
      variant: "destructive",
      title: "Error",
      description: "Please log in to access this feature.",
    });
    return null;
  }

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
                {/* Process Name Field */}
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

                {/* Process Duration Fields */}
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

                {/* Line of Business Field */}
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

                {/* Location Field */}
                <FormField
                  control={form.control}
                  name="locationId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Location</FormLabel>
                      <Select
                        onValueChange={(value) => {
                          field.onChange(parseInt(value, 10));
                          setSelectedLocation(value);
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

                {/* Role Field */}
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

                {/* User Field */}
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