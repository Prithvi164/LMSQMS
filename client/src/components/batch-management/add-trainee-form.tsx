import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useParams } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { InsertUser, insertUserSchema } from "@shared/schema";
import { apiRequest } from "@/lib/apiRequest";
import { Form } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { useState } from "react";
import { Spinner } from "@/components/ui/spinner";

// Extend the user schema to include batch-specific fields
const addTraineeSchema = insertUserSchema.extend({
  processes: z.array(z.number()).optional(),
});

type AddTraineeFormData = z.infer<typeof addTraineeSchema>;

export function AddTraineeForm() {
  const { batchId } = useParams();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<AddTraineeFormData>({
    resolver: zodResolver(addTraineeSchema),
    defaultValues: {
      category: 'trainee',
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

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
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
            name="email"
            render={({ field }) => (
              <Form.Item>
                <Form.Label>Email</Form.Label>
                <Form.Control>
                  <Input {...field} type="email" placeholder="Enter email" />
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
