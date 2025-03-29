import { AttendanceOverviewWidget } from "./attendance-overview-widget";
import { WidgetConfig, WidgetType } from "./dashboard-configuration";

type WidgetFactoryProps = {
  config: WidgetConfig;
  batchIds?: number[];
  className?: string;
};

export function WidgetFactory({ config, batchIds, className }: WidgetFactoryProps) {
  const { type, title, chartType } = config;
  
  // Return the appropriate widget based on type
  switch (type) {
    case "attendance-overview":
      return (
        <AttendanceOverviewWidget 
          title={title} 
          chartType={chartType || "pie"}
          batchIds={batchIds}
          className={className}
        />
      );
      
    case "attendance-trends":
      // Temporary placeholder until we implement this widget
      return (
        <div className={`p-6 rounded-lg border shadow-sm ${className}`}>
          <h3 className="text-lg font-medium mb-2">{title}</h3>
          <div className="h-[250px] flex items-center justify-center bg-muted rounded">
            <span className="text-muted-foreground">Attendance Trends Widget (Coming Soon)</span>
          </div>
        </div>
      );
      
    case "performance-distribution":
      // Temporary placeholder until we implement this widget
      return (
        <div className={`p-6 rounded-lg border shadow-sm ${className}`}>
          <h3 className="text-lg font-medium mb-2">{title}</h3>
          <div className="h-[250px] flex items-center justify-center bg-muted rounded">
            <span className="text-muted-foreground">Performance Distribution Widget (Coming Soon)</span>
          </div>
        </div>
      );
      
    case "phase-completion":
      // Temporary placeholder until we implement this widget
      return (
        <div className={`p-6 rounded-lg border shadow-sm ${className}`}>
          <h3 className="text-lg font-medium mb-2">{title}</h3>
          <div className="h-[250px] flex items-center justify-center bg-muted rounded">
            <span className="text-muted-foreground">Phase Completion Widget (Coming Soon)</span>
          </div>
        </div>
      );
      
    default:
      return (
        <div className={`p-6 rounded-lg border shadow-sm ${className}`}>
          <h3 className="text-lg font-medium mb-2">Unknown Widget Type</h3>
          <div className="h-[250px] flex items-center justify-center bg-muted rounded">
            <span className="text-muted-foreground">Widget type '{type}' not recognized</span>
          </div>
        </div>
      );
  }
}