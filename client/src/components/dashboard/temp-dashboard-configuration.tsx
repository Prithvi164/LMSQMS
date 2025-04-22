import React, { useState, useEffect } from "react";
import { Plus, Settings, Trash, ChevronDown, ChevronUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { WidgetFactory } from "./widget-factory";

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
  gridSpan?: number;
  gridHeight?: number;
};

type DashboardConfig = {
  id: string;
  name: string;
  widgets: WidgetConfig[];
  isDefault?: boolean;
};

// Helper function to get widget title
const getWidgetTitle = (type: WidgetType): string => {
  switch (type) {
    case "attendance-overview": return "Attendance Overview";
    case "attendance-trends": return "Attendance Trends";
    case "performance-distribution": return "Performance Distribution";
    case "phase-completion": return "Phase Completion Progress";
    default: return "New Widget";
  }
};

// Helper function to get widget category
const getWidgetCategory = (type: WidgetType): WidgetCategory => {
  switch (type) {
    case "attendance-overview":
    case "attendance-trends":
      return "attendance";
    case "performance-distribution":
      return "performance";
    case "phase-completion":
      return "training";
    default:
      return "other";
  }
};

// Helper function to get default chart type
const getDefaultChartType = (type: WidgetType): "bar" | "pie" | "line" => {
  switch (type) {
    case "attendance-overview": return "pie";
    case "attendance-trends": return "line";
    case "performance-distribution": return "bar";
    case "phase-completion": return "bar";
    default: return "bar";
  }
};

// Main component
export function DashboardConfiguration({
  availableBatches = [],
  onBatchesSelected,
  initialDashboardConfig,
}: {
  availableBatches?: any[];
  onBatchesSelected?: (batchIds: number[]) => void;
  initialDashboardConfig?: DashboardConfig;
}) {
  const { toast } = useToast();
  const [isEditMode, setIsEditMode] = useState(false);
  const [dashboardConfig, setDashboardConfig] = useState<DashboardConfig>(
    initialDashboardConfig || {
      id: "default",
      name: "Default Dashboard",
      widgets: [],
      isDefault: true,
    }
  );
  const [selectedBatches, setSelectedBatches] = useState<number[]>([]);
  const [isAddWidgetDialogOpen, setIsAddWidgetDialogOpen] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<WidgetCategory[]>(["attendance", "performance", "training", "other"]);

  // Save dashboard config to localStorage when it changes
  useEffect(() => {
    if (dashboardConfig && dashboardConfig.widgets.length > 0) {
      localStorage.setItem("dashboardConfig", JSON.stringify(dashboardConfig));
    }
  }, [dashboardConfig]);

  // Load dashboard config from localStorage on initial render
  useEffect(() => {
    const savedConfig = localStorage.getItem("dashboardConfig");
    if (savedConfig) {
      try {
        const parsedConfig = JSON.parse(savedConfig);
        setDashboardConfig(parsedConfig);
      } catch (error) {
        console.error("Error parsing saved dashboard config:", error);
      }
    }
  }, []);

  // Handle adding a new widget
  const handleAddWidget = (type: WidgetType) => {
    const newWidget: WidgetConfig = {
      id: `widget-${Date.now()}`,
      type,
      title: getWidgetTitle(type),
      category: getWidgetCategory(type),
      size: "md",
      chartType: getDefaultChartType(type),
      position: { x: 0, y: 0 },
      gridSpan: 4,
      gridHeight: 2
    };

    setDashboardConfig(prev => ({
      ...prev,
      widgets: [...prev.widgets, newWidget],
    }));

    setIsAddWidgetDialogOpen(false);
    
    toast({
      title: "Widget Added",
      description: `Added ${newWidget.title} to dashboard`,
    });
  };

  // Handle removing a widget
  const handleRemoveWidget = (widgetId: string) => {
    setDashboardConfig(prev => ({
      ...prev,
      widgets: prev.widgets.filter(w => w.id !== widgetId),
    }));

    toast({
      title: "Widget Removed",
      description: "The widget has been removed from your dashboard",
    });
  };

  // Handle updating widget configuration
  const handleUpdateWidgetConfig = (widgetId: string, updates: Partial<WidgetConfig>) => {
    setDashboardConfig(prev => ({
      ...prev,
      widgets: prev.widgets.map(widget => 
        widget.id === widgetId ? { ...widget, ...updates } : widget
      ),
    }));
  };

  // Group widgets by category
  const widgetsByCategory = dashboardConfig.widgets.reduce((acc, widget) => {
    const category = widget.category || "other";
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(widget);
    return acc;
  }, {} as Record<WidgetCategory, WidgetConfig[]>);

  // Get all categories with widgets
  const categoriesWithWidgets = Object.keys(widgetsByCategory) as WidgetCategory[];

  return (
    <div className="w-full space-y-4">
      {/* Dashboard controls */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Dashboard</h2>
        <div className="flex items-center gap-2">
          {isEditMode ? (
            <Button onClick={() => setIsEditMode(false)} variant="outline">
              Done
            </Button>
          ) : (
            <Button onClick={() => setIsEditMode(true)} variant="outline" className="gap-2">
              <Settings className="h-4 w-4" />
              Customize
            </Button>
          )}
          
          {isEditMode && (
            <Dialog open={isAddWidgetDialogOpen} onOpenChange={setIsAddWidgetDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="h-4 w-4" />
                  Add Widget
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Widget</DialogTitle>
                </DialogHeader>
                <div className="grid grid-cols-2 gap-4">
                  <Button onClick={() => handleAddWidget("attendance-overview")} variant="outline">
                    Attendance Overview
                  </Button>
                  <Button onClick={() => handleAddWidget("attendance-trends")} variant="outline">
                    Attendance Trends
                  </Button>
                  <Button onClick={() => handleAddWidget("performance-distribution")} variant="outline">
                    Performance Distribution
                  </Button>
                  <Button onClick={() => handleAddWidget("phase-completion")} variant="outline">
                    Phase Completion
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* Dashboard widgets */}
      <div className="space-y-4">
        {categoriesWithWidgets.length > 0 ? (
          <div className="space-y-6">
            {categoriesWithWidgets.map(category => (
              <div key={category} className="space-y-2">
                <div className="border-b py-2 mb-4">
                  <h3 className="text-lg font-medium capitalize">{category}</h3>
                </div>
                
                <div className="grid grid-cols-12 gap-4">
                  {widgetsByCategory[category].map(widget => (
                    <div 
                      key={widget.id} 
                      style={{ gridColumn: `span ${widget.gridSpan || 4} / span ${widget.gridSpan || 4}` }}
                    >
                      <Card className="h-full">
                        <CardHeader className="p-4 flex flex-row items-center justify-between space-y-0 pb-2">
                          <CardTitle className="text-md font-medium">{widget.title}</CardTitle>
                          {isEditMode && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveWidget(widget.id)}
                              className="h-8 w-8 p-0"
                            >
                              <Trash className="h-4 w-4" />
                            </Button>
                          )}
                        </CardHeader>
                        <CardContent className="p-4">
                          <div 
                            className="bg-white rounded-md p-2 shadow-inner" 
                            style={{ height: widget.gridHeight ? `${widget.gridHeight * 150}px` : '300px' }}
                          >
                            <WidgetFactory 
                              config={widget} 
                              batchIds={selectedBatches} 
                              className="h-full w-full"
                            />
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="border rounded-md p-8 text-center">
            <p className="text-muted-foreground">No widgets added yet.</p>
            {!isEditMode && (
              <Button onClick={() => setIsEditMode(true)} variant="outline" className="mt-4">
                <Settings className="h-4 w-4 mr-2" />
                Customize Dashboard
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}