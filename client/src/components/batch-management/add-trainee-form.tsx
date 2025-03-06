import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import type { OrganizationBatch } from "@shared/schema";

// Form schema with validation
const addTraineeSchema = z.object({
  username: z.string()
    .min(3, "Username must be at least 3 characters")
    .regex(/^[a-zA-Z0-9_]+$/, "Only letters, numbers, and underscores allowed"),
  fullName: z.string().min(2, "Full name is required"),
  email: z.string().email("Invalid email address"),
  employeeId: z.string().min(1, "Employee ID is required"),
  phoneNumber: z.string().regex(/^\+?[1-9]\d{1,14}$/, "Invalid phone number"),
  dateOfJoining: z.date({
    required_error: "Date of joining is required",
  }),
  dateOfBirth: z.date({
    required_error: "Date of birth is required",
  }),
  education: z.string().min(1, "Education details are required"),
  password: z.string()
    .min(8, "Password must be at least 8 characters")
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, "Password must contain uppercase, lowercase, and numbers"),
});

type AddTraineeFormProps = {
  batch: OrganizationBatch;
  onSuccess: () => void;
};

export function AddTraineeForm({ batch, onSuccess }: AddTraineeFormProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Get current batch details including trainee count
  const { data: batchDetails } = useQuery({
    queryKey: [`/api/organizations/${batch.organizationId}/batches/${batch.id}`],
    enabled: !!batch.id,
  });

  const form = useForm<z.infer<typeof addTraineeSchema>>({
    resolver: zodResolver(addTraineeSchema),
  });

  async function onSubmit(values: z.infer<typeof addTraineeSchema>) {
    try {
      setIsSubmitting(true);

      // Combine form values with batch data and convert dates to ISO strings
      const traineeData = {
        ...values,
        dateOfJoining: values.dateOfJoining.toISOString().split('T')[0], // Format as YYYY-MM-DD
        dateOfBirth: values.dateOfBirth.toISOString().split('T')[0], // Format as YYYY-MM-DD
        processId: batch.processId,
        lineOfBusinessId: batch.lineOfBusinessId,
        locationId: batch.locationId,
        trainerId: batch.trainerId,
        organizationId: batch.organizationId,
        batchId: batch.id,
        role: "trainee",
        category: "trainee"
      };

      // Updated API endpoint
      const response = await fetch(`/api/organizations/${batch.organizationId}/batches/${batch.id}/trainees`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(traineeData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to add trainee");
      }

      toast({
        title: "Success",
        description: "Trainee added successfully",
      });

      onSuccess();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to add trainee",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  // Calculate trainee count and remaining capacity
  const traineeCount = batchDetails?.traineeCount || 0;
  const remainingCapacity = (batch.capacityLimit || 0) - traineeCount;

  return (
    <div className="max-h-[70vh] overflow-y-auto px-4">
      {/* Capacity Information */}
      <div className="mb-6 p-4 rounded-lg bg-muted">
        <h3 className="font-medium mb-2">Batch Capacity</h3>
        <div className="text-sm space-y-1">
          <p>Total Capacity: {batch.capacityLimit}</p>
          <p>Current Trainees: {traineeCount}</p>
          <p className="font-medium">Remaining Slots: {remainingCapacity}</p>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Rest of the form fields remain unchanged */}
          <FormField
            control={form.control}
            name="username"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Username</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="fullName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Full Name</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input type="email" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Batch Info Section */}
          <div className="rounded-lg bg-muted/50 p-4 space-y-4">
            <div>
              <FormLabel className="text-muted-foreground">Batch</FormLabel>
              <Input value={batch.name} disabled />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <FormLabel className="text-muted-foreground">Trainer</FormLabel>
                <Input value={batchDetails?.trainer?.fullName || 'Loading...'} disabled />
              </div>
              <div>
                <FormLabel className="text-muted-foreground">Location</FormLabel>
                <Input value={batchDetails?.location?.name || 'Loading...'} disabled />
              </div>
              <div>
                <FormLabel className="text-muted-foreground">Line of Business</FormLabel>
                <Input value={batchDetails?.lineOfBusiness?.name || 'Loading...'} disabled />
              </div>
              <div>
                <FormLabel className="text-muted-foreground">Process</FormLabel>
                <Input value={batchDetails?.process?.name || 'Loading...'} disabled />
              </div>
            </div>
          </div>

          <FormField
            control={form.control}
            name="employeeId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Employee ID</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="phoneNumber"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Phone Number</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="dateOfJoining"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Date of Joining</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant={"outline"}
                          className={cn(
                            "w-full pl-3 text-left font-normal",
                            !field.value && "text-muted-foreground"
                          )}
                        >
                          {field.value ? (
                            format(field.value, "PPP")
                          ) : (
                            <span>Pick a date</span>
                          )}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        disabled={(date) =>
                          date > new Date() || date < new Date("1900-01-01")
                        }
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="dateOfBirth"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Date of Birth</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant={"outline"}
                          className={cn(
                            "w-full pl-3 text-left font-normal",
                            !field.value && "text-muted-foreground"
                          )}
                        >
                          {field.value ? (
                            format(field.value, "PPP")
                          ) : (
                            <span>Pick a date</span>
                          )}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        disabled={(date) =>
                          date > new Date() || date < new Date("1900-01-01")
                        }
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="education"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Education</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Password</FormLabel>
                <FormControl>
                  <Input type="password" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button 
            type="submit" 
            disabled={isSubmitting || remainingCapacity <= 0} 
            className="w-full"
          >
            {isSubmitting ? "Adding Trainee..." : 
             remainingCapacity <= 0 ? "Batch Full" : "Add Trainee"}
          </Button>
        </form>
      </Form>
    </div>
  );
}