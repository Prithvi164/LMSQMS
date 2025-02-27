import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { SiReact } from "react-icons/si";

import { Card, CardContent } from "@/components/ui/card";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHead,
  TableRow,
} from "@/components/ui/table";
import { Plus, Loader2, Pencil, Trash2, Settings, Search, UsersIcon } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";


const processFormSchema = z.object({
  name: z.string().min(1, "Process name is required"),
  inductionDays: z.number().min(0, "Induction days cannot be negative"),
  trainingDays: z.number().min(0, "Training days cannot be negative"),
  certificationDays: z.number().min(0, "Certification days cannot be negative"),
  ojtDays: z.number().min(0, "OJT days cannot be negative"),
  ojtCertificationDays: z.number().min(0, "OJT certification days cannot be negative"),
  lineOfBusinessId: z.string().min(1, "Line of business is required"),
  locationId: z.string().min(1, "Location is required"),
});

export function ProcessDetail() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedProcess, setSelectedProcess] = useState<any>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [searchQuery, setSearchQuery] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const { data: organization } = useQuery({
    queryKey: ["/api/organization"],
    enabled: !!user,
  });

  const { data: orgSettings, isLoading } = useQuery({
    queryKey: [`/api/organizations/${organization?.id}/settings`],
    queryFn: async () => {
      if (!organization?.id) return null;
      const res = await fetch(`/api/organizations/${organization.id}/settings`);
      if (!res.ok) throw new Error('Failed to fetch organization settings');
      return res.json();
    },
    enabled: !!organization?.id,
  });

  // Fetch organization's line of businesses
  const { data: lineOfBusinesses } = useQuery({
    queryKey: [`/api/organizations/${organization?.id}/line-of-businesses`],
    queryFn: async () => {
      if (!organization?.id) return null;
      const res = await fetch(`/api/organizations/${organization.id}/line-of-businesses`);
      if (!res.ok) throw new Error('Failed to fetch line of businesses');
      return res.json();
    },
    enabled: !!organization?.id,
  });


  const form = useForm<z.infer<typeof processFormSchema>>({
    resolver: zodResolver(processFormSchema),
    defaultValues: {
      name: "",
      inductionDays: 0,
      trainingDays: 0,
      certificationDays: 0,
      ojtDays: 0,
      ojtCertificationDays: 0,
      lineOfBusinessId: "",
      locationId: "",
    },
  });

  const editForm = useForm<z.infer<typeof processFormSchema>>({
    resolver: zodResolver(processFormSchema),
    defaultValues: {
      name: "",
      inductionDays: 0,
      trainingDays: 0,
      certificationDays: 0,
      ojtDays: 0,
      ojtCertificationDays: 0,
      lineOfBusinessId: "",
      locationId: "",
    },
  });

  const editProcessMutation = useMutation({
    mutationFn: async (data: z.infer<typeof processFormSchema>) => {
      const response = await fetch(
        `/api/organizations/${organization?.id}/processes/${selectedProcess.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: data.name,
            inductionDays: data.inductionDays,
            trainingDays: data.trainingDays,
            certificationDays: data.certificationDays,
            ojtDays: data.ojtDays,
            ojtCertificationDays: data.ojtCertificationDays,
            lineOfBusinessId: parseInt(data.lineOfBusinessId, 10),
            locationId: parseInt(data.locationId, 10),
          }),
        }
      );

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
    mutationFn: async (processId: number) => {
      const response = await fetch(`/api/organizations/${organization?.id}/processes/${processId}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error('Failed to delete process');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/organizations/${organization?.id}/settings`] });
      toast({
        title: "Success",
        description: "Process deleted successfully",
      });
      setDeleteDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const createProcessMutation = useMutation({
    mutationFn: async (data: z.infer<typeof processFormSchema>) => {
      const selectedLob = lineOfBusinesses?.find(lob => lob.id === parseInt(data.lineOfBusinessId));

      if (!selectedLob) {
        throw new Error('Selected Line of Business not found');
      }

      const response = await fetch(`/api/organizations/${organization?.id}/processes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.name,
          inductionDays: data.inductionDays,
          trainingDays: data.trainingDays,
          certificationDays: data.certificationDays,
          ojtDays: data.ojtDays,
          ojtCertificationDays: data.ojtCertificationDays,
          lineOfBusiness: selectedLob.name,
          lineOfBusinessId: parseInt(data.lineOfBusinessId),
          locationId: parseInt(data.locationId),
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

  const onEdit = async (data: z.infer<typeof processFormSchema>) => {
    try {
      await editProcessMutation.mutateAsync(data);
    } catch (error) {
      console.error("Error updating process:", error);
    }
  };

  const handleDelete = async (process: any) => {
    setSelectedProcess(process);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    const expectedConfirmation = `delete-${selectedProcess.name.toLowerCase()}`;
    if (deleteConfirmation.toLowerCase() === expectedConfirmation) {
      deleteProcessMutation.mutate(selectedProcess.id);
    } else {
      toast({
        title: "Error",
        description: "Please type the correct confirmation text",
        variant: "destructive",
      });
    }
  };

  const handleEdit = (process: any) => {
    setSelectedProcess(process);
    editForm.reset({
      name: process.name,
      lineOfBusinessId: process.lineOfBusinessId ? process.lineOfBusinessId.toString() : "",
      locationId: process.locationId ? process.locationId.toString() : "",
      inductionDays: process.inductionDays,
      trainingDays: process.trainingDays,
      certificationDays: process.certificationDays,
      ojtDays: process.ojtDays,
      ojtCertificationDays: process.ojtCertificationDays,
    });
    setIsEditDialogOpen(true);
  };

  const apiRequest = async (method: string, url: string, body?: any) => {
    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || `API request failed: ${response.status}`);
    }
    return response.json();
  };


  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const locations = orgSettings?.locations || [];
  const processes = orgSettings?.processes || [];
  const users = orgSettings?.users || []; // Added to access user data

  // Filter processes based on search query
  const filteredProcesses = processes.filter((process: any) => {
    const searchStr = searchQuery.toLowerCase();
    const lobName = lineOfBusinesses?.find(lob => lob.id === process.lineOfBusinessId)?.name || "";
    const locationName = locations?.find(l => l.id === process.locationId)?.name || "";

    return (
      process.name.toLowerCase().includes(searchStr) ||
      lobName.toLowerCase().includes(searchStr) ||
      locationName.toLowerCase().includes(searchStr)
    );
  });

  // Add pagination calculations
  const totalPages = Math.ceil(filteredProcesses.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedProcesses = filteredProcesses.slice(startIndex, endIndex);

  return (
    <div className="space-y-4">
      <div className="flex items-center space-x-2 mb-6">
        <SiReact className="h-8 w-8 text-blue-500" />
        <h1 className="text-2xl font-semibold">Manage Process</h1>
      </div>

      <Card className="overflow-hidden border-none shadow-lg">
        <CardContent className="p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center mb-6">
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
            <Button
              onClick={() => setIsCreateDialogOpen(true)}
              className="bg-purple-600 hover:bg-purple-700 transition-colors"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add New Process
            </Button>
          </div>

          {processes?.length > 0 ? (
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
                      <SelectItem value="50">50</SelectItem>
                      <SelectItem value="100">100</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="relative overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs font-medium uppercase">Process Name</TableHead>
                      <TableHead className="text-xs font-medium uppercase">Line of Business</TableHead>
                      <TableHead className="text-xs font-medium uppercase">Location</TableHead>
                      <TableHead className="text-xs font-medium uppercase">Induction Days</TableHead>
                      <TableHead className="text-xs font-medium uppercase">Training Days</TableHead>
                      <TableHead className="text-xs font-medium uppercase">Certification Days</TableHead>
                      <TableHead className="text-xs font-medium uppercase">OJT Days</TableHead>
                      <TableHead className="text-xs font-medium uppercase">OJT Certification Days</TableHead>
                      <TableHead className="text-xs font-medium uppercase">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedProcesses.map((process) => (
                      <TableRow key={process.id}>
                        <TableCell className="text-sm">{process.name}</TableCell>
                        <TableCell className="text-sm">
                          {lineOfBusinesses?.find(lob => lob.id === process.lineOfBusinessId)?.name || process.lineOfBusiness}
                        </TableCell>
                        <TableCell className="text-sm">
                          {locations?.find(l => l.id === process.locationId)?.name}
                        </TableCell>
                        <TableCell className="text-sm">{process.inductionDays}</TableCell>
                        <TableCell className="text-sm">{process.trainingDays}</TableCell>
                        <TableCell className="text-sm">{process.certificationDays}</TableCell>
                        <TableCell className="text-sm">{process.ojtDays}</TableCell>
                        <TableCell className="text-sm">{process.ojtCertificationDays}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEdit(process)}
                              className="h-8 w-8 text-purple-600 hover:text-purple-700"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(process)}
                              className="h-8 w-8 text-red-500 hover:text-red-700"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex items-center justify-between py-4">
                <div className="text-sm text-gray-500">
                  Showing {startIndex + 1} to {Math.min(endIndex, filteredProcesses.length)} of {filteredProcesses.length} entries
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
            <p className="text-center text-muted-foreground">No processes found.</p>
          )}
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <UsersIcon className="h-5 w-5 text-muted-foreground" />
              <h2 className="text-xl font-semibold">Process Users</h2>
            </div>
            <Dialog>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Assign Users
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                  <DialogTitle>Assign Users to Process</DialogTitle>
                  <DialogDescription>
                    Select users to assign to this process. Only users with appropriate roles can be assigned.
                  </DialogDescription>
                </DialogHeader>

                <ScrollArea className="h-[300px] w-full rounded-md border p-4">
                  <div className="space-y-4">
                    {users?.map((user:any) => {
                      // Only show users that can be assigned to processes (e.g., trainers, trainees)
                      if (!["trainer", "trainee", "team_lead"].includes(user.role)) return null;

                      const isAssigned = user.processId === selectedProcess?.id;

                      return (
                        <div
                          key={user.id}
                          className="flex items-center justify-between p-2 hover:bg-accent rounded-lg"
                        >
                          <div className="flex items-center gap-3">
                            <Avatar className="h-9 w-9">
                              <AvatarFallback>
                                {user.fullName?.[0] || user.username[0]}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium">{user.fullName || user.username}</p>
                              <p className="text-sm text-muted-foreground">
                                <Badge variant="outline" className="mr-2">
                                  {user.role}
                                </Badge>
                                {user.employeeId}
                              </p>
                            </div>
                          </div>
                          <Button
                            variant={isAssigned ? "destructive" : "outline"}
                            size="sm"
                            onClick={async () => {
                              try {
                                if (isAssigned) {
                                  await apiRequest(
                                    "DELETE",
                                    `/api/organizations/${organization?.id}/processes/${selectedProcess?.id}/users/${user.id}`
                                  );
                                } else {
                                  await apiRequest(
                                    "POST",
                                    `/api/organizations/${organization?.id}/processes/${selectedProcess?.id}/users`,
                                    { userId: user.id }
                                  );
                                }

                                queryClient.invalidateQueries({
                                  queryKey: [`/api/organizations/${organization?.id}/settings`]
                                });

                                toast({
                                  title: "Success",
                                  description: `User ${isAssigned ? "removed from" : "assigned to"} process successfully`,
                                });
                              } catch (error) {
                                toast({
                                  title: "Error",
                                  description: "Failed to update user assignment",
                                  variant: "destructive",
                                });
                              }
                            }}
                          >
                            {isAssigned ? "Remove" : "Assign"}
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {users?.filter(user => user.processId === selectedProcess?.id).map((user:any) => (
              <Card key={user.id} className="bg-muted/50">
                <CardContent className="flex items-center gap-4 p-4">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback>
                      {user.fullName?.[0] || user.username[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">{user.fullName || user.username}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline">{user.role}</Badge>
                      {user.employeeId && (
                        <span className="text-xs text-muted-foreground">
                          ID: {user.employeeId}
                        </span>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Process</DialogTitle>
            <DialogDescription className="pt-4">
              This action cannot be undone. Please type{" "}
              <span className="font-medium">delete-{selectedProcess?.name.toLowerCase()}</span>{" "}
              to confirm.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              placeholder="Type delete confirmation"
              value={deleteConfirmation}
              onChange={(e) => setDeleteConfirmation(e.target.value)}
              className="mt-4"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteDialogOpen(false);
                setDeleteConfirmation("");
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
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
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Process</DialogTitle>
            <DialogDescription>Fill in the details below to create a new process.</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-medium uppercase">Process Name</FormLabel>
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
                      <FormLabel className="text-xs font-medium uppercase">Line of Business</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select Line of Business" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {lineOfBusinesses?.map((lob: any) => (
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

                <FormField
                  control={form.control}
                  name="locationId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-medium uppercase">Location</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select Location" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {locations.map((location) => (
                            <SelectItem key={location.id} value={location.id.toString()}>
                              {location.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="col-span-2">
                  <div className="grid grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="inductionDays"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-medium uppercase">Induction Days</FormLabel>
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
                          <FormLabel className="text-xs font-medium uppercase">Training Days</FormLabel>
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
                          <FormLabel className="text-xs font-medium uppercase">Certification Days</FormLabel>
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
                </div>

                <div className="col-span-2">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="ojtDays"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-medium uppercase">OJT Days</FormLabel>
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
                          <FormLabel className="text-xs font-medium uppercase">OJT Certification Days</FormLabel>
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
                </div>
              </div>

              <DialogFooter className="mt-6">
                <Button
                  variant="outline"
                  onClick={() => setIsCreateDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="bg-purple-600 hover:bg-purple-700"
                  disabled={createProcessMutation.isPending}
                >
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
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Process</DialogTitle>
            <DialogDescription>Update the process details below.</DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(onEdit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={editForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-medium uppercase">Process Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter process name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={editForm.control}
                  name="lineOfBusinessId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-medium uppercase">Line of Business</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select Line of Business" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {lineOfBusinesses?.map((lob: any) => (
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

                <FormField
                  control={editForm.control}
                  name="locationId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-medium uppercase">Location</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select Location" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {locations.map((location) => (
                            <SelectItem key={location.id} value={location.id.toString()}>
                              {location.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="col-span-2">
                  <div className="grid grid-cols-3 gap-4">
                    <FormField
                      control={editForm.control}
                      name="inductionDays"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-medium uppercase">Induction Days</FormLabel>
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
                      control={editForm.control}
                      name="trainingDays"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-medium uppercase">Training Days</FormLabel>
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
                      control={editForm.control}
                      name="certificationDays"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-medium uppercase">Certification Days</FormLabel>
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
                </div>

                <div className="col-span-2">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={editForm.control}
                      name="ojtDays"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-medium uppercase">OJT Days</FormLabel>
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
                      control={editForm.control}
                      name="ojtCertificationDays"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-medium uppercase">OJT Certification Days</FormLabel>
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
                </div>
              </div>

              <DialogFooter className="mt-6">
                <Button
                  variant="outline"
                  onClick={() => setIsEditDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="bg-purple-600 hover:bg-purple-700"
                  disabled={editProcessMutation.isPending}
                >
                  {editProcessMutation.isPending ? (
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
    </div>
  );
}