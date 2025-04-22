import React from 'react';
import { ProtectedRoute } from '@/lib/protected-route';
import { EnhancedAttendanceBreakdownWidget } from '@/components/dashboard/enhanced-attendance-breakdown-widget';
import { Card } from '@/components/ui/card';
import { widgetRegistry } from '@/components/dashboard/widget-registry';
import { WidgetFactory } from '@/components/dashboard/widget-factory';
import { defaultDashboardConfig } from '@/components/dashboard/dashboard-configuration';

// Demo page for the Enhanced Attendance Breakdown widget
export default function AttendanceBreakdownDemoPage() {
  // Get enhanced attendance widget from default config
  const enhancedAttendanceWidget = defaultDashboardConfig.widgets.find(
    widget => widget.type === 'enhanced-attendance-breakdown'
  );

  return (
    <ProtectedRoute permissions={['view_attendance']}>
      <div className="container py-6 space-y-8">
        <div className="flex flex-col gap-4">
          <h1 className="text-3xl font-bold">Attendance Dashboard</h1>
          <p className="text-muted-foreground">
            Comprehensive analysis of attendance data with filtering options.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6">
          {/* Directly render the widget component */}
          <EnhancedAttendanceBreakdownWidget />

          {/* Alternative: Use the WidgetFactory component */}
          {enhancedAttendanceWidget && (
            <Card className="p-6 mt-8">
              <h2 className="text-xl font-semibold mb-4">Widget Factory Demo</h2>
              <p className="text-muted-foreground mb-6">
                This widget is being rendered using the WidgetFactory component, 
                which can dynamically render any registered widget type.
              </p>
              <WidgetFactory widget={enhancedAttendanceWidget} />
            </Card>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
}