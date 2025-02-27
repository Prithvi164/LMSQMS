import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useQuery } from "@tanstack/react-query";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";

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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";

// Updated form schema to match new database structure - removed locationId
const processFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  status: z.enum(['active', 'inactive', 'archived']).default('active'),
  lineOfBusinessId: z.number().int().positive("Line of Business is required"),
  inductionDays: z.number().int().min(1, "Induction days must be at least 1"),
  trainingDays: z.number().int().min(1, "Training days must be at least 1"),
  certificationDays: z.number().int().min(1, "Certification days must be at least 1"),
  ojtDays: z.number().int().min(0, "OJT days cannot be negative"),
  ojtCertificationDays: z.number().int().min(0, "OJT certification days cannot be negative"),
  userIds: z.array(z.string()).min(1, "Select at least one user"),
});

export function ProcessDetail() {
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch organization settings
  const { data: orgSettings, isLoading: isSettingsLoading } = useQuery({
    queryKey: [`/api/organizations/${user?.organizationId}/settings`],
    enabled: !!user?.organizationId,
  });

  // Fetch line of businesses
  const { data: lineOfBusinesses, isLoading: isLOBLoading } = useQuery({
    queryKey: [`/api/organizations/${user?.organizationId}/line-of-businesses`],
    enabled: !!user?.organizationId,
  });

  // Simple form
  const form = useForm<z.infer<typeof processFormSchema>>({
    resolver: zodResolver(processFormSchema),
    defaultValues: {
      name: "",
      description: "",
      status: "active",
      inductionDays: 1,
      trainingDays: 1,
      certificationDays: 1,
      ojtDays: 0,
      ojtCertificationDays: 0,
      userIds: [],
    },
  });

  // Get users for selected role
  const getFilteredUsers = () => {
    if (!orgSettings?.users) return [];
    return orgSettings.users;
  };

  const createProcessMutation = useMutation({
    mutationFn: async (data: z.infer<typeof processFormSchema>) => {
      const response = await fetch('/api/processes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...data,
          organizationId: user?.organizationId,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create process');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/organizations/${user?.organizationId}/settings`] });
      toast({
        title: "Success",
        description: "Process created successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
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

  if (isSettingsLoading || isLOBLoading) return <div>Loading...</div>;

  return (
    <div className="p-4">
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

          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Description</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Enter process description"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="status"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Status</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
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
                  onValueChange={(value) => field.onChange(parseInt(value, 10))}
                  value={field.value?.toString()}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select Line of Business" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {lineOfBusinesses?.map((lob) => (
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
            name="userIds"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Select Users</FormLabel>
                <ScrollArea className="h-[200px] border rounded-md p-4">
                  <div className="space-y-2">
                    {getFilteredUsers().map((user) => (
                      <div
                        key={user.id}
                        className="flex items-center justify-between p-2 hover:bg-accent rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback>
                              {user.username[0]?.toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{user.username}</p>
                            <Badge variant="outline">{user.role}</Badge>
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant={selectedUsers.includes(user.id.toString()) ? "secondary" : "outline"}
                          size="sm"
                          onClick={() => {
                            const userId = user.id.toString();
                            const newSelectedUsers = selectedUsers.includes(userId)
                              ? selectedUsers.filter(id => id !== userId)
                              : [...selectedUsers, userId];
                            setSelectedUsers(newSelectedUsers);
                            field.onChange(newSelectedUsers);
                          }}
                        >
                          {selectedUsers.includes(user.id.toString()) ? "Selected" : "Select"}
                        </Button>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button
            type="submit"
            disabled={createProcessMutation.isPending}
          >
            {createProcessMutation.isPending ? "Creating..." : "Create Process"}
          </Button>
        </form>
      </Form>
    </div>
  );
}