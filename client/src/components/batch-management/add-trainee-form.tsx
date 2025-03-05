import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Form validation schema
const addTraineeSchema = z.object({
  username: z.string()
    .min(3, "Username must be at least 3 characters")
    .regex(/^[a-zA-Z0-9_]+$/, "Only alphanumeric characters and underscores allowed"),
  fullName: z.string().min(1, "Full name is required"),
  email: z.string().email("Invalid email format"),
  role: z.enum(["advisor", "trainer", "team_lead", "manager", "admin"]),
  employeeId: z.string().min(1, "Employee ID is required"),
  phoneNumber: z.string().regex(/^\d{10}$/, "Phone number must be 10 digits"),
  dateOfJoining: z.string().min(1, "Date of joining is required"),
  dateOfBirth: z.string().min(1, "Date of birth is required"),
  education: z.string().min(1, "Education is required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

type AddTraineeFormProps = {
  isOpen: boolean;
  onClose: () => void;
  batchData: {
    id: number;
    name: string;
    trainer: { id: number; fullName: string };
    location: { id: number; name: string };
    process: { id: number; name: string };
    lineOfBusiness: { id: number; name: string };
  };
};

export function AddTraineeForm({ isOpen, onClose, batchData }: AddTraineeFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<z.infer<typeof addTraineeSchema>>({
    resolver: zodResolver(addTraineeSchema),
    defaultValues: {
      username: "",
      fullName: "",
      email: "",
      role: "advisor",
      employeeId: "",
      phoneNumber: "",
      dateOfJoining: format(new Date(), "yyyy-MM-dd"),
      dateOfBirth: "",
      education: "",
      password: "",
    },
  });

  const createTraineeMutation = useMutation({
    mutationFn: async (data: z.infer<typeof addTraineeSchema>) => {
      setIsSubmitting(true);
      const response = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          category: "trainee",
          active: true,
          certified: false,
          locationId: batchData.location.id,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to create trainee");
      }

      return response.json();
    },
    onSuccess: async (newUser) => {
      // Create user process mapping
      await fetch("/api/user-processes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: newUser.id,
          processId: batchData.process.id,
          lineOfBusinessId: batchData.lineOfBusiness.id,
          locationId: batchData.location.id,
        }),
      });

      // Create user batch process mapping
      await fetch("/api/user-batch-processes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: newUser.id,
          batchId: batchData.id,
        }),
      });

      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      queryClient.invalidateQueries({ queryKey: [`/api/batches/${batchData.id}/trainees`] });

      toast({
        title: "Success",
        description: "Trainee added successfully",
      });

      onClose();
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
    onSettled: () => {
      setIsSubmitting(false);
    },
  });

  const onSubmit = async (data: z.infer<typeof addTraineeSchema>) => {
    try {
      await createTraineeMutation.mutateAsync(data);
    } catch (error) {
      console.error("Error creating trainee:", error);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          {/* Username */}
          <FormField
            control={form.control}
            name="username"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Username</FormLabel>
                <FormControl>
                  <Input placeholder="Enter username" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Full Name */}
          <FormField
            control={form.control}
            name="fullName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Full Name</FormLabel>
                <FormControl>
                  <Input placeholder="Enter full name" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Email */}
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input type="email" placeholder="Enter email" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Role */}
          <FormField
            control={form.control}
            name="role"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Role</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="advisor">Advisor</SelectItem>
                    <SelectItem value="trainer">Trainer</SelectItem>
                    <SelectItem value="team_lead">Team Lead</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Auto-filled Fields */}
          <FormItem>
            <FormLabel>Trainer Name</FormLabel>
            <Input value={batchData.trainer.fullName} disabled />
          </FormItem>

          <FormItem>
            <FormLabel>Location</FormLabel>
            <Input value={batchData.location.name} disabled />
          </FormItem>

          {/* Employee ID */}
          <FormField
            control={form.control}
            name="employeeId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Employee ID</FormLabel>
                <FormControl>
                  <Input placeholder="Enter employee ID" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Line of Business */}
          <FormItem>
            <FormLabel>Line of Business</FormLabel>
            <Input value={batchData.lineOfBusiness.name} disabled />
          </FormItem>

          {/* Process */}
          <FormItem>
            <FormLabel>Process</FormLabel>
            <Input value={batchData.process.name} disabled />
          </FormItem>

          {/* Batch */}
          <FormItem>
            <FormLabel>Batch</FormLabel>
            <Input value={batchData.name} disabled />
          </FormItem>

          {/* Phone Number */}
          <FormField
            control={form.control}
            name="phoneNumber"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Phone Number</FormLabel>
                <FormControl>
                  <Input placeholder="Enter phone number" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Date of Joining */}
          <FormField
            control={form.control}
            name="dateOfJoining"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Date of Joining</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Date of Birth */}
          <FormField
            control={form.control}
            name="dateOfBirth"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Date of Birth</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Education */}
          <FormField
            control={form.control}
            name="education"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Education</FormLabel>
                <FormControl>
                  <Input placeholder="Enter education" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Password */}
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Password</FormLabel>
                <FormControl>
                  <Input type="password" placeholder="Enter password" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="flex justify-end space-x-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Adding Trainee...
              </>
            ) : (
              "Add Trainee"
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}