import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { SiReact } from "react-icons/si";
import { Label } from "@/components/ui/label";

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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
import { Plus, Loader2, Pencil, Trash, Search } from "lucide-react";

interface LineOfBusiness {
  id: number;
  name: string;
}

interface Process {
  id: number;
  name: string;
  inductionDays: number;
  trainingDays: number;
  certificationDays: number;
  ojtDays: number;
  ojtCertificationDays: number;
  lineOfBusinessId: number;
  lineOfBusinessName?: string;
  status?: string;
}

// Form schema simplified to remove location, role, and user
const processFormSchema = z.object({
  name: z.string().min(1, "Process name is required"),
  inductionDays: z.number().min(1, "Induction days must be at least 1"),
  trainingDays: z.number().min(1, "Training days must be at least 1"),
  certificationDays: z.number().min(1, "Certification days must be at least 1"),
  ojtDays: z.number().min(0, "OJT days cannot be negative"),
  ojtCertificationDays: z.number().min(0, "OJT certification days cannot be negative"),
  lineOfBusinessId: z.number().min(1, "Line of Business is required"),
});

type ProcessFormValues = z.infer<typeof processFormSchema>;

export function ProcessDetail() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedProcess, setSelectedProcess] = useState<Process | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");

  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch organization with optimized caching
  const { data: organization } = useQuery({
    queryKey: ["/api/organization"],
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
    cacheTime: 30 * 60 * 1000, // Keep in cache for 30 minutes
  });

  // Fetch line of businesses with optimized caching
  const { data: lineOfBusinesses = [], isLoading: isLoadingLOB } = useQuery({
    queryKey: [`/api/organizations/${organization?.id}/line-of-businesses`],
    enabled: !!organization?.id,
    staleTime: 5 * 60 * 1000,
    cacheTime: 30 * 60 * 1000,
  });

  // Fetch processes with optimized caching
  const { data: processes = [], isLoading: isLoadingProcesses } = useQuery({
    queryKey: [`/api/organizations/${organization?.id}/processes`],
    enabled: !!organization?.id,
    staleTime: 5 * 60 * 1000,
    cacheTime: 30 * 60 * 1000,
  });

  // Filter and pagination calculations
  const filteredProcesses = processes.filter((process: Process) => {
    const searchStr = searchQuery.toLowerCase();
    return (
      process.name.toLowerCase().includes(searchStr) ||
      (process.lineOfBusinessName || "").toLowerCase().includes(searchStr)
    );
  });

  const totalPages = Math.ceil(filteredProcesses.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedProcesses = filteredProcesses.slice(startIndex, endIndex);

  const form = useForm<ProcessFormValues>({
    resolver: zodResolver(processFormSchema),
    defaultValues: {
      name: "",
      inductionDays: 1,
      trainingDays: 1,
      certificationDays: 1,
      ojtDays: 0,
      ojtCertificationDays: 0,
      lineOfBusinessId: undefined,
    },
  });

  const editForm = useForm<ProcessFormValues>({
    resolver: zodResolver(processFormSchema),
    defaultValues: {
      name: "",
      inductionDays: 1,
      trainingDays: 1,
      certificationDays: 1,
      ojtDays: 0,
      ojtCertificationDays: 0,
      lineOfBusinessId: undefined,
    },
  });

  const createProcessMutation = useMutation({
    mutationFn: async (data: ProcessFormValues) => {
      const response = await fetch(`/api/organizations/${organization?.id}/processes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to create process");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/organizations/${organization?.id}/processes`] });
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
    mutationFn: async (data: ProcessFormValues) => {
      const response = await fetch(`/api/organizations/${organization?.id}/processes/${selectedProcess?.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to update process");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/organizations/${organization?.id}/processes`] });
      toast({
        title: "Success",
        description: "Process updated successfully",
      });
      setIsEditDialogOpen(false);
      setSelectedProcess(null);
      editForm.reset();
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
      const response = await fetch(`/api/organizations/${organization?.id}/processes/${selectedProcess?.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to delete process");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/organizations/${organization?.id}/processes`] });
      toast({
        title: "Success",
        description: "Process deleted successfully",
      });
      setIsDeleteDialogOpen(false);
      setSelectedProcess(null);
      setDeleteConfirmation("");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = async (data: ProcessFormValues) => {
    try {
      await createProcessMutation.mutateAsync(data);
    } catch (error) {
      console.error("Error creating process:", error);
    }
  };

  const onEdit = async (data: ProcessFormValues) => {
    try {
      await updateProcessMutation.mutateAsync(data);
    } catch (error) {
      console.error("Error updating process:", error);
    }
  };

  const handleEdit = (process: Process) => {
    setSelectedProcess(process);
    editForm.reset({
      name: process.name,
      inductionDays: process.inductionDays,
      trainingDays: process.trainingDays,
      certificationDays: process.certificationDays,
      ojtDays: process.ojtDays,
      ojtCertificationDays: process.ojtCertificationDays,
      lineOfBusinessId: process.lineOfBusinessId,
    });
    setIsEditDialogOpen(true);
  };

  const handleDelete = (process: Process) => {
    setSelectedProcess(process);
    setDeleteConfirmation("");
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (!selectedProcess) return;

    if (deleteConfirmation === selectedProcess.name) {
      deleteProcessMutation.mutate();
    } else {
      toast({
        title: "Error",
        description: "Please type the process name exactly as shown",
        variant: "destructive",
      });
    }
  };

  // Show loading state
  if (isLoadingLOB || isLoadingProcesses) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center space-x-2 mb-6">
        <SiReact className="h-8 w-8 text-blue-500" />
        <h1 className="text-2xl font-semibold">Manage Processes</h1>
      </div>

      {/* Search and Actions Section */}
      <Card className="border-dashed">
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search processes..."
                className="pl-8"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
              />
            </div>
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add New Process
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Process List */}
      <Card>
        <CardContent>
          {processes.length > 0 ? (
            <>
              <div className="flex items-center justify-end py-4">
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-500">Rows per page:</span>
                  <Select
                    value={pageSize.toString()}
                    onValueChange={(value) => {
                      setPageSize(parseInt(value));
                      setCurrentPage(1);
                    }}
                  >
                    <SelectTrigger className="w-[100px]">
                      <SelectValue placeholder="10" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10</SelectItem>
                      <SelectItem value="25">25</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="relative overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Process Name</TableHead>
                      <TableHead className="text-center">ID</TableHead>
                      <TableHead className="text-center">TD</TableHead>
                      <TableHead className="text-center">CD</TableHead>
                      <TableHead className="text-center">OJT</TableHead>
                      <TableHead className="text-center">OJTC</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedProcesses.map((process: Process) => (
                      <TableRow key={process.id}>
                        <TableCell className="font-medium">
                          {process.name}
                          {process.lineOfBusinessName && (
                            <span className="text-muted-foreground ml-2">
                              ({process.lineOfBusinessName})
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">{process.inductionDays}</TableCell>
                        <TableCell className="text-center">{process.trainingDays}</TableCell>
                        <TableCell className="text-center">{process.certificationDays}</TableCell>
                        <TableCell className="text-center">{process.ojtDays}</TableCell>
                        <TableCell className="text-center">{process.ojtCertificationDays}</TableCell>
                        <TableCell className="text-right space-x-2">
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => handleEdit(process)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            className="text-red-600 hover:text-red-700"
                            onClick={() => handleDelete(process)}
                          >
                            <Trash className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex items-center justify-between py-4">
                <div className="text-sm text-gray-500">
                  Showing {startIndex + 1} to {Math.min(endIndex, processes.length)} of {processes.length}{" "}
                  entries
                </div>
                <div className="space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <p className="text-muted-foreground">
              No processes found. Create a new process to get started.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Create Process Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Process</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-4">
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

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
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
                          {lineOfBusinesses.map((lob: LineOfBusiness) => (
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
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsCreateDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={createProcessMutation.isPending}>
                  {createProcessMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    "Create Process"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit Process Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Process</DialogTitle>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(onEdit)} className="space-y-4">
              <div className="space-y-4">
                {/* Same form fields as create dialog */}
                <FormField
                  control={editForm.control}
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

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {/* Same number input fields as create dialog */}
                  <FormField
                    control={editForm.control}
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
                    control={editForm.control}
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
                    control={editForm.control}
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
                    control={editForm.control}
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
                    control={editForm.control}
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
                  control={editForm.control}
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
                          {lineOfBusinesses.map((lob: LineOfBusiness) => (
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
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={updateProcessMutation.isPending}>
                  {updateProcessMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    "Update Process"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Process</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p>
              Are you sure you want to delete the process "{selectedProcess?.name}"? This action cannot be undone.
            </p>
            <div className="space-y-2">
              <Label htmlFor="confirm">Type "{selectedProcess?.name}" to confirm deletion</Label>
              <Input
                id="confirm"
                value={deleteConfirmation}
                onChange={(e) => setDeleteConfirmation(e.target.value)}
                placeholder="Type process name to confirm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsDeleteDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDeleteConfirm}
              disabled={deleteProcessMutation.isPending}
            >
              {deleteProcessMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete Process"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}