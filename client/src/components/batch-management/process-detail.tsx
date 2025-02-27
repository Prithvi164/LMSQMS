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

// Simple form schema
const processFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  role: z.string().min(1, "Role is required"),
  userIds: z.array(z.string()).min(1, "Select at least one user"),
});

export function ProcessDetail() {
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [selectedRole, setSelectedRole] = useState("");
  const { toast } = useToast();
  const { user } = useAuth();

  // Fetch organization settings
  const { data: orgSettings, isLoading } = useQuery({
    queryKey: ["/api/organizations/settings"],
    enabled: !!user,
  });

  // Simple form
  const form = useForm<z.infer<typeof processFormSchema>>({
    resolver: zodResolver(processFormSchema),
    defaultValues: {
      name: "",
      role: "",
      userIds: [],
    },
  });

  // Get all available roles
  const getAvailableRoles = () => {
    if (!orgSettings?.users) return [];

    // Get unique roles from users
    const roles = [...new Set(
      orgSettings.users
        .map(user => user.role)
        .filter(Boolean)
    )].sort();

    console.log('Available roles:', roles);
    return roles;
  };

  // Get users for selected role
  const getFilteredUsers = () => {
    if (!orgSettings?.users) return [];

    return orgSettings.users.filter(user => 
      !selectedRole || user.role === selectedRole
    );
  };

  const onSubmit = (data: z.infer<typeof processFormSchema>) => {
    console.log('Form submitted:', data);
    toast({
      title: "Success",
      description: "Process created successfully",
    });
  };

  if (isLoading) return <div>Loading...</div>;

  return (
    <div className="p-4">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Name Field */}
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

          {/* Role Selection */}
          <FormField
            control={form.control}
            name="role"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Role</FormLabel>
                <Select
                  value={field.value}
                  onValueChange={(value) => {
                    field.onChange(value);
                    setSelectedRole(value);
                    setSelectedUsers([]);
                  }}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select Role" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {getAvailableRoles().map((role) => (
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

          {/* User Selection */}
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

          <Button type="submit">Create Process</Button>
        </form>
      </Form>
    </div>
  );
}