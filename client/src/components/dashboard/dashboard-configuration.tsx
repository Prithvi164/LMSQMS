import { useState, useEffect } from 'react';
import { nanoid } from 'nanoid';
import { useLocalStorage } from '@/hooks/use-local-storage';
import { DraggableDashboard } from './draggable-dashboard';

// Define valid widget types
export type WidgetType = 
  'assessment-performance' | 
  'certification-progress' | 
  'attendance-overview' | 
  'attendance-trends' |
  'performance-distribution' |
  'phase-completion';

// Widget configuration structure
export interface WidgetConfig {
  id: string;
  type: WidgetType;
  title: string;
  size: 'small' | 'medium' | 'large';
  chartType?: 'bar' | 'pie' | 'line';
  position: {
    x: number;
    y: number;
  };
}

// Default assessment dashboard widgets
export const defaultAssessmentWidgets: WidgetConfig[] = [
  {
    id: nanoid(),
    type: 'assessment-performance',
    title: 'Assessment Performance',
    size: 'medium',
    chartType: 'bar',
    position: { x: 0, y: 0 },
  },
  {
    id: nanoid(),
    type: 'certification-progress',
    title: 'Certification Progress',
    size: 'medium',
    chartType: 'pie',
    position: { x: 1, y: 0 },
  },
  {
    id: nanoid(),
    type: 'performance-distribution',
    title: 'Performance Distribution',
    size: 'medium',
    chartType: 'bar',
    position: { x: 0, y: 1 },
  },
];

// Default training dashboard widgets
export const defaultTrainingWidgets: WidgetConfig[] = [
  {
    id: nanoid(),
    type: 'attendance-overview',
    title: 'Attendance Overview',
    size: 'medium',
    chartType: 'pie',
    position: { x: 0, y: 0 },
  },
  {
    id: nanoid(),
    type: 'attendance-trends',
    title: 'Attendance Trends',
    size: 'medium',
    chartType: 'line',
    position: { x: 1, y: 0 },
  },
  {
    id: nanoid(),
    type: 'phase-completion',
    title: 'Phase Completion Status',
    size: 'large',
    chartType: 'bar',
    position: { x: 0, y: 1 },
  },
];

// Props for the DashboardConfiguration component
interface DashboardConfigurationProps {
  dashboardType: 'training' | 'assessment';
  organizationId: number;
  batchId?: number;
}

export function DashboardConfiguration({ dashboardType, organizationId, batchId }: DashboardConfigurationProps) {
  // Create a unique key for storing dashboard configuration in local storage
  const storageKey = `dashboard-config-${organizationId}-${dashboardType}${batchId ? `-${batchId}` : ''}`;
  
  // Load widgets from local storage or use defaults
  const [widgets, setWidgets] = useLocalStorage<WidgetConfig[]>(
    storageKey,
    dashboardType === 'assessment' ? defaultAssessmentWidgets : defaultTrainingWidgets
  );

  // Setup batch IDs array for widget data fetching
  const batchIds = batchId ? [batchId] : [];

  return (
    <div className="space-y-6 p-4">
      <div>
        <h2 className="text-2xl font-semibold">
          {dashboardType === 'assessment' ? 'Assessment Dashboard' : 'Training Dashboard'}
        </h2>
        <p className="text-muted-foreground">
          Customize your dashboard by adding, removing, or rearranging widgets
        </p>
      </div>
      
      <DraggableDashboard 
        widgets={widgets} 
        onWidgetsChange={setWidgets}
        batchIds={batchIds}
      />
    </div>
  );
}