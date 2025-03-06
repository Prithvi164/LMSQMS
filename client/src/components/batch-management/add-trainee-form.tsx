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
import { CalendarIcon, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import type { OrganizationBatch } from "@shared/schema";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Enhanced form schema with validation
const addTraineeSchema = z.object({
  username: z.string()
    .min(3, "Username must be at least 3 characters")
    .regex(/^[a-zA-Z0-9_]+$/, "Only letters, numbers, and underscores allowed"),
  fullName: z.string().min(2, "Full name is required"),
  email: z.string().email("Invalid email address"),
  employeeId: z.string()
    .regex(/^[A-Z]{2}\d{6}$/, "Employee ID must be in format: XX123456"),
  phoneNumber: z.string().regex(/^\+?[1-9]\d{1,14}$/, "Invalid phone number"),
  dateOfJoining: z.date({
    required_error: "Date of joining is required",
  }),
  dateOfBirth: z.date({
    required_error: "Date of birth is required",
  }).refine(date => {
    const age = new Date().getFullYear() - date.getFullYear();
    return age >= 18 && age <= 65;
  }, "Age must be between 18 and 65"),
  education: z.string().min(1, "Education details are required"),
  password: z.string()
    .min(8, "Password must be at least 8 characters")
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, 
      "Password must contain uppercase, lowercase, number and special character"),
  // New fields
  emergencyContact: z.object({
    name: z.string().min(2, "Emergency contact name is required"),
    relationship: z.string().min(2, "Relationship is required"),
    phone: z.string().regex(/^\+?[1-9]\d{1,14}$/, "Invalid phone number"),
  }),
  previousExperience: z.string(),
  skills: z.array(z.string()).optional(),
  preferredLanguage: z.string(),
  photo: z.any().optional(), // File upload will be handled separately
  documents: z.array(z.any()).optional(), // Document uploads
});

type AddTraineeFormProps = {
  batch: OrganizationBatch;
  onSuccess: () => void;
};

export function AddTraineeForm({ batch, onSuccess }: AddTraineeFormProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [documents, setDocuments] = useState<File[]>([]);

  // Get current batch details including trainee count
  const { data: batchDetails } = useQuery({
    queryKey: [`/api/organizations/${batch.organizationId}/batches/${batch.id}`],
    enabled: !!batch.id,
  });

  const form = useForm<z.infer<typeof addTraineeSchema>>({
    resolver: zodResolver(addTraineeSchema),
    defaultValues: {
      preferredLanguage: 'english',
      skills: [],
    }
  });

  // Handle photo upload
  const handlePhotoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Handle document upload
  const handleDocumentUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      setDocuments(Array.from(files));
    }
  };

  async function onSubmit(values: z.infer<typeof addTraineeSchema>) {
    try {
      setIsSubmitting(true);

      // Create FormData for file uploads
      const formData = new FormData();

      // Add all form values
      Object.entries(values).forEach(([key, value]) => {
        if (key !== 'photo' && key !== 'documents') {
          if (value instanceof Date) {
            formData.append(key, value.toISOString().split('T')[0]);
          } else if (typeof value === 'object') {
            formData.append(key, JSON.stringify(value));
          } else {
            formData.append(key, String(value));
          }
        }
      });

      // Add photo if exists
      if (values.photo) {
        formData.append('photo', values.photo);
      }

      // Add documents
      documents.forEach((doc) => {
        formData.append('documents', doc);
      });

      // Add batch related data
      formData.append('processId', batch.processId.toString());
      formData.append('lineOfBusinessId', batch.lineOfBusinessId.toString());
      formData.append('locationId', batch.locationId.toString());
      formData.append('trainerId', batch.trainerId.toString());
      formData.append('organizationId', batch.organizationId.toString());
      formData.append('batchId', batch.id.toString());
      formData.append('role', "trainee");
      formData.append('category', "trainee");

      const response = await fetch(
        `/api/organizations/${batch.organizationId}/batches/${batch.id}/trainees`,
        {
          method: "POST",
          body: formData,
        }
      );

      if (!response.ok) {
        throw new Error(await response.text());
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
    <div className="max-h-[80vh] overflow-y-auto px-4">
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
          {/* Photo Upload Section */}
          <div className="mb-6">
            <FormLabel>Profile Photo</FormLabel>
            <div className="mt-2 flex items-center gap-4">
              {photoPreview ? (
                <img src={photoPreview} alt="Preview" className="w-20 h-20 rounded-full object-cover" />
              ) : (
                <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center">
                  <Upload className="w-8 h-8 text-muted-foreground" />
                </div>
              )}
              <Input
                type="file"
                accept="image/*"
                onChange={handlePhotoUpload}
                className="max-w-[250px]"
              />
            </div>
          </div>

          {/* Basic Information */}
          <div className="space-y-4">
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

            <div className="grid grid-cols-2 gap-4">
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

              <FormField
                control={form.control}
                name="employeeId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Employee ID</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="XX123456" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>

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

          {/* Contact Information */}
          <div className="space-y-4">
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

            {/* Emergency Contact */}
            <div className="space-y-4 rounded-lg border p-4">
              <h3 className="font-medium">Emergency Contact</h3>
              <FormField
                control={form.control}
                name="emergencyContact.name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contact Name</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="emergencyContact.relationship"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Relationship</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="emergencyContact.phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contact Number</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>

          {/* Dates */}
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

          {/* Additional Information */}
          <div className="space-y-4">
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
              name="previousExperience"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Previous Work Experience</FormLabel>
                  <FormControl>
                    <Textarea {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="preferredLanguage"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Preferred Language</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select language" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="english">English</SelectItem>
                      <SelectItem value="hindi">Hindi</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Document Upload Section */}
          <div className="space-y-4">
            <FormLabel>Supporting Documents</FormLabel>
            <Input
              type="file"
              multiple
              accept=".pdf,.doc,.docx"
              onChange={handleDocumentUpload}
            />
            {documents.length > 0 && (
              <div className="text-sm text-muted-foreground">
                {documents.length} file(s) selected
              </div>
            )}
          </div>

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