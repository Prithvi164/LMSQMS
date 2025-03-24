import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format, parseISO, isValid } from "date-fns";

// UI Components
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
// Removed tabs imports since they're no longer needed for weekly off days
import { AlertCircle, CalendarIcon, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue 
} from "@/components/ui/select";

// Define types
type OrganizationSettings = {
  id?: number;
  organizationId: number;
  createdAt?: string;
  updatedAt?: string;
};

type Location = {
  id: number;
  name: string;
};

type Holiday = {
  id: number;
  name: string;
  date: string;
  organizationId: number;
  locationId: number | null;
  isRecurring: boolean;
  createdAt: string;
  updatedAt: string;
};

// Form schemas
const holidaySchema = z.object({
  name: z.string().min(2, "Holiday name must be at least 2 characters"),
  date: z.string().refine(val => isValid(parseISO(val)), {
    message: "Please select a valid date"
  }),
  locationId: z.string().optional().transform(val => val === "all-locations" || val === "" ? null : parseInt(val)),
  isRecurring: z.boolean().default(false)
});

type HolidayForm = z.infer<typeof holidaySchema>;

export default function OrganizationSettings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isAddHolidayOpen, setIsAddHolidayOpen] = useState(false);
  const [holidayToDelete, setHolidayToDelete] = useState<Holiday | null>(null);

  // Holiday form setup
  const holidayForm = useForm<HolidayForm>({
    resolver: zodResolver(holidaySchema),
    defaultValues: {
      name: "",
      date: "",
      locationId: "",
      isRecurring: false
    }
  });

  // Query organization settings
  const {
    data: settings,
    isLoading: isLoadingSettings,
    error: settingsError
  } = useQuery({
    queryKey: [`/api/organizations/${user?.organizationId}/settings`],
    enabled: !!user?.organizationId
  });

  // Query organization locations
  const {
    data: locations,
    isLoading: isLoadingLocations
  } = useQuery({
    queryKey: ['/api/organizations', user?.organizationId, 'locations'],
    enabled: !!user?.organizationId
  });

  // Query organization holidays
  const {
    data: holidays,
    isLoading: isLoadingHolidays
  } = useQuery({
    queryKey: [`/api/organizations/${user?.organizationId}/holidays`],
    enabled: !!user?.organizationId
  });

  // Update settings form when data is loaded
  // No need for useEffect to reset weeklyOffDays form anymore

  // Create holiday mutation
  const createHolidayMutation = useMutation({
    mutationFn: async (data: HolidayForm) => {
      return apiRequest<Holiday>(
        `/api/organizations/${user?.organizationId}/holidays`,
        {
          method: "POST",
          body: JSON.stringify(data)
        }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/organizations/${user?.organizationId}/holidays`] });
      holidayForm.reset();
      setIsAddHolidayOpen(false);
      toast({
        title: "Holiday added",
        description: "The holiday has been added successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error adding holiday",
        description: error.message || "An error occurred while adding the holiday. Please try again.",
        variant: "destructive"
      });
    }
  });

  // Delete holiday mutation
  const deleteHolidayMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest(
        `/api/organizations/${user?.organizationId}/holidays/${id}`,
        {
          method: "DELETE"
        }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/organizations/${user?.organizationId}/holidays`] });
      setHolidayToDelete(null);
      toast({
        title: "Holiday deleted",
        description: "The holiday has been deleted successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error deleting holiday",
        description: error.message || "An error occurred while deleting the holiday. Please try again.",
        variant: "destructive"
      });
    }
  });

  // Form submission handlers

  const onHolidaySubmit = (data: HolidayForm) => {
    createHolidayMutation.mutate(data);
  };

  const handleDeleteHoliday = (holiday: Holiday) => {
    setHolidayToDelete(holiday);
  };

  const confirmDeleteHoliday = () => {
    if (holidayToDelete) {
      deleteHolidayMutation.mutate(holidayToDelete.id);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Organization Settings</h3>
          <p className="text-sm text-muted-foreground">
            Manage your organization's scheduling settings.
          </p>
        </div>
      </div>

      <Card className="w-full">
        <CardContent className="pt-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Holidays</CardTitle>
                  <CardDescription>
                    Manage holidays for your organization. Holidays are excluded when calculating
                    training phase durations.
                  </CardDescription>
                </div>
                <Dialog open={isAddHolidayOpen} onOpenChange={setIsAddHolidayOpen}>
                  <DialogTrigger asChild>
                    <Button>Add Holiday</Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                      <DialogTitle>Add New Holiday</DialogTitle>
                      <DialogDescription>
                        Add a new holiday to your organization's calendar.
                      </DialogDescription>
                    </DialogHeader>
                    <Form {...holidayForm}>
                      <form onSubmit={holidayForm.handleSubmit(onHolidaySubmit)} className="space-y-4">
                        <FormField
                          control={holidayForm.control}
                          name="name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Holiday Name</FormLabel>
                              <FormControl>
                                <Input placeholder="e.g. Christmas, New Year" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={holidayForm.control}
                          name="date"
                          render={({ field }) => (
                            <FormItem className="flex flex-col">
                              <FormLabel>Date</FormLabel>
                              <Popover>
                                <PopoverTrigger asChild>
                                  <FormControl>
                                    <Button
                                      variant={"outline"}
                                      className={`w-full pl-3 text-left font-normal ${
                                        !field.value ? "text-muted-foreground" : ""
                                      }`}
                                    >
                                      {field.value ? (
                                        format(new Date(field.value), "PPP")
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
                                    selected={field.value ? new Date(field.value) : undefined}
                                    onSelect={(date) => {
                                      field.onChange(date ? format(date, "yyyy-MM-dd") : "");
                                    }}
                                    initialFocus
                                  />
                                </PopoverContent>
                              </Popover>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={holidayForm.control}
                          name="locationId"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Location (Optional)</FormLabel>
                              <Select 
                                value={field.value?.toString() || ""} 
                                onValueChange={field.onChange}
                              >
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select a location" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="all-locations">All Locations</SelectItem>
                                  {locations?.map((location: Location) => (
                                    <SelectItem key={location.id} value={location.id.toString()}>
                                      {location.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormDescription>
                                If no location is selected, this holiday applies to all locations.
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={holidayForm.control}
                          name="isRecurring"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                              <FormControl>
                                <Checkbox
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                />
                              </FormControl>
                              <div className="space-y-1 leading-none">
                                <FormLabel>Recurring yearly</FormLabel>
                                <FormDescription>
                                  If checked, this holiday will be observed every year on the same date.
                                </FormDescription>
                              </div>
                            </FormItem>
                          )}
                        />
                        <DialogFooter>
                          <Button type="submit" disabled={createHolidayMutation.isPending}>
                            {createHolidayMutation.isPending ? "Adding..." : "Add Holiday"}
                          </Button>
                        </DialogFooter>
                      </form>
                    </Form>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {isLoadingHolidays ? (
                <div className="text-center py-4">Loading holidays...</div>
              ) : holidays?.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground">
                  <AlertCircle className="h-10 w-10 mx-auto mb-2" />
                  <p>No holidays have been added yet.</p>
                  <p className="text-sm">Click the "Add Holiday" button to get started.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {holidays?.map((holiday: Holiday) => (
                    <div key={holiday.id} className="flex items-center justify-between gap-4 p-4 border rounded-lg">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium">{holiday.name}</h4>
                          {holiday.isRecurring && (
                            <Badge variant="outline" className="ml-2">Yearly</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(holiday.date), "PPP")}
                        </p>
                        {holiday.locationId && locations?.find((l: Location) => l.id === holiday.locationId) && (
                          <Badge variant="secondary" className="mt-1">
                            {locations.find((l: Location) => l.id === holiday.locationId)?.name}
                          </Badge>
                        )}
                      </div>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleDeleteHoliday(holiday)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Holiday</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete "{holidayToDelete?.name}"? This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel onClick={() => setHolidayToDelete(null)}>
                              Cancel
                            </AlertDialogCancel>
                            <AlertDialogAction 
                              onClick={confirmDeleteHoliday}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </CardContent>
      </Card>
    </div>
  );
}