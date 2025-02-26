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
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Loader2, AlertCircle, Pencil, Trash2 } from "lucide-react";
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
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedProcess, setSelectedProcess] = useState<any>(null);
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

  const updateProcessMutation = useMutation({
    mutationFn: async (data: z.infer<typeof processFormSchema>) => {
      const response = await fetch(`/api/organizations/${organization?.id}/settings`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'updateProcess',
          processId: selectedProcess.id,
          value: {
            ...data,
            locationId: parseInt(data.locationId, 10),
          },
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update process');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/organizations/${organization?.id}/settings`] });
      toast({
        title: "Success",
        description: "Process updated successfully",
      });
      setIsEditDialogOpen(false);
      setSelectedProcess(null);
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

  const deleteProcessMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/organizations/${organization?.id}/settings`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'deleteProcess',
          processId: selectedProcess.id,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to delete process');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/organizations/${organization?.id}/settings`] });
      toast({
        title: "Success",
        description: "Process deleted successfully",
      });
      setIsDeleteDialogOpen(false);
      setSelectedProcess(null);
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
      if (isEditDialogOpen) {
        await updateProcessMutation.mutateAsync(data);
      } else {
        await createProcessMutation.mutateAsync(data);
      }
    } catch (error) {
      console.error("Error handling process:", error);
    }
  };

  const handleEdit = (process: any) => {
    setSelectedProcess(process);
    form.reset({
      name: process.name,
      inductionDays: process.inductionDays,
      trainingDays: process.trainingDays,
      certificationDays: process.certificationDays,
      ojtDays: process.ojtDays,
      ojtCertificationDays: process.ojtCertificationDays,
      lineOfBusiness: process.lineOfBusiness,
      locationId: process.locationId.toString(),
    });
    setIsEditDialogOpen(true);
  };

  const handleDelete = (process: any) => {
    setSelectedProcess(process);
    setIsDeleteDialogOpen(true);
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

  const ProcessForm = () => (
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
                <Select onValueChange={field.onChange} value={field.value}>
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
            onClick={() => {
              setIsCreateDialogOpen(false);
              setIsEditDialogOpen(false);
              setSelectedProcess(null);
              form.reset();
            }}
          >
            Cancel
          </Button>
          <Button 
            type="submit" 
            disabled={createProcessMutation.isPending || updateProcessMutation.isPending}
          >
            {createProcessMutation.isPending || updateProcessMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {isEditDialogOpen ? "Updating..." : "Creating..."}
              </>
            ) : (
              isEditDialogOpen ? "Update Process" : "Create Process"
            )}
          </Button>
        </div>
      </form>
    </Form>
  );

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
          <ProcessForm />
        </DialogContent>
      </Dialog>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Process</DialogTitle>
          </DialogHeader>
          <ProcessForm />
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the process "{selectedProcess?.name}". This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteProcessMutation.mutate()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteProcessMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete Process"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
                    <TableHead>Actions</TableHead>
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
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(process)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(process)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
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