import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";
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
import { Plus, Loader2, Edit, Trash2, Search } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";

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

// Form schema updated to allow 0 days
const processFormSchema = z.object({
  name: z.string().min(1, "Process name is required"),
  inductionDays: z.number().min(0, "Induction days cannot be negative"),
  trainingDays: z.number().min(0, "Training days cannot be negative"),
  certificationDays: z.number().min(0, "Certification days cannot be negative"),
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
  const { hasPermission } = usePermissions();
  const queryClient = useQueryClient();
  
  // Check if user has permission to manage processes
  const canManageProcesses = hasPermission("manage_processes");

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
      inductionDays: 0,
      trainingDays: 0,
      certificationDays: 0,
      ojtDays: 0,
      ojtCertificationDays: 0,
      lineOfBusinessId: undefined,
    },
  });

  const editForm = useForm<ProcessFormValues>({
    resolver: zodResolver(processFormSchema),
    defaultValues: {
      name: "",
      inductionDays: 0,
      trainingDays: 0,
      certificationDays: 0,
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
      <Card className="overflow-hidden border-none shadow-lg">
        <CardContent className="p-6">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-2">
              <SiReact className="h-5 w-5 text-purple-500" />
              <h2 className="text-lg font-semibold">Manage Processes</h2>
            </div>
            <div className="flex items-center gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search processes..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="pl-9 w-[250px] focus:border-purple-500"
                />
              </div>
              {canManageProcesses && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        onClick={() => setIsCreateDialogOpen(true)}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add New Process
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      Add a new process
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
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
                      <TableHead>Line of Business</TableHead>
                      <TableHead className="text-center">Induction Days</TableHead>
                      <TableHead className="text-center">Training Days</TableHead>
                      <TableHead className="text-center">Certification Days</TableHead>
                      <TableHead className="text-center">OJT Days</TableHead>
                      <TableHead className="text-center">OJT Cert Days</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedProcesses.map((process: Process) => (
                      <TableRow key={process.id}>
                        <TableCell className="font-medium">
                          {process.name}
                        </TableCell>
                        <TableCell>
                          {lineOfBusinesses.find(lob => lob.id === process.lineOfBusinessId)?.name || "-"}
                        </TableCell>
                        <TableCell className="text-center">{process.inductionDays}</TableCell>
                        <TableCell className="text-center">{process.trainingDays}</TableCell>
                        <TableCell className="text-center">{process.certificationDays}</TableCell>
                        <TableCell className="text-center">{process.ojtDays}</TableCell>
                        <TableCell className="text-center">{process.ojtCertificationDays}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end space-x-2">
                            {canManageProcesses && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => handleEdit(process)}
                                      className="h-7 w-7 p-0 text-blue-600"
                                    >
                                      <Edit className="h-4 w-4" />
                                      <span className="sr-only">Edit Process</span>
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent side="top">
                                    <p>Edit Process</p>
                                  </TooltipContent>
                                </Tooltip>
                                
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => handleDelete(process)}
                                      className="h-7 w-7 p-0 text-destructive"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                      <span className="sr-only">Delete Process</span>
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent side="top">
                                    <p>Delete Process</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                          </div>
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
                {/* Process Name and Line of Business in the same row */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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

                {/* Days input fields in a grid */}
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
                    name="trainingDays"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Training Days</FormLabel>
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
                    name="certificationDays"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Certification Days</FormLabel>
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
                    name="trainingDays"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Training Days</FormLabel>
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
                    name="certificationDays"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Certification Days</FormLabel>
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
                {canManageProcesses ? (
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
                ) : (
                  <Button type="button" disabled>
                    Insufficient Permissions
                  </Button>
                )}
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