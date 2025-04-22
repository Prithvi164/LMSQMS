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
  
  // Get the initial dimensions from the configuration or defaults
  const [chartDimensions, setChartDimensions] = useState({
    height: widget.chartOptions?.height || 
      (widgetConfigurations[widget.type as keyof typeof widgetConfigurations]?.chartOptions?.height) || 
      300,
    width: widget.chartOptions?.width || '100%'
  });
  
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
        <div className="relative w-full">
          <ResizableChart 
            defaultHeight={chartDimensions.height}
            defaultWidth={chartDimensions.width}
            minHeight={200}
            minWidth={200}
            maxHeight={800}
            maxWidth={1600}
            onResize={(newDimensions) => {
              console.log('Resizing chart to:', newDimensions);
              setChartDimensions(newDimensions);
              
              // Save user preferences via API
              // This is commented out but would save preferences when implemented
              /*
              apiRequest('/api/dashboard/preferences', {
                method: 'POST', 
                body: {
                  widgetId: widget.id,
                  chartDimensions: newDimensions
                }
              });
              */
            }}
            className="w-full relative"
          >
            <WidgetComponent 
              config={widget}
              chartOptions={{
                ...(presetConfig?.chartOptions || {}),
                ...widget.chartOptions,
                // Override with our current settings
                responsive: true,
                maintainAspectRatio: false,
                height: chartDimensions.height,
                width: typeof chartDimensions.width === 'number' ? chartDimensions.width : undefined,
                animation: {
                  duration: 0 // Disable animations during resize for better performance
                }
              }} 
            />
          </ResizableChart>
          
          {/* Instructional overlay that appears briefly */}
          <div className="absolute bottom-16 right-4 bg-black/75 text-white text-xs py-1 px-2 rounded pointer-events-none opacity-0 transition-opacity duration-500 hover:opacity-100" 
            style={{animation: 'fadeInOut 3s ease-in-out'}}>
            <p>Drag edges or corner to resize</p>
          </div>
        </div>
      </CardContent>
      
      <style jsx>{`
        @keyframes fadeInOut {
          0% { opacity: 0; }
          20% { opacity: 1; }
          80% { opacity: 1; }
          100% { opacity: 0; }
        }
      `}</style>
    </Card>
  );
}