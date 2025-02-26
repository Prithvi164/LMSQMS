import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Loader2, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

const processFormSchema = z.object({
  name: z.string().min(1, "Process name is required"),
  inductionDays: z.number().min(1, "Induction days must be at least 1"),
  trainingDays: z.number().min(1, "Training days must be at least 1"),
  certificationDays: z.number().min(1, "Certification days must be at least 1"),
  ojtDays: z.number().min(0, "OJT days cannot be negative"),
  ojtCertificationDays: z.number().min(0, "OJT certification days cannot be negative"),
  lineOfBusiness: z.string().min(1, "Line of business is required"),
  locationId: z.string().min(1, "Location is required"),
});

const lineOfBusinessOptions = [
  { value: "customer-support", label: "Customer Support" },
  { value: "technical-support", label: "Technical Support" },
  { value: "sales", label: "Sales" }
];

export function ProcessDetail() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const { data: organization, isLoading: orgLoading } = useQuery({
    queryKey: ["/api/organization"],
    enabled: !!user,
  });

  const { data: orgSettings, isLoading: settingsLoading } = useQuery({
    queryKey: [`/api/organizations/${organization?.id}/settings`],
    queryFn: async () => {
      if (!organization?.id) return null;
      const res = await fetch(`/api/organizations/${organization.id}/settings`);
      if (!res.ok) throw new Error('Failed to fetch organization settings');
      return res.json();
    },
    enabled: !!organization?.id,
  });

  const form = useForm<z.infer<typeof processFormSchema>>({
    resolver: zodResolver(processFormSchema),
    defaultValues: {
      inductionDays: 1,
      trainingDays: 1,
      certificationDays: 1,
      ojtDays: 0,
      ojtCertificationDays: 0,
    },
  });

  const createProcessMutation = useMutation({
    mutationFn: async (data: z.infer<typeof processFormSchema>) => {
      const response = await fetch(`/api/organizations/${organization?.id}/settings`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'processNames',
          value: {
            ...data,
            locationId: parseInt(data.locationId, 10),
          },
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create process');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/organizations/${organization?.id}/settings`] });
      toast({
        title: "Success",
        description: "Process created successfully",
      });
      setIsCreateDialogOpen(false);
      form.reset();
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

  if (orgLoading || settingsLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const locations = orgSettings?.locations || [];
  const processes = orgSettings?.processes || [];
  const hasLocations = locations.length > 0;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Process Details</h2>
        <Button onClick={() => setIsCreateDialogOpen(true)} disabled={!hasLocations}>
          <Plus className="h-4 w-4 mr-2" />
          Add New Process
        </Button>
      </div>

      {!hasLocations && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            No locations are available. Please add locations first before creating a process.
          </AlertDescription>
        </Alert>
      )}

      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create New Process</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
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
                  name="lineOfBusiness"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Line of Business</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select LOB" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {lineOfBusinessOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
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
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select Location" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {hasLocations ? (
                            locations.map((location) => (
                              <SelectItem key={location.id} value={location.id.toString()}>
                                {location.name}
                              </SelectItem>
                            ))
                          ) : (
                            <SelectItem value="no-locations" disabled>
                              Please add locations first
                            </SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="inductionDays"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Induction Days</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
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
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value, 10))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="flex justify-end gap-4">
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => setIsCreateDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={createProcessMutation.isPending}>
                  {createProcessMutation.isPending ? "Creating..." : "Create Process"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <CardTitle>Current Processes</CardTitle>
        </CardHeader>
        <CardContent>
          {processes?.length > 0 ? (
            <div className="relative overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Process Name</TableHead>
                    <TableHead>Line of Business</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Induction Days</TableHead>
                    <TableHead>Training Days</TableHead>
                    <TableHead>Certification Days</TableHead>
                    <TableHead>OJT Days</TableHead>
                    <TableHead>OJT Certification Days</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {processes.map((process) => (
                    <TableRow key={process.id}>
                      <TableCell className="font-medium">{process.name}</TableCell>
                      <TableCell>{process.lineOfBusiness}</TableCell>
                      <TableCell>
                        {locations?.find(l => l.id === process.locationId)?.name}
                      </TableCell>
                      <TableCell>{process.inductionDays}</TableCell>
                      <TableCell>{process.trainingDays}</TableCell>
                      <TableCell>{process.certificationDays}</TableCell>
                      <TableCell>{process.ojtDays}</TableCell>
                      <TableCell>{process.ojtCertificationDays}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-muted-foreground">No processes found. Create a new process to get started.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}