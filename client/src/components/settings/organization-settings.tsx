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
import { 
  AlertCircle, 
  CalendarIcon, 
  Trash2, 
  Settings, 
  BookOpen, 
  BarChart, 
  AppWindow,
  Calendar as CalendarIcon2,
  Loader2,
  Save
} from "lucide-react";
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
  featureType: 'LMS' | 'QMS' | 'BOTH';
  weeklyOffDays: string[];
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

const featureTypeSchema = z.object({
  featureType: z.enum(['LMS', 'QMS', 'BOTH'])
});

type HolidayForm = z.infer<typeof holidaySchema>;
type FeatureTypeForm = z.infer<typeof featureTypeSchema>;

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
  
  // Feature type form setup
  const featureTypeForm = useForm<FeatureTypeForm>({
    resolver: zodResolver(featureTypeSchema),
    defaultValues: {
      featureType: 'BOTH'
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
  useEffect(() => {
    if (settings?.featureType) {
      featureTypeForm.setValue('featureType', settings.featureType);
    }
  }, [settings, featureTypeForm]);
  
  // Update feature type mutation
  const updateFeatureTypeMutation = useMutation({
    mutationFn: async (data: FeatureTypeForm) => {
      return apiRequest(
        "PATCH",
        `/api/organizations/${user?.organizationId}/settings`,
        data
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/organizations/${user?.organizationId}/settings`] });
      toast({
        title: "Settings updated",
        description: "The feature type has been updated successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error updating settings",
        description: error.message || "An error occurred while updating settings. Please try again.",
        variant: "destructive"
      });
    }
  });

  // Create holiday mutation
  const createHolidayMutation = useMutation({
    mutationFn: async (data: HolidayForm) => {
      return apiRequest(
        "POST",
        `/api/organizations/${user?.organizationId}/holidays`,
        data
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
        "DELETE",
        `/api/organizations/${user?.organizationId}/holidays/${id}`
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
  
  const onFeatureTypeSubmit = (data: FeatureTypeForm) => {
    updateFeatureTypeMutation.mutate(data);
  };

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
    <div className="space-y-8">
      <div className="flex items-center justify-between border-b pb-4 mb-2">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Organization Settings</h2>
          <p className="text-muted-foreground">
            Configure your organization's appearance and scheduling preferences.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <Card className="w-full shadow-sm hover:shadow-md transition-shadow duration-200">
          <CardHeader className="bg-primary/5 rounded-t-lg">
            <div className="flex items-center space-x-2">
              <Settings className="h-5 w-5 text-primary" />
              <div>
                <CardTitle>Feature Display Configuration</CardTitle>
                <CardDescription>
                  Select which application modules to display
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            {isLoadingSettings ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : (
              <Form {...featureTypeForm}>
                <form onSubmit={featureTypeForm.handleSubmit(onFeatureTypeSubmit)} className="space-y-4">
                  <FormField
                    control={featureTypeForm.control}
                    name="featureType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-base">Application Mode</FormLabel>
                        <Select 
                          value={field.value}
                          onValueChange={field.onChange}
                        >
                          <FormControl>
                            <SelectTrigger className="h-12">
                              <SelectValue placeholder="Select a feature type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="LMS" className="flex items-center py-2">
                              <div className="flex items-center">
                                <BookOpen className="h-4 w-4 mr-2 text-blue-500" />
                                <span>LMS Only (Learning Management)</span>
                              </div>
                            </SelectItem>
                            <SelectItem value="QMS" className="flex items-center py-2">
                              <div className="flex items-center">
                                <BarChart className="h-4 w-4 mr-2 text-green-500" />
                                <span>QMS Only (Quality Management)</span>
                              </div>
                            </SelectItem>
                            <SelectItem value="BOTH" className="flex items-center py-2">
                              <div className="flex items-center">
                                <AppWindow className="h-4 w-4 mr-2 text-purple-500" />
                                <span>Both LMS and QMS</span>
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          This controls which modules and features appear in the navigation sidebar.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="pt-2">
                    <Button 
                      type="submit" 
                      className="w-full md:w-auto"
                      disabled={updateFeatureTypeMutation.isPending}
                    >
                      {updateFeatureTypeMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="mr-2 h-4 w-4" />
                          Save Configuration
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              </Form>
            )}
          </CardContent>
        </Card>
        
        <Card className="w-full shadow-sm hover:shadow-md transition-shadow duration-200">
          <CardHeader className="bg-primary/5 rounded-t-lg">
            <div className="flex items-center space-x-2">
              <CalendarIcon2 className="h-5 w-5 text-primary" />
              <div>
                <CardTitle>Holiday Management</CardTitle>
                <CardDescription>
                  Configure holidays and non-working days
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-muted-foreground">
                Holidays are excluded when calculating training phase durations.
              </p>
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
      </div>
    </div>
  );
}