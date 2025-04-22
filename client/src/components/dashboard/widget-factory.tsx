import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { widgetRegistry, widgetConfigurations } from './widget-registry';
import { WidgetConfig } from './dashboard-configuration.ts';
import { usePermissions } from '@/hooks/use-permissions';
import { ResizableChart } from '@/components/ui/resizable-chart';

interface WidgetFactoryProps {
  widget: WidgetConfig;
  className?: string;
}

export function WidgetFactory({ widget, className }: WidgetFactoryProps) {
  const { hasAllPermissions } = usePermissions();
  const [chartHeight, setChartHeight] = useState<number>(
    widget.chartOptions?.height || 
    (widgetConfigurations[widget.type as keyof typeof widgetConfigurations]?.chartOptions?.height) || 
    300
  );
  
  // Check if user has required permissions to view this widget
  const canViewWidget = 
    !widget || 
    !widget.permissions || 
    widget.permissions.length === 0 || 
    hasAllPermissions(widget.permissions);
  
  // If user doesn't have permission, or widget is undefined, don't render anything
  if (!canViewWidget || !widget) {
    return null;
  }
  
  // Get the widget component from the registry
  const WidgetComponent = widgetRegistry[widget.type];
  
  // If widget type is not found in registry, show error message
  if (!WidgetComponent) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Widget Error</CardTitle>
          <CardDescription>Unknown widget type: {widget.type}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-destructive">
            This widget type is not registered in the widget registry.
          </p>
        </CardContent>
      </Card>
    );
  }
  
  // Get preset configuration for this widget type if available
  const presetConfig = widgetConfigurations[widget.type as keyof typeof widgetConfigurations];
  
  // Determine size class based on widget size
  const sizeClass = {
    sm: 'col-span-1',
    md: 'col-span-2',
    lg: 'col-span-3',
    full: 'col-span-full',
  }[widget.size || 'md'];
  
  // Render the widget with its configuration
  return (
    <Card className={`overflow-hidden ${sizeClass} ${className}`}>
      <CardHeader className="pb-3">
        <CardTitle>{widget.title}</CardTitle>
        {widget.description && (
          <CardDescription>{widget.description}</CardDescription>
        )}
      </CardHeader>
      <CardContent className="p-0">
        <ResizableChart 
          defaultHeight={chartHeight}
          minHeight={200}
          maxHeight={800}
          onHeightChange={(newHeight) => {
            setChartHeight(newHeight);
            // Here you can add API call to save the user preference if needed
          }}
          className="w-full"
        >
          <WidgetComponent 
            config={widget}
            chartOptions={{
              ...(presetConfig?.chartOptions || {}),
              ...widget.chartOptions,
              // Override with our current settings
              responsive: true,
              maintainAspectRatio: false,
              height: chartHeight,
            }} 
          />
        </ResizableChart>
      </CardContent>
    </Card>
  );
}