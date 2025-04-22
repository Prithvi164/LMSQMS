import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  ArrowDown, 
  ChevronDown, 
  Filter, 
  LayoutDashboard, 
  Plus, 
  Save, 
  Settings, 
  Trash 
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { WidgetFactory } from "./widget-factory";
import { WidgetType, widgetConfigurations } from "./widget-registry";

// Types
type Batch = {
  id: number;
  name: string;
  status: string;
  startDate: string;
  endDate: string;
  location?: {
    name: string;
  };
  process?: {
    name: string;
  };
  lineOfBusiness?: {
    name: string;
  };
};

// Widget configuration type
export interface WidgetConfig {
  id: string;
  type: WidgetType;
  title: string;
  size: "sm" | "md" | "lg" | "full";
  chartType?: "bar" | "pie" | "line";
  description?: string;
  permissions?: string[];
  chartOptions?: {
    height?: number;
    width?: string | number;
    responsive?: boolean;
    maintainAspectRatio?: boolean;
    [key: string]: any;
  };
  position?: {
    x: number;
    y: number;
  };
}

type DashboardConfig = {
  id: string;
  name: string;
  widgets: WidgetConfig[];
  isDefault?: boolean;
};

type BatchFilter = {
  batchIds: number[];
  dateRange?: {
    from: string;
    to: string;
  };
};

// Default widgets
const defaultWidgets: WidgetConfig[] = [
  {
    id: "widget-1",
    type: "attendance-overview",
    title: "Attendance Overview",
    size: "md",
    chartType: "pie",
    position: { x: 0, y: 0 }
  },
  {
    id: "widget-2",
    type: "attendance-trends",
    title: "Attendance Trends",
    size: "lg",
    chartType: "line",
    position: { x: 0, y: 1 }
  }
];

// Dashboard Configuration Component
export function DashboardConfiguration() {
  const { user } = useAuth();
  
  // State for batch filter
  const [selectedBatches, setSelectedBatches] = useState<number[]>([]);
  const [isFilterDialogOpen, setIsFilterDialogOpen] = useState(false);
  
  // State for dashboard configs
  const [dashboardConfigs, setDashboardConfigs] = useState<DashboardConfig[]>([
    { id: "default", name: "Default Dashboard", widgets: [...defaultWidgets], isDefault: true }
  ]);
  const [activeDashboardId, setActiveDashboardId] = useState<string>("default");
  const [isEditMode, setIsEditMode] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  // Load saved dashboard preferences when the component mounts
  // Note: For demo purpose, we're using local configs since the API isn't fully set up yet
  useEffect(() => {
    const loadDashboardPreferences = async () => {
      try {
        setIsLoading(true);
        
        // For demo purposes, just use the default configs since the database table doesn't exist yet
        // In a real implementation, this would fetch from the API
        // const response = await fetch('/api/dashboard/preferences');
      } catch (error) {
        console.error('Error loading dashboard preferences:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadDashboardPreferences();
  }, []);
  
  // Get the active dashboard config
  const activeDashboard = dashboardConfigs.find(config => config.id === activeDashboardId) || dashboardConfigs[0];
  
  // Fetch batches
  const { data: batches = [] } = useQuery<Batch[]>({
    queryKey: [`/api/organizations/${user?.organizationId}/batches`],
    enabled: !!user?.organizationId,
  });
  
  // Handlers
  const handleBatchToggle = (batchId: number) => {
    setSelectedBatches(prev => {
      if (prev.includes(batchId)) {
        return prev.filter(id => id !== batchId);
      } else {
        return [...prev, batchId];
      }
    });
  };
  
  const handleSelectAllBatches = () => {
    if (selectedBatches.length === batches.length) {
      setSelectedBatches([]);
    } else {
      setSelectedBatches(batches.map(batch => batch.id));
    }
  };
  
  const handleSaveConfig = async () => {
    try {
      // Save to the database through API
      const response = await fetch('/api/dashboard/preferences', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: activeDashboard.name,
          isDefault: activeDashboard.isDefault || false,
          config: {
            widgets: activeDashboard.widgets.map(widget => ({
              ...widget,
              // Ensure widgets have all required properties
              size: widget.size || 'md',
              chartOptions: widget.chartOptions || {
                height: 300,
                width: '100%',
                responsive: true,
                maintainAspectRatio: false
              }
            }))
          }
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to save dashboard configuration');
      }
      
      alert("Dashboard configuration saved successfully!");
      setIsEditMode(false);
    } catch (error) {
      console.error('Error saving dashboard configuration:', error);
      alert('Error saving dashboard configuration. Please try again.');
    }
  };
  
  const handleAddWidget = (type: WidgetType) => {
    // Get predefined configuration for this widget type if available
    const presetConfig = widgetConfigurations[type as keyof typeof widgetConfigurations];
    
    // Create widget with default or preset configurations
    const newWidget: WidgetConfig = {
      id: `widget-${Date.now()}`,
      type,
      title: presetConfig?.title || getWidgetTitle(type),
      size: "md", // Default size
      chartType: getDefaultChartType(type),
      position: { x: 0, y: activeDashboard.widgets.length },
      chartOptions: presetConfig?.chartOptions || {
        height: 300,
        width: '100%',
        responsive: true,
        maintainAspectRatio: false
      },
      description: presetConfig?.description
    };
    
    setDashboardConfigs(prev => {
      return prev.map(config => {
        if (config.id === activeDashboardId) {
          return {
            ...config,
            widgets: [...config.widgets, newWidget]
          };
        }
        return config;
      });
    });
  };
  
  const handleRemoveWidget = (widgetId: string) => {
    setDashboardConfigs(prev => {
      return prev.map(config => {
        if (config.id === activeDashboardId) {
          return {
            ...config,
            widgets: config.widgets.filter(w => w.id !== widgetId)
          };
        }
        return config;
      });
    });
  };
  
  const handleUpdateWidgetConfig = (widgetId: string, updates: Partial<WidgetConfig>) => {
    setDashboardConfigs(prev => {
      return prev.map(config => {
        if (config.id === activeDashboardId) {
          return {
            ...config,
            widgets: config.widgets.map(widget => {
              if (widget.id === widgetId) {
                return { ...widget, ...updates };
              }
              return widget;
            })
          };
        }
        return config;
      });
    });
  };
  
  // Helper functions
  const getWidgetTitle = (type: WidgetType): string => {
    const defaultTitles: Record<string, string> = {
      "attendance-overview": "Attendance Overview",
      "attendance-trends": "Attendance Trends",
      "performance-distribution": "Performance Distribution",
      "phase-completion": "Phase Completion",
      "attendance-breakdown": "Attendance Breakdown",
      "enhanced-attendance-breakdown": "Enhanced Attendance Breakdown",
      "batch-summary": "Batch Summary",
      "trainee-progress": "Trainee Progress",
      "recent-activity": "Recent Activity",
      "quick-actions": "Quick Actions",
      "announcements": "Announcements",
      "calendar": "Calendar",
      "evaluation-summary": "Evaluation Summary"
    };
    
    return defaultTitles[type] || `${type.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}`;
  };
  
  const getDefaultChartType = (type: WidgetType): "bar" | "pie" | "line" => {
    const defaultChartTypes: Record<string, "bar" | "pie" | "line"> = {
      "attendance-overview": "pie",
      "attendance-trends": "line",
      "performance-distribution": "bar",
      "phase-completion": "bar",
      "attendance-breakdown": "pie",
      "enhanced-attendance-breakdown": "bar",
      "batch-summary": "bar",
      "trainee-progress": "line",
      "evaluation-summary": "bar"
    };
    
    return defaultChartTypes[type] || "bar";
  };
  
  // Batch filter dialog
  const BatchFilterDialog = () => (
    <Dialog open={isFilterDialogOpen} onOpenChange={setIsFilterDialogOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Filter className="h-4 w-4" />
          {selectedBatches.length ? `${selectedBatches.length} Batches Selected` : "Filter Batches"}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Filter Batches</DialogTitle>
          <DialogDescription>
            Select the batches you want to include in the dashboard.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <div className="flex items-center justify-between mb-4">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleSelectAllBatches}
            >
              {selectedBatches.length === batches.length ? "Deselect All" : "Select All"}
            </Button>
            <span className="text-sm text-muted-foreground">
              {selectedBatches.length} of {batches.length} selected
            </span>
          </div>
          
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {batches.map((batch) => (
              <div key={batch.id} className="flex items-center space-x-2">
                <Checkbox 
                  id={`batch-${batch.id}`} 
                  checked={selectedBatches.includes(batch.id)} 
                  onCheckedChange={() => handleBatchToggle(batch.id)}
                />
                <Label htmlFor={`batch-${batch.id}`} className="flex flex-col">
                  <span>{batch.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {batch.process?.name} • {batch.location?.name}
                  </span>
                </Label>
                <Badge variant="outline" className="ml-auto capitalize">
                  {batch.status}
                </Badge>
              </div>
            ))}
          </div>
        </div>
        <div className="flex justify-end">
          <Button onClick={() => setIsFilterDialogOpen(false)}>Apply Filters</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
  
  return (
    <div className="space-y-6">
      {/* Dashboard Config Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <div className="flex items-center gap-2">
          <BatchFilterDialog />
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2">
                <LayoutDashboard className="h-4 w-4" />
                {activeDashboard.name}
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {dashboardConfigs.map((config) => (
                <DropdownMenuItem
                  key={config.id}
                  onClick={() => setActiveDashboardId(config.id)}
                >
                  {config.name} {config.isDefault && "(Default)"}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          
          {isEditMode ? (
            <Button onClick={handleSaveConfig} className="gap-2">
              <Save className="h-4 w-4" />
              Save
            </Button>
          ) : (
            <Button variant="outline" onClick={() => setIsEditMode(true)} className="gap-2">
              <Settings className="h-4 w-4" />
              Customize
            </Button>
          )}
        </div>
      </div>
      
      {/* Edit Mode Controls */}
      {isEditMode && (
        <Card>
          <CardHeader>
            <CardTitle>Dashboard Customization</CardTitle>
            <CardDescription>
              Add, remove, or rearrange widgets on your dashboard.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button className="gap-2">
                    <Plus className="h-4 w-4" />
                    Add Widget
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => handleAddWidget("enhanced-attendance-breakdown")}>
                    Enhanced Attendance Breakdown
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleAddWidget("attendance-trends")}>
                    Attendance Trends
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleAddWidget("attendance-overview")}>
                    Attendance Overview
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleAddWidget("performance-distribution")}>
                    Performance Distribution
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleAddWidget("phase-completion")}>
                    Phase Completion
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              
              <Button variant="outline" className="gap-2">
                <ArrowDown className="h-4 w-4" />
                Save as Preset
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Widget Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* This will be filled with actual widgets */}
        {activeDashboard.widgets.map((widget) => (
          <Card key={widget.id} className={`
            ${widget.size === "lg" ? "col-span-full" : 
              widget.size === "md" ? "md:col-span-1 lg:col-span-1" : ""}
          `}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-lg font-medium">{widget.title}</CardTitle>
              {isEditMode && (
                <div className="flex items-center gap-2">
                  <div className="flex items-center space-x-2">
                    <Select 
                      value={widget.chartType} 
                      onValueChange={(value) => handleUpdateWidgetConfig(widget.id, { chartType: value as "bar" | "pie" | "line" })}
                    >
                      <SelectTrigger className="w-[100px]">
                        <SelectValue placeholder="Chart Type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="bar">Bar</SelectItem>
                        <SelectItem value="pie">Pie</SelectItem>
                        <SelectItem value="line">Line</SelectItem>
                      </SelectContent>
                    </Select>
                    
                    <Select
                      value={String(widget.chartOptions?.height || 300)}
                      onValueChange={(value) => {
                        const height = parseInt(value);
                        const chartOptions = {
                          ...(widget.chartOptions || {}),
                          height: height
                        };
                        handleUpdateWidgetConfig(widget.id, { chartOptions });
                      }}
                    >
                      <SelectTrigger className="w-[100px]">
                        <SelectValue placeholder="Height" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="200">Small (200px)</SelectItem>
                        <SelectItem value="300">Medium (300px)</SelectItem>
                        <SelectItem value="400">Large (400px)</SelectItem>
                        <SelectItem value="500">X-Large (500px)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => handleRemoveWidget(widget.id)}
                  >
                    <Trash className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </CardHeader>
            <CardContent className="p-0">
              <WidgetFactory 
                widget={widget} 
                className={isEditMode ? "opacity-70 pointer-events-none" : ""}
              />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}