import React, { useState } from "react";
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
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle
} from "@/components/ui/resizable";
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
  BarChart2,
  ChevronDown,
  ChevronRight,
  Filter, 
  GraduationCap,
  GripVertical,
  Layers,
  LayoutDashboard,
  Maximize2,
  Minus,
  Pencil,
  Plus,
  Save, 
  Settings, 
  Trash,
  Users 
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { WidgetFactory } from "./widget-factory";


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

export type WidgetType = 
  | "attendance-overview"
  | "attendance-trends"
  | "performance-distribution"
  | "phase-completion";

export type WidgetCategory = 
  | "attendance" 
  | "performance" 
  | "training" 
  | "other";

export type WidgetConfig = {
  id: string;
  type: WidgetType;
  title: string;
  category: WidgetCategory;
  size: "sm" | "md" | "lg" | "full";
  chartType?: "bar" | "pie" | "line";
  position: {
    x: number;
    y: number;
  };
  defaultSize?: number; // Size percentage for resizable panels
  gridSpan?: number; // Number of grid cells this widget spans (1-4)
  gridHeight?: number; // Height of widget in grid units (1-4)
};

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

// Get widget category based on type
const getWidgetCategory = (type: WidgetType): WidgetCategory => {
  if (type.startsWith("attendance")) {
    return "attendance";
  } else if (type.includes("performance")) {
    return "performance";
  } else if (type.includes("phase") || type.includes("training")) {
    return "training";
  } else {
    return "other";
  }
};

// Default widgets
const defaultWidgets: WidgetConfig[] = [
  {
    id: "widget-1",
    type: "attendance-overview",
    title: "Attendance Overview",
    category: "attendance",
    size: "md",
    chartType: "pie",
    position: { x: 0, y: 0 },
    defaultSize: 50,
    gridSpan: 2, // Half width (6 of 12 columns)
    gridHeight: 1
  },
  {
    id: "widget-2",
    type: "attendance-trends",
    title: "Attendance Trends",
    category: "attendance",
    size: "lg",
    chartType: "line",
    position: { x: 0, y: 1 },
    defaultSize: 50,
    gridSpan: 2, // Half width (6 of 12 columns)
    gridHeight: 1
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
  
  // Grid configuration state
  const [gridMode, setGridMode] = useState<"auto" | "custom">("auto");
  // Widget movement is always restricted to edit mode only
  const widgetMovement = "edit";
  
  // State for collapsed categories
  const [collapsedCategories, setCollapsedCategories] = useState<string[]>([]);
  
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
  
  const handleSaveConfig = () => {
    // In a real implementation, this would save to the database
    alert("Dashboard configuration saved!");
    setIsEditMode(false);
  };
  
  const handleAddWidget = (type: WidgetType) => {
    const newWidget: WidgetConfig = {
      id: `widget-${Date.now()}`,
      type,
      title: getWidgetTitle(type),
      category: getWidgetCategory(type),
      size: "md",
      chartType: getDefaultChartType(type),
      position: { x: 0, y: activeDashboard.widgets.length },
      defaultSize: 50,
      gridSpan: 2, // Default to half width (6 columns)
      gridHeight: 1
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
  
  // Toggle category collapse
  const toggleCategoryCollapse = (category: string) => {
    setCollapsedCategories(prev => {
      if (prev.includes(category)) {
        return prev.filter(c => c !== category);
      } else {
        return [...prev, category];
      }
    });
  };
  
  // Helper functions
  const getWidgetTitle = (type: WidgetType): string => {
    const titles: Record<WidgetType, string> = {
      "attendance-overview": "Attendance Overview",
      "attendance-trends": "Attendance Trends",
      "performance-distribution": "Performance Distribution",
      "phase-completion": "Phase Completion"
    };
    return titles[type];
  };
  
  const getDefaultChartType = (type: WidgetType): "bar" | "pie" | "line" => {
    const chartTypes: Record<WidgetType, "bar" | "pie" | "line"> = {
      "attendance-overview": "pie",
      "attendance-trends": "line",
      "performance-distribution": "bar",
      "phase-completion": "bar"
    };
    return chartTypes[type];
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
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button className="gap-2">
                      <Plus className="h-4 w-4" />
                      Add Widget
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onClick={() => handleAddWidget("attendance-overview")}>
                      Attendance Overview
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleAddWidget("attendance-trends")}>
                      Attendance Trends
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
              
              <div className="border rounded-md p-3 bg-slate-50">
                <h3 className="text-sm font-medium mb-2">Layout Configuration</h3>
                <p className="text-xs text-muted-foreground mb-3">
                  Configure the grid layout for widgets. Each category section can be customized with 1-4 columns.
                </p>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <Label className="text-xs">Grid Mode</Label>
                    <Select 
                      value={gridMode} 
                      onValueChange={(value) => setGridMode(value as "auto" | "custom")}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Grid Mode" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="auto">Automatic Grid</SelectItem>
                        <SelectItem value="custom">Custom Grid Sizes</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Resizable Widget Layout */}
      <div className="mt-6">
        {activeDashboard.widgets.length > 0 ? (
          <div className="w-full overflow-hidden">
            {/* Category sections and widgets */}
            <div className="space-y-8">
              {/* Get unique categories */}
              {Array.from(new Set(activeDashboard.widgets.map(w => w.category))).map(category => (
                <div key={category} className="space-y-4">
                  {/* Category Header */}
                  <div 
                    className="flex items-center justify-between gap-2 border-b pb-2 cursor-pointer hover:bg-slate-50 pr-2 rounded-sm transition-colors"
                    onClick={() => toggleCategoryCollapse(category)}
                  >
                    <div className="flex items-center gap-2">
                      {category === "attendance" && <Users className="h-5 w-5 text-blue-500" />}
                      {category === "performance" && <BarChart2 className="h-5 w-5 text-amber-500" />}
                      {category === "training" && <GraduationCap className="h-5 w-5 text-purple-500" />}
                      {category === "other" && <Layers className="h-5 w-5 text-gray-500" />}
                      <h2 className="text-xl font-semibold capitalize">{category}</h2>
                      
                      {/* Widget count */}
                      <Badge variant="outline" className="ml-2 text-xs px-2 py-0 h-5">
                        {activeDashboard.widgets.filter(w => w.category === category).length} widgets
                      </Badge>
                    </div>
                    
                    {/* Collapse/Expand icon */}
                    <div className="text-muted-foreground">
                      {collapsedCategories.includes(category) ? (
                        <ChevronRight className="h-5 w-5" />
                      ) : (
                        <ChevronDown className="h-5 w-5" />
                      )}
                    </div>
                  </div>

                  {/* Category Widgets */}
                  {!collapsedCategories.includes(category) && (
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
                      {activeDashboard.widgets
                        .filter(w => w.category === category)
                        .map((widget, index) => (
                        <div 
                          key={widget.id} 
                          className={`transition-all duration-200 ease-in-out w-full 
                            ${widget.size === "full" ? "md:col-span-12" : 
                              widget.gridSpan === 2 ? "md:col-span-6" :
                              widget.gridSpan === 3 ? "md:col-span-4" :
                              widget.gridSpan === 4 ? "md:col-span-3" :
                              "md:col-span-12"} 
                            ${widget.gridHeight === 2 ? "row-span-2" :
                               widget.gridHeight === 3 ? "row-span-3" :
                               widget.gridHeight === 4 ? "row-span-4" :
                               "row-span-1"}`}
                          style={{
                            height: widget.gridHeight ? `${widget.gridHeight * 120}px` : "250px"
                          }}
                        >
                          <Card className="h-full border shadow-sm overflow-hidden">
                            <div className="flex flex-col h-full">
                              {/* Widget title and controls */}
                              <div className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-800 border-b">
                                <div className="flex items-center text-base font-medium">
                                  {isEditMode ? (
                                    <>
                                      <GripVertical className="h-4 w-4 mr-2 text-muted-foreground cursor-move" />
                                      <Input 
                                        value={widget.title}
                                        onChange={(e) => handleUpdateWidgetConfig(widget.id, { title: e.target.value })}
                                        className="h-8 px-2 py-1 text-base mr-2 max-w-[180px] bg-background"
                                      />
                                    </>
                                  ) : (
                                    <span className="flex items-center">
                                      {widget.type === "attendance-overview" && 
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                        </svg>
                                      }
                                      {widget.type === "attendance-trends" && 
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                                        </svg>
                                      }
                                      {widget.type === "performance-distribution" && 
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
                                        </svg>
                                      }
                                      {widget.type === "phase-completion" && 
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                      }
                                      {widget.title}
                                    </span>
                                  )}
                                  {widget.chartType && !isEditMode && (
                                    <Badge variant="outline" className="ml-2">
                                      {widget.chartType.charAt(0).toUpperCase() + widget.chartType.slice(1)}
                                    </Badge>
                                  )}
                                </div>
                                
                                {/* Controls */}
                                <div className="flex items-center gap-2">
                                  {isEditMode ? (
                                    <div className="flex items-center gap-2">
                                      <Select 
                                        value={widget.chartType} 
                                        onValueChange={(value) => handleUpdateWidgetConfig(widget.id, { chartType: value as "bar" | "pie" | "line" })}
                                        >
                                          <SelectTrigger className="w-[100px] h-8 text-sm bg-background">
                                            <SelectValue placeholder="Chart Type" />
                                          </SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="bar">Bar</SelectItem>
                                            <SelectItem value="pie">Pie</SelectItem>
                                            <SelectItem value="line">Line</SelectItem>
                                          </SelectContent>
                                        </Select>
                                        
                                        <Button 
                                          variant="destructive" 
                                          size="icon" 
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            if (confirm('Are you sure you want to remove this widget?')) {
                                              handleRemoveWidget(widget.id);
                                            }
                                          }}
                                          className="h-8 w-8"
                                        >
                                          <Trash className="h-4 w-4" />
                                        </Button>
                                      </div>
                                      
                                      <div className="flex items-center gap-2 text-xs text-muted-foreground bg-slate-100 p-2 rounded-md w-full">
                                        <div className="flex flex-col">
                                          <span>Width:</span>
                                          <Select 
                                            value={String(widget.gridSpan || 1)} 
                                            onValueChange={(value) => handleUpdateWidgetConfig(widget.id, { gridSpan: parseInt(value) })}
                                          >
                                            <SelectTrigger className="w-[70px] h-7 text-xs">
                                              <SelectValue placeholder="Width" />
                                            </SelectTrigger>
                                            <SelectContent>
                                              <SelectItem value="1">Full width</SelectItem>
                                              <SelectItem value="2">Half width</SelectItem>
                                              <SelectItem value="3">One-third</SelectItem>
                                              <SelectItem value="4">One-fourth</SelectItem>
                                            </SelectContent>
                                          </Select>
                                        </div>
                                        
                                        <div className="flex flex-col">
                                          <span>Height:</span>
                                          <div className="flex items-center gap-1">
                                            <Button 
                                              variant="outline" 
                                              size="icon"
                                              onClick={() => {
                                                const currentHeight = widget.gridHeight || 1;
                                                if (currentHeight > 1) {
                                                  handleUpdateWidgetConfig(widget.id, { gridHeight: currentHeight - 1 });
                                                }
                                              }}
                                              className="h-6 w-6 rounded-full"
                                              disabled={(widget.gridHeight || 1) <= 1}
                                            >
                                              <Minus className="h-3 w-3" />
                                            </Button>
                                            
                                            <Select 
                                              value={String(widget.gridHeight || 1)} 
                                              onValueChange={(value) => handleUpdateWidgetConfig(widget.id, { gridHeight: parseInt(value) })}
                                            >
                                              <SelectTrigger className="w-[50px] h-7 text-xs">
                                                <SelectValue placeholder="Height" />
                                              </SelectTrigger>
                                              <SelectContent>
                                                <SelectItem value="1">1</SelectItem>
                                                <SelectItem value="2">2</SelectItem>
                                                <SelectItem value="3">3</SelectItem>
                                                <SelectItem value="4">4</SelectItem>
                                                <SelectItem value="5">5</SelectItem>
                                                <SelectItem value="6">6</SelectItem>
                                              </SelectContent>
                                            </Select>
                                            
                                            <Button 
                                              variant="outline" 
                                              size="icon"
                                              onClick={() => {
                                                const currentHeight = widget.gridHeight || 1;
                                                if (currentHeight < 6) {
                                                  handleUpdateWidgetConfig(widget.id, { gridHeight: currentHeight + 1 });
                                                }
                                              }}
                                              className="h-6 w-6 rounded-full"
                                              disabled={(widget.gridHeight || 1) >= 6}
                                            >
                                              <Plus className="h-3 w-3" />
                                            </Button>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  </>
                                ) : (
                                  {isEditMode && (
                                    <div className="flex gap-1">
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => setIsEditMode(true)}
                                        className="h-7 w-7 rounded-full opacity-70 hover:opacity-100"
                                        title="Edit widget"
                                      >
                                        <Pencil className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => handleUpdateWidgetConfig(widget.id, { 
                                          size: widget.size === "full" ? "md" : "full" 
                                        })}
                                        className="h-7 w-7 rounded-full opacity-70 hover:opacity-100"
                                        title={widget.size === "full" ? "Collapse widget" : "Expand widget"}
                                      >
                                        <Maximize2 className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (confirm('Are you sure you want to remove this widget?')) {
                                            handleRemoveWidget(widget.id);
                                          }
                                        }}
                                        className="h-7 w-7 rounded-full opacity-70 hover:opacity-100 hover:text-red-500"
                                        title="Delete widget"
                                      >
                                        <Trash className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  )}
                                )}
                              </div>
                            </CardHeader>
                            <CardContent className="p-4 flex-grow h-[calc(100%-60px)]">
                              <div 
                                className="bg-white dark:bg-slate-800 rounded-md p-2 shadow-inner h-full flex flex-col" 
                                style={{ 
                                  height: widget.gridHeight ? `${widget.gridHeight * 150}px` : '150px'
                                }}
                              >
                                <WidgetFactory 
                                  config={widget} 
                                  batchIds={selectedBatches} 
                                  className={`h-full w-full ${isEditMode ? "opacity-80 pointer-events-none" : ""}`}
                                />
                              </div>
                            </CardContent>
                          </Card>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center border rounded-lg p-12 min-h-[300px] bg-slate-50 dark:bg-slate-800/50">
            <div className="text-center text-muted-foreground">
              <LayoutDashboard className="mx-auto h-12 w-12 mb-4 text-primary" />
              <h3 className="text-lg font-medium mb-2 dark:text-slate-200">No widgets added</h3>
              <p className="mb-4">Click "Add Widget" to customize your dashboard</p>
              {!isEditMode && (
                <Button onClick={() => setIsEditMode(true)} variant="outline" className="gap-2">
                  <Settings className="h-4 w-4" />
                  Customize
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}