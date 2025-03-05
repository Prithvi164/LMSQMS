import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { InsertUser, insertUserSchema } from "@shared/schema";
import { apiRequest } from "@/lib/apiRequest";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { Spinner } from "@/components/ui/spinner";

// Schema for trainee data validation
const addTraineeSchema = insertUserSchema.extend({
  processes: z.array(z.number()).optional(),
  password: z.string().optional(), // Password will be auto-generated
  username: z.string().optional(), // Username will be auto-generated
  role: z.string().optional(), // Role will be set to 'trainee'
  category: z.string().optional(), // Category will be set to 'trainee'
});

type AddTraineeFormData = z.infer<typeof addTraineeSchema>;

interface AddTraineeFormProps {
  batchId: number;
  onSuccess?: () => void;
}

export function AddTraineeForm({ batchId, onSuccess }: AddTraineeFormProps) {
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  // Initialize form with validation
  const form = useForm<AddTraineeFormData>({
    resolver: zodResolver(addTraineeSchema),
    defaultValues: {
      processes: [],
    }
  });

  // Mutation for creating trainee
  const createTraineeMutation = useMutation({
    mutationFn: async (data: AddTraineeFormData) => {
      return apiRequest(`/api/batches/${batchId}/trainees`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      // Invalidate queries to refresh data
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

  // Form submission handler
  const onSubmit = async (data: AddTraineeFormData) => {
    setIsSubmitting(true);
    try {
      await createTraineeMutation.mutateAsync(data);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          {/* Full Name Field */}
          <FormField
            control={form.control}
            name="fullName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Full Name</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="Enter full name" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Employee ID Field */}
          <FormField
            control={form.control}
            name="employeeId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Employee ID</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="Enter employee ID" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Email Field */}
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input {...field} type="email" placeholder="Enter email" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Phone Number Field */}
          <FormField
            control={form.control}
            name="phoneNumber"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Phone Number</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="Enter phone number" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Date of Joining Field */}
          <FormField
            control={form.control}
            name="dateOfJoining"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Date of Joining</FormLabel>
                <FormControl>
                  <Input {...field} type="date" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Date of Birth Field */}
          <FormField
            control={form.control}
            name="dateOfBirth"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Date of Birth</FormLabel>
                <FormControl>
                  <Input {...field} type="date" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Education Field */}
          <FormField
            control={form.control}
            name="education"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Education</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="Enter education" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Submit Button */}
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