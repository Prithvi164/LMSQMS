import { AttendanceOverviewWidget } from "./attendance-overview-widget";
import { AttendanceTrendsWidget } from "./attendance-trends-widget";
import { PerformanceDistributionWidget } from "./performance-distribution-widget";
import { PhaseCompletionWidget } from "./phase-completion-widget";
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
      return (
        <AttendanceTrendsWidget 
          title={title} 
          chartType={chartType || "line"}
          batchIds={batchIds}
          className={className}
        />
      );
      
    case "performance-distribution":
      return (
        <PerformanceDistributionWidget 
          title={title} 
          chartType={chartType || "bar"}
          batchIds={batchIds}
          className={className}
        />
      );
      
    case "phase-completion":
      return (
        <PhaseCompletionWidget 
          title={title} 
          chartType={chartType || "bar"}
          batchIds={batchIds}
          className={className}
        />
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