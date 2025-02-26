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
import { Plus, Loader2, Pencil, Trash } from "lucide-react";

const lobFormSchema = z.object({
  name: z.string().min(1, "LOB name is required"),
  description: z.string().min(1, "Description is required"),
});

const deleteConfirmationSchema = z.object({
  confirmText: z.string().refine((val) => val === `delete-${Date.now()}`, {
    message: "Please type the confirmation text exactly as shown above"
  })
});

export function LobDetail() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedLob, setSelectedLob] = useState<any>(null);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState("");
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
    setDeleteConfirmationText(`delete-${Date.now()}`);
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
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Line of Business Details</h2>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add New LOB
        </Button>
      </div>

      {/* Create LOB Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl mb-6">Create Line of Business</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>LOB Details</CardTitle>
                </CardHeader>
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
                <CardHeader>
                  <CardTitle>LOB Details</CardTitle>
                </CardHeader>
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

      {/* LOB List Section */}
      <Card>
        <CardHeader>
          <CardTitle>Current Line of Business</CardTitle>
        </CardHeader>
        <CardContent>
          {lobs?.length > 0 ? (
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
                  {lobs.map((lob: any) => (
                    <TableRow key={lob.id}>
                      <TableCell className="font-medium">{lob.name}</TableCell>
                      <TableCell>{lob.description}</TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => handleEdit(lob)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          className="text-red-600 hover:text-red-700"
                          onClick={() => handleDelete(lob)}
                        >
                          <Trash className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-muted-foreground">No line of business found. Create a new LOB to get started.</p>
          )}
        </CardContent>
      </Card>

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
              disabled={deleteForm.formState.isValid === false || deleteLobMutation.isPending}
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