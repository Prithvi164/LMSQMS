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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Loader2, Edit, Trash2, Search } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";

const lobFormSchema = z.object({
  name: z.string().min(1, "LOB name is required"),
  description: z.string().min(1, "Description is required"),
});

const deleteConfirmationSchema = z.object({
  confirmText: z.string()
});

export function LobDetail() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedLob, setSelectedLob] = useState<any>(null);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [searchQuery, setSearchQuery] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // First fetch organization
  const { data: organization } = useQuery({
    queryKey: ["/api/organization"],
    enabled: !!user,
  });

  // Then fetch organization line of businesses
  const { data: lobs, isLoading } = useQuery({
    queryKey: [`/api/organizations/${organization?.id}/line-of-businesses`],
    queryFn: async () => {
      if (!organization?.id) return null;
      const res = await fetch(`/api/organizations/${organization.id}/line-of-businesses`);
      if (!res.ok) throw new Error('Failed to fetch line of businesses');
      return res.json();
    },
    enabled: !!organization?.id,
  });

  const form = useForm<z.infer<typeof lobFormSchema>>({
    resolver: zodResolver(lobFormSchema),
    defaultValues: {
      name: "",
      description: "",
    },
  });

  const editForm = useForm<z.infer<typeof lobFormSchema>>({
    resolver: zodResolver(lobFormSchema),
    defaultValues: {
      name: "",
      description: "",
    },
  });

  const deleteForm = useForm<z.infer<typeof deleteConfirmationSchema>>({
    resolver: zodResolver(deleteConfirmationSchema),
    defaultValues: {
      confirmText: "",
    },
  });

  // Filter and pagination calculations
  const filteredLobs = lobs?.filter((lob: any) => {
    const searchStr = searchQuery.toLowerCase();
    return (
      lob.name.toLowerCase().includes(searchStr) ||
      lob.description.toLowerCase().includes(searchStr)
    );
  }) || [];

  const totalPages = Math.ceil(filteredLobs.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedLobs = filteredLobs.slice(startIndex, endIndex);

  const createLobMutation = useMutation({
    mutationFn: async (data: z.infer<typeof lobFormSchema>) => {
      const response = await fetch(`/api/organizations/${organization?.id}/line-of-businesses`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create LOB');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/organizations/${organization?.id}/line-of-businesses`] });
      toast({
        title: "Success",
        description: "Line of Business created successfully",
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

  const updateLobMutation = useMutation({
    mutationFn: async (data: z.infer<typeof lobFormSchema>) => {
      const response = await fetch(`/api/organizations/${organization?.id}/line-of-businesses/${selectedLob.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update LOB');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/organizations/${organization?.id}/line-of-businesses`] });
      toast({
        title: "Success",
        description: "Line of Business updated successfully",
      });
      setIsEditDialogOpen(false);
      setSelectedLob(null);
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

  const deleteLobMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/organizations/${organization?.id}/line-of-businesses/${selectedLob.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to delete LOB');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/organizations/${organization?.id}/line-of-businesses`] });
      toast({
        title: "Success",
        description: "Line of Business deleted successfully",
      });
      setIsDeleteDialogOpen(false);
      setSelectedLob(null);
      setDeleteConfirmationText("");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = async (data: z.infer<typeof lobFormSchema>) => {
    try {
      await createLobMutation.mutateAsync(data);
    } catch (error) {
      console.error("Error creating LOB:", error);
    }
  };

  const onEdit = async (data: z.infer<typeof lobFormSchema>) => {
    try {
      await updateLobMutation.mutateAsync(data);
    } catch (error) {
      console.error("Error updating LOB:", error);
    }
  };

  const handleEdit = (lob: any) => {
    setSelectedLob(lob);
    editForm.reset({
      name: lob.name,
      description: lob.description,
    });
    setIsEditDialogOpen(true);
  };

  const handleDelete = (lob: any) => {
    setSelectedLob(lob);
    setDeleteConfirmationText(`delete-${lob.name}`);
    setIsDeleteDialogOpen(true);
  };

  if (isLoading) {
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
          {/* Header Section */}
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2">
              <SiReact className="h-5 w-5 text-purple-500" />
              <h2 className="text-lg font-semibold">Manage Line of Business</h2>
            </div>
            <div className="flex items-center gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search LOBs..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="pl-9 w-[250px] focus:border-purple-500"
                />
              </div>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      onClick={() => setIsCreateDialogOpen(true)}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add New LOB
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    Add a new line of business
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>

          {/* Separator between header and content */}
          <Separator className="my-4" />

          {/* LOB List Section */}
          {lobs?.length > 0 ? (
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
                      <TableHead>LOB Name</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedLobs.map((lob: any) => (
                      <TableRow key={lob.id}>
                        <TableCell className="font-medium">{lob.name}</TableCell>
                        <TableCell>{lob.description}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end space-x-2">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleEdit(lob)}
                                    className="h-7 w-7 p-0 text-blue-600"
                                  >
                                    <Edit className="h-4 w-4" />
                                    <span className="sr-only">Edit LOB</span>
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent side="top">
                                  <p>Edit Line of Business</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                            
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleDelete(lob)}
                                    className="h-7 w-7 p-0 text-destructive"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                    <span className="sr-only">Delete LOB</span>
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent side="top">
                                  <p>Delete Line of Business</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex items-center justify-between py-4">
                <div className="text-sm text-gray-500">
                  Showing {startIndex + 1} to {Math.min(endIndex, filteredLobs.length)} of {filteredLobs.length} entries
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
            <p className="text-muted-foreground">No line of business found. Create a new LOB to get started.</p>
          )}
        </CardContent>
      </Card>

      {/* Create LOB Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl mb-6">Create Line of Business</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <Card>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>LOB NAME</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter LOB name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>DESCRIPTION</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter LOB description" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>

              <div className="flex justify-end">
                <Button
                  type="submit"
                  className="bg-purple-600 hover:bg-purple-700"
                  disabled={createLobMutation.isPending}
                >
                  {createLobMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    "Submit"
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit LOB Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl mb-6">Edit Line of Business</DialogTitle>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(onEdit)} className="space-y-6">
              <Card>
                <CardContent className="space-y-4">
                  <FormField
                    control={editForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>LOB NAME</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter LOB name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={editForm.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>DESCRIPTION</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter LOB description" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>

              <div className="flex justify-end">
                <Button
                  type="submit"
                  className="bg-purple-600 hover:bg-purple-700"
                  disabled={updateLobMutation.isPending}
                >
                  {updateLobMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    "Update"
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Delete Line of Business</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              This action cannot be undone. Please type{" "}
              <span className="font-mono text-primary">{deleteConfirmationText}</span> to confirm.
            </p>
            <Input
              className="font-mono"
              placeholder="Type delete confirmation"
              value={deleteForm.watch("confirmText")}
              onChange={(e) => deleteForm.setValue("confirmText", e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => setIsDeleteDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleteForm.watch("confirmText") !== deleteConfirmationText || deleteLobMutation.isPending}
              onClick={async () => {
                try {
                  await deleteLobMutation.mutateAsync();
                } catch (error) {
                  console.error("Error deleting LOB:", error);
                }
              }}
            >
              {deleteLobMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete Line of Business"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}