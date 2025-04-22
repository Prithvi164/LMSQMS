import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { widgetRegistry } from './widget-registry';
import { WidgetConfig } from './dashboard-configuration.ts';
import { usePermissions } from '@/hooks/use-permissions';

interface WidgetFactoryProps {
  widget: WidgetConfig;
  className?: string;
}

export function WidgetFactory({ widget, className }: WidgetFactoryProps) {
  const { hasPermissions } = usePermissions();
  
  // Check if user has required permissions to view this widget
  const canViewWidget = !widget.permissions || 
    widget.permissions.length === 0 || 
    hasPermissions(widget.permissions);
  
  // If user doesn't have permission, don't render the widget
  if (!canViewWidget) {
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
        <WidgetComponent config={widget} />
      </CardContent>
    </Card>
  );
}