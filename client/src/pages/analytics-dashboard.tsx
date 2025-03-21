import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Loader2, Plus, Settings, Eye, EyeOff, Save, Trash2, MoveHorizontal } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { queryClient, apiRequest } from '@/lib/queryClient';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import RoleDistributionChart from '@/components/ui/analytics/role-distribution-chart';
import LocationDistributionMap from '@/components/ui/analytics/location-distribution-map';
import ProcessHeatmap from '@/components/ui/analytics/process-heatmap';
import TenureAnalysis from '@/components/ui/analytics/tenure-analysis';
import CapacityPlanning from '@/components/ui/analytics/capacity-planning';
import AttritionRisk from '@/components/ui/analytics/attrition-risk';
import SkillsGap from '@/components/ui/analytics/skills-gap';

// Dashboard schema for form validation
const dashboardSchema = z.object({
  name: z.string().min(1, "Dashboard name is required"),
  description: z.string().optional(),
  isDefault: z.boolean().default(false),
});

// Widget schema for form validation
const widgetSchema = z.object({
  widgetType: z.enum([
    'role_distribution', 
    'location_distribution', 
    'process_heatmap',
    'tenure_analysis',
    'capacity_planning',
    'attrition_risk',
    'skills_gap'
  ]),
  position: z.object({
    x: z.number().int().min(0),
    y: z.number().int().min(0),
    w: z.number().int().min(1),
    h: z.number().int().min(1),
  }),
  configuration: z.object({
    title: z.string().optional(),
    timeRange: z.string().optional(),
    filters: z.record(z.any()).optional(),
    chartType: z.string().optional(),
    showLegend: z.boolean().optional(),
    colorScheme: z.string().optional(),
  })
});

// Type definitions
type Dashboard = {
  id: number;
  name: string;
  description: string | null;
  isDefault: boolean;
  userId: number;
  createdAt: string;
  updatedAt: string;
  widgets?: Widget[];
};

type Widget = {
  id: number;
  dashboardId: number;
  widgetType: string;
  position: {
    x: number;
    y: number;
    w: number;
    h: number;
  };
  configuration: {
    title?: string;
    timeRange?: string;
    filters?: Record<string, any>;
    chartType?: string;
    showLegend?: boolean;
    colorScheme?: string;
  };
  createdAt: string;
  updatedAt: string;
};

type WidgetProps = {
  widget: Widget;
  onEdit: (widget: Widget) => void;
  onDelete: (widgetId: number) => void;
};

const WIDGET_TYPE_LABELS: Record<string, string> = {
  'role_distribution': 'Role Distribution',
  'location_distribution': 'Location Distribution',
  'process_heatmap': 'Process Heatmap',
  'tenure_analysis': 'Tenure Analysis',
  'capacity_planning': 'Capacity Planning',
  'attrition_risk': 'Attrition Risk',
  'skills_gap': 'Skills Gap'
};

// Default widget positions and sizes
const DEFAULT_WIDGET_CONFIG: Record<string, { w: number, h: number }> = {
  'role_distribution': { w: 6, h: 4 },
  'location_distribution': { w: 6, h: 6 },
  'process_heatmap': { w: 12, h: 6 },
  'tenure_analysis': { w: 6, h: 5 },
  'capacity_planning': { w: 12, h: 6 },
  'attrition_risk': { w: 6, h: 5 },
  'skills_gap': { w: 6, h: 5 }
};

// Widget component to render based on type
const WidgetComponent: React.FC<WidgetProps> = ({ widget, onEdit, onDelete }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Custom classes based on widget size
  const sizeClasses = isExpanded
    ? 'fixed inset-10 z-50 bg-white dark:bg-gray-900 shadow-xl rounded-lg overflow-auto'
    : 'h-full';

  const renderWidgetContent = () => {
    const { widgetType, configuration } = widget;
    const defaultTitle = WIDGET_TYPE_LABELS[widgetType] || 'Widget';
    const title = configuration.title || defaultTitle;

    switch (widgetType) {
      case 'role_distribution':
        return <RoleDistributionChart title={title} filters={configuration.filters} />;
      case 'location_distribution':
        return <LocationDistributionMap title={title} filters={configuration.filters} />;
      case 'process_heatmap':
        return <ProcessHeatmap title={title} filters={configuration.filters} />;
      case 'tenure_analysis':
        return <TenureAnalysis title={title} filters={configuration.filters} />;
      case 'capacity_planning':
        return <CapacityPlanning title={title} filters={configuration.filters} />;
      case 'attrition_risk':
        return <AttritionRisk title={title} filters={configuration.filters} />;
      case 'skills_gap':
        return <SkillsGap title={title} filters={configuration.filters} />;
      default:
        return <div>Unknown widget type: {widgetType}</div>;
    }
  };

  return (
    <Card className={`${sizeClasses}`}>
      <CardHeader className="p-4">
        <div className="flex justify-between items-center">
          <CardTitle className="text-lg">{widget.configuration.title || WIDGET_TYPE_LABELS[widget.widgetType]}</CardTitle>
          <div className="flex space-x-2">
            <Button variant="ghost" size="icon" onClick={() => setIsExpanded(!isExpanded)}>
              {isExpanded ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
            <Button variant="ghost" size="icon" onClick={() => onEdit(widget)}>
              <Settings className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => onDelete(widget.id)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        {renderWidgetContent()}
      </CardContent>
    </Card>
  );
};

export default function AnalyticsDashboard() {
  const [selectedDashboard, setSelectedDashboard] = useState<Dashboard | null>(null);
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [isCreatingDashboard, setIsCreatingDashboard] = useState(false);
  const [isAddingWidget, setIsAddingWidget] = useState(false);
  const [isEditingWidget, setIsEditingWidget] = useState(false);
  const [currentWidget, setCurrentWidget] = useState<Widget | null>(null);
  const { toast } = useToast();

  // Form for dashboard creation/editing
  const dashboardForm = useForm<z.infer<typeof dashboardSchema>>({
    resolver: zodResolver(dashboardSchema),
    defaultValues: {
      name: '',
      description: '',
      isDefault: false,
    },
  });

  // Form for widget creation/editing
  const widgetForm = useForm<z.infer<typeof widgetSchema>>({
    resolver: zodResolver(widgetSchema),
    defaultValues: {
      widgetType: 'role_distribution',
      position: { x: 0, y: 0, w: 6, h: 4 },
      configuration: {
        title: '',
        timeRange: '30d',
        filters: {},
        chartType: 'bar',
        showLegend: true,
        colorScheme: 'default',
      },
    },
  });

  // Fetch dashboards
  const { data: dashboardsData, isLoading: isDashboardsLoading, error: dashboardsError } = useQuery({
    queryKey: ['/api/dashboards'],
    refetchOnWindowFocus: false,
  });

  // Fetch current dashboard's widgets
  const { data: widgetsData, isLoading: isWidgetsLoading, error: widgetsError } = useQuery({
    queryKey: ['/api/dashboards', selectedDashboard?.id, 'widgets'],
    enabled: !!selectedDashboard,
    refetchOnWindowFocus: false,
  });

  // Create dashboard mutation
  const createDashboardMutation = useMutation({
    mutationFn: async (data: z.infer<typeof dashboardSchema>) => {
      return apiRequest('POST', '/api/dashboards', data);
    },
    onSuccess: (newDashboard) => {
      toast({
        title: "Dashboard created",
        description: `Dashboard "${newDashboard.name}" has been created successfully.`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboards'] });
      setIsCreatingDashboard(false);
      dashboardForm.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Error creating dashboard",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Create widget mutation
  const createWidgetMutation = useMutation({
    mutationFn: async (data: z.infer<typeof widgetSchema>) => {
      if (!selectedDashboard) throw new Error("No dashboard selected");
      return apiRequest('POST', `/api/dashboards/${selectedDashboard.id}/widgets`, data);
    },
    onSuccess: (newWidget) => {
      toast({
        title: "Widget added",
        description: `Widget has been added to the dashboard.`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboards', selectedDashboard?.id, 'widgets'] });
      setIsAddingWidget(false);
      widgetForm.reset({
        widgetType: 'role_distribution',
        position: { x: 0, y: 0, w: 6, h: 4 },
        configuration: {
          title: '',
          timeRange: '30d',
          filters: {},
          chartType: 'bar',
          showLegend: true,
          colorScheme: 'default',
        },
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error adding widget",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update widget mutation
  const updateWidgetMutation = useMutation({
    mutationFn: async (data: { id: number; widget: Partial<Widget> }) => {
      return apiRequest('PATCH', `/api/widgets/${data.id}`, data.widget);
    },
    onSuccess: (updatedWidget) => {
      toast({
        title: "Widget updated",
        description: `Widget has been updated successfully.`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboards', selectedDashboard?.id, 'widgets'] });
      setIsEditingWidget(false);
      setCurrentWidget(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error updating widget",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete widget mutation
  const deleteWidgetMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest('DELETE', `/api/widgets/${id}`);
    },
    onSuccess: () => {
      toast({
        title: "Widget deleted",
        description: `Widget has been deleted successfully.`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboards', selectedDashboard?.id, 'widgets'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error deleting widget",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Set default dashboard mutation
  const setDefaultDashboardMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest('POST', `/api/dashboards/${id}/default`);
    },
    onSuccess: () => {
      toast({
        title: "Default dashboard set",
        description: `The selected dashboard has been set as your default.`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboards'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error setting default dashboard",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Effect to set dashboards when data is loaded
  useEffect(() => {
    if (dashboardsData) {
      setDashboards(dashboardsData);
      
      // If no dashboard is selected, select the default one or the first one
      if (!selectedDashboard) {
        const defaultDashboard = dashboardsData.find((d: Dashboard) => d.isDefault);
        if (defaultDashboard) {
          setSelectedDashboard(defaultDashboard);
        } else if (dashboardsData.length > 0) {
          setSelectedDashboard(dashboardsData[0]);
        }
      }
    }
  }, [dashboardsData, selectedDashboard]);

  // Submit handler for dashboard creation
  const onSubmitDashboard = (data: z.infer<typeof dashboardSchema>) => {
    createDashboardMutation.mutate(data);
  };

  // Submit handler for widget creation
  const onSubmitWidget = (data: z.infer<typeof widgetSchema>) => {
    if (isEditingWidget && currentWidget) {
      updateWidgetMutation.mutate({
        id: currentWidget.id,
        widget: data,
      });
    } else {
      createWidgetMutation.mutate(data);
    }
  };

  // Handler for widget type change
  const handleWidgetTypeChange = (type: string) => {
    const config = DEFAULT_WIDGET_CONFIG[type] || { w: 6, h: 4 };
    widgetForm.setValue('position.w', config.w);
    widgetForm.setValue('position.h', config.h);
  };

  // Handler for editing a widget
  const handleEditWidget = (widget: Widget) => {
    setCurrentWidget(widget);
    widgetForm.reset({
      widgetType: widget.widgetType as any,
      position: widget.position,
      configuration: widget.configuration,
    });
    setIsEditingWidget(true);
  };

  // Handler for deleting a widget
  const handleDeleteWidget = (widgetId: number) => {
    if (confirm('Are you sure you want to delete this widget?')) {
      deleteWidgetMutation.mutate(widgetId);
    }
  };

  // Handler for setting default dashboard
  const handleSetDefaultDashboard = (dashboard: Dashboard) => {
    setDefaultDashboardMutation.mutate(dashboard.id);
  };

  if (isDashboardsLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading dashboards...</span>
      </div>
    );
  }

  if (dashboardsError) {
    return (
      <div className="flex items-center justify-center min-h-screen text-red-500">
        Error loading dashboards: {(dashboardsError as Error).message}
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Analytics Dashboard</h1>
        <div className="flex space-x-2">
          <Dialog open={isCreatingDashboard} onOpenChange={setIsCreatingDashboard}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                New Dashboard
              </Button>
            </DialogTrigger>
            <DialogContent>
              <Form {...dashboardForm}>
                <form onSubmit={dashboardForm.handleSubmit(onSubmitDashboard)}>
                  <DialogHeader>
                    <DialogTitle>Create New Dashboard</DialogTitle>
                    <DialogDescription>
                      Create a custom dashboard to organize your analytics widgets.
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-4 py-4">
                    <FormField
                      control={dashboardForm.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Name</FormLabel>
                          <FormControl>
                            <Input placeholder="My Dashboard" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={dashboardForm.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Description (Optional)</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Dashboard description..."
                              {...field}
                              value={field.value || ''}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={dashboardForm.control}
                      name="isDefault"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                          <div className="space-y-0.5">
                            <FormLabel>Set as Default</FormLabel>
                            <FormDescription>
                              Make this your default dashboard
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>

                  <DialogFooter>
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setIsCreatingDashboard(false)}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={createDashboardMutation.isPending}>
                      {createDashboardMutation.isPending && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      Create Dashboard
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>

          {dashboards.length > 0 && (
            <Select
              value={selectedDashboard?.id?.toString()}
              onValueChange={(value) => {
                const dashboard = dashboards.find(d => d.id.toString() === value);
                if (dashboard) setSelectedDashboard(dashboard);
              }}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Select Dashboard" />
              </SelectTrigger>
              <SelectContent>
                {dashboards.map((dashboard) => (
                  <SelectItem key={dashboard.id} value={dashboard.id.toString()}>
                    {dashboard.name}
                    {dashboard.isDefault && " (Default)"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {selectedDashboard && !selectedDashboard.isDefault && (
            <Button 
              variant="outline" 
              onClick={() => handleSetDefaultDashboard(selectedDashboard)}
              disabled={setDefaultDashboardMutation.isPending}
            >
              {setDefaultDashboardMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Set as Default
            </Button>
          )}
        </div>
      </div>

      {selectedDashboard ? (
        <div className="mb-6">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h2 className="text-2xl font-semibold">{selectedDashboard.name}</h2>
              {selectedDashboard.description && (
                <p className="text-muted-foreground">{selectedDashboard.description}</p>
              )}
            </div>

            <Dialog open={isAddingWidget || isEditingWidget} onOpenChange={(open) => {
              if (!open) {
                setIsAddingWidget(false);
                setIsEditingWidget(false);
                setCurrentWidget(null);
              } else if (!isEditingWidget) {
                setIsAddingWidget(open);
              }
            }}>
              <DialogTrigger asChild>
                <Button disabled={isEditingWidget}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Widget
                </Button>
              </DialogTrigger>
              <DialogContent>
                <Form {...widgetForm}>
                  <form onSubmit={widgetForm.handleSubmit(onSubmitWidget)}>
                    <DialogHeader>
                      <DialogTitle>
                        {isEditingWidget ? "Edit Widget" : "Add New Widget"}
                      </DialogTitle>
                      <DialogDescription>
                        {isEditingWidget 
                          ? "Modify the widget's settings and appearance." 
                          : "Select a widget type and configure its settings."
                        }
                      </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                      <FormField
                        control={widgetForm.control}
                        name="widgetType"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Widget Type</FormLabel>
                            <Select
                              disabled={isEditingWidget}
                              onValueChange={(value) => {
                                field.onChange(value);
                                handleWidgetTypeChange(value);
                              }}
                              defaultValue={field.value}
                              value={field.value}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select widget type" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="role_distribution">Role Distribution</SelectItem>
                                <SelectItem value="location_distribution">Location Distribution</SelectItem>
                                <SelectItem value="process_heatmap">Process Heatmap</SelectItem>
                                <SelectItem value="tenure_analysis">Tenure Analysis</SelectItem>
                                <SelectItem value="capacity_planning">Capacity Planning</SelectItem>
                                <SelectItem value="attrition_risk">Attrition Risk</SelectItem>
                                <SelectItem value="skills_gap">Skills Gap</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={widgetForm.control}
                        name="configuration.title"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Widget Title (Optional)</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder={`${WIDGET_TYPE_LABELS[widgetForm.getValues('widgetType')] || 'Widget'}`} 
                                {...field} 
                                value={field.value || ''}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={widgetForm.control}
                        name="configuration.timeRange"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Time Range</FormLabel>
                            <Select
                              onValueChange={field.onChange}
                              defaultValue={field.value}
                              value={field.value}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select time range" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="7d">Last 7 days</SelectItem>
                                <SelectItem value="30d">Last 30 days</SelectItem>
                                <SelectItem value="90d">Last 90 days</SelectItem>
                                <SelectItem value="180d">Last 180 days</SelectItem>
                                <SelectItem value="365d">Last year</SelectItem>
                                <SelectItem value="all">All time</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={widgetForm.control}
                        name="configuration.chartType"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Chart Type</FormLabel>
                            <Select
                              onValueChange={field.onChange}
                              defaultValue={field.value}
                              value={field.value}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select chart type" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="bar">Bar Chart</SelectItem>
                                <SelectItem value="line">Line Chart</SelectItem>
                                <SelectItem value="pie">Pie Chart</SelectItem>
                                <SelectItem value="area">Area Chart</SelectItem>
                                <SelectItem value="scatter">Scatter Plot</SelectItem>
                                <SelectItem value="radar">Radar Chart</SelectItem>
                                <SelectItem value="heatmap">Heatmap</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={widgetForm.control}
                        name="configuration.showLegend"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                            <div className="space-y-0.5">
                              <FormLabel>Show Legend</FormLabel>
                              <FormDescription>
                                Display a legend with the chart
                              </FormDescription>
                            </div>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={widgetForm.control}
                        name="configuration.colorScheme"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Color Scheme</FormLabel>
                            <Select
                              onValueChange={field.onChange}
                              defaultValue={field.value}
                              value={field.value}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select color scheme" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="default">Default</SelectItem>
                                <SelectItem value="blues">Blues</SelectItem>
                                <SelectItem value="greens">Greens</SelectItem>
                                <SelectItem value="oranges">Oranges</SelectItem>
                                <SelectItem value="purples">Purples</SelectItem>
                                <SelectItem value="rainbow">Rainbow</SelectItem>
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
                        onClick={() => {
                          setIsAddingWidget(false);
                          setIsEditingWidget(false);
                          setCurrentWidget(null);
                        }}
                      >
                        Cancel
                      </Button>
                      <Button 
                        type="submit" 
                        disabled={createWidgetMutation.isPending || updateWidgetMutation.isPending}
                      >
                        {(createWidgetMutation.isPending || updateWidgetMutation.isPending) && (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        )}
                        {isEditingWidget ? "Update Widget" : "Add Widget"}
                      </Button>
                    </DialogFooter>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>

          {isWidgetsLoading ? (
            <div className="flex items-center justify-center h-40">
              <Loader2 className="h-8 w-8 animate-spin" />
              <span className="ml-2">Loading widgets...</span>
            </div>
          ) : widgetsError ? (
            <div className="flex items-center justify-center h-40 text-red-500">
              Error loading widgets: {(widgetsError as Error).message}
            </div>
          ) : widgetsData && widgetsData.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 border border-dashed rounded-lg">
              <p className="text-muted-foreground mb-4">This dashboard has no widgets yet.</p>
              <Button onClick={() => setIsAddingWidget(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add Your First Widget
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {widgetsData && widgetsData.map((widget: Widget) => (
                <div 
                  key={widget.id} 
                  className="col-span-1" 
                  style={{ 
                    gridColumn: `span ${Math.min(widget.position.w, 4)}`,
                    gridRow: `span ${Math.min(widget.position.h, 3)}`,
                  }}
                >
                  <WidgetComponent 
                    widget={widget} 
                    onEdit={handleEditWidget}
                    onDelete={handleDeleteWidget}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      ) : dashboards.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 border border-dashed rounded-lg">
          <p className="text-muted-foreground mb-4">You don't have any dashboards yet.</p>
          <Button onClick={() => setIsCreatingDashboard(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Create Your First Dashboard
          </Button>
        </div>
      ) : (
        <div className="flex items-center justify-center h-40">
          <p className="text-muted-foreground">Please select a dashboard to view.</p>
        </div>
      )}
    </div>
  );
}