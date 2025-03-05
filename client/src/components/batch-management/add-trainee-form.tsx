import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { InsertUser, insertUserSchema } from "@shared/schema";
import { apiRequest } from "@/lib/apiRequest";
import { Form } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { useState } from "react";
import { Spinner } from "@/components/ui/spinner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Extend the user schema with additional validation rules
const addTraineeSchema = insertUserSchema.extend({
  username: z.string()
    .min(3, "Username must be at least 3 characters")
    .max(20, "Username must be less than 20 characters")
    .regex(/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers, and underscores"),
  fullName: z.string().min(1, "Full name is required"),
  email: z.string().email("Invalid email format"),
  role: z.string().min(1, "Role is required"),
  employeeId: z.string().min(1, "Employee ID is required"),
  phoneNumber: z.string().min(1, "Phone number is required"),
  dateOfJoining: z.string().min(1, "Date of joining is required"),
  dateOfBirth: z.string().min(1, "Date of birth is required"),
  education: z.string().min(1, "Education is required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  category: z.literal("trainee"),
  processes: z.array(z.number()).optional(),
});

type AddTraineeFormData = z.infer<typeof addTraineeSchema>;

interface AddTraineeFormProps {
  batchId: number;
  onSuccess?: () => void;
}

export function AddTraineeForm({ batchId, onSuccess }: AddTraineeFormProps) {
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch batch details
  const { data: batchDetails } = useQuery({
    queryKey: [`/api/organizations/${batchId}/batches/${batchId}`],
    enabled: !!batchId,
  });

  const form = useForm<AddTraineeFormData>({
    resolver: zodResolver(addTraineeSchema),
    defaultValues: {
      category: "trainee",
      role: "trainee",
      processes: [],
    }
  });

  const createTraineeMutation = useMutation({
    mutationFn: async (data: AddTraineeFormData) => {
      return apiRequest(`/api/batches/${batchId}/trainees`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/batches/${batchId}/trainees`] });
      toast({
        title: "Success",
        description: "Trainee has been added to the batch successfully.",
      });
      form.reset();
      onSuccess?.();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add trainee to batch",
        variant: "destructive",
      });
    },
  });

  const onSubmit = async (data: AddTraineeFormData) => {
    setIsSubmitting(true);
    try {
      await createTraineeMutation.mutateAsync(data);
    } finally {
      setIsSubmitting(false);
    }
  };

  const roles = ["Advisor", "Trainer", "TL", "Manager", "Admin"];

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <Form.Field
            control={form.control}
            name="username"
            render={({ field }) => (
              <Form.Item>
                <Form.Label>Username</Form.Label>
                <Form.Control>
                  <Input {...field} placeholder="Enter username" />
                </Form.Control>
                <Form.Message />
              </Form.Item>
            )}
          />

          <Form.Field
            control={form.control}
            name="fullName"
            render={({ field }) => (
              <Form.Item>
                <Form.Label>Full Name</Form.Label>
                <Form.Control>
                  <Input {...field} placeholder="Enter full name" />
                </Form.Control>
                <Form.Message />
              </Form.Item>
            )}
          />

          <Form.Field
            control={form.control}
            name="email"
            render={({ field }) => (
              <Form.Item>
                <Form.Label>Email</Form.Label>
                <Form.Control>
                  <Input {...field} type="email" placeholder="name@example.com" />
                </Form.Control>
                <Form.Message />
              </Form.Item>
            )}
          />

          <Form.Field
            control={form.control}
            name="role"
            render={({ field }) => (
              <Form.Item>
                <Form.Label>Role</Form.Label>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <Form.Control>
                    <SelectTrigger>
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                  </Form.Control>
                  <SelectContent>
                    {roles.map((role) => (
                      <SelectItem key={role} value={role.toLowerCase()}>
                        {role}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Form.Message />
              </Form.Item>
            )}
          />

          <Form.Field
            control={form.control}
            name="employeeId"
            render={({ field }) => (
              <Form.Item>
                <Form.Label>Employee ID</Form.Label>
                <Form.Control>
                  <Input {...field} placeholder="Enter employee ID" />
                </Form.Control>
                <Form.Message />
              </Form.Item>
            )}
          />

          <Form.Field
            control={form.control}
            name="phoneNumber"
            render={({ field }) => (
              <Form.Item>
                <Form.Label>Phone Number</Form.Label>
                <Form.Control>
                  <Input {...field} placeholder="Enter phone number" />
                </Form.Control>
                <Form.Message />
              </Form.Item>
            )}
          />

          <Form.Field
            control={form.control}
            name="dateOfJoining"
            render={({ field }) => (
              <Form.Item>
                <Form.Label>Date of Joining</Form.Label>
                <Form.Control>
                  <Input {...field} type="date" />
                </Form.Control>
                <Form.Message />
              </Form.Item>
            )}
          />

          <Form.Field
            control={form.control}
            name="dateOfBirth"
            render={({ field }) => (
              <Form.Item>
                <Form.Label>Date of Birth</Form.Label>
                <Form.Control>
                  <Input {...field} type="date" />
                </Form.Control>
                <Form.Message />
              </Form.Item>
            )}
          />

          <Form.Field
            control={form.control}
            name="education"
            render={({ field }) => (
              <Form.Item>
                <Form.Label>Education</Form.Label>
                <Form.Control>
                  <Input {...field} placeholder="Enter education" />
                </Form.Control>
                <Form.Message />
              </Form.Item>
            )}
          />

          <Form.Field
            control={form.control}
            name="password"
            render={({ field }) => (
              <Form.Item>
                <Form.Label>Password</Form.Label>
                <Form.Control>
                  <Input {...field} type="password" placeholder="Enter password" />
                </Form.Control>
                <Form.Message />
              </Form.Item>
            )}
          />

          {/* Read-only batch details */}
          <div className="col-span-2 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Trainer</label>
                <Input 
                  value={batchDetails?.trainer?.fullName || 'Not assigned'} 
                  disabled 
                  className="bg-muted"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Location</label>
                <Input 
                  value={batchDetails?.location?.name || 'Not specified'} 
                  disabled 
                  className="bg-muted"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Line of Business</label>
                <Input 
                  value={batchDetails?.line_of_business?.name || 'Not specified'} 
                  disabled 
                  className="bg-muted"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Process</label>
                <Input 
                  value={batchDetails?.process?.name || 'Not specified'} 
                  disabled 
                  className="bg-muted"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Batch</label>
                <Input 
                  value={batchDetails?.name || 'Not specified'} 
                  disabled 
                  className="bg-muted"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end space-x-2">
          <Button
            type="submit"
            disabled={isSubmitting}
          >
            {isSubmitting ? <Spinner /> : "Add Trainee"}
          </Button>
        </div>
      </form>
    </Form>
  );
}