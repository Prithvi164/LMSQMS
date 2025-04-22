// Types of widgets supported in the dashboard
export type WidgetType = 
  | 'attendance-breakdown'
  | 'enhanced-attendance-breakdown'
  | 'batch-summary'
  | 'trainee-progress'
  | 'recent-activity'
  | 'quick-actions'
  | 'announcements'
  | 'calendar'
  | 'evaluation-summary';

// Configuration for a single widget
export interface WidgetConfig {
  id: string;
  type: WidgetType;
  title: string;
  description?: string;
  size?: 'sm' | 'md' | 'lg' | 'full';
  refreshInterval?: number; // in milliseconds
  permissions?: string[];
  defaultOptions?: Record<string, any>;
}

// Configuration for an entire dashboard
export interface DashboardConfig {
  id: string;
  name: string;
  description?: string;
  widgets: WidgetConfig[];
  layout?: any; // For future implementation of drag-and-drop layouts
}

// Factory function to create a widget configuration
export function createWidgetConfig(config: Omit<WidgetConfig, 'id'>): WidgetConfig {
  return {
    id: `widget-${Math.random().toString(36).substring(2, 9)}`,
    ...config
  };
}

// Default dashboard configuration with predefined widgets
export const defaultDashboardConfig: DashboardConfig = {
  id: 'default-dashboard',
  name: 'Default Dashboard',
  description: 'Default dashboard configuration with standard widgets',
  widgets: [
    createWidgetConfig({
      type: 'enhanced-attendance-breakdown',
      title: 'Attendance Breakdown',
      description: 'Comprehensive analysis of attendance data',
      size: 'full',
      permissions: ['view_attendance'],
      defaultOptions: {
        view: 'overall' // 'overall', 'daily', 'phase', 'trainee'
      }
    }),
    createWidgetConfig({
      type: 'batch-summary',
      title: 'Batch Summary',
      description: 'Summary of active batches and trainees',
      size: 'md',
      permissions: ['view_batches']
    }),
    createWidgetConfig({
      type: 'trainee-progress',
      title: 'Trainee Progress',
      description: 'Progress tracking for trainees',
      size: 'md',
      permissions: ['view_trainees']
    }),
    createWidgetConfig({
      type: 'recent-activity',
      title: 'Recent Activity',
      description: 'Latest activities and updates',
      size: 'md',
      permissions: []
    }),
    createWidgetConfig({
      type: 'quick-actions',
      title: 'Quick Actions',
      description: 'Frequently used actions',
      size: 'sm',
      permissions: []
    }),
    createWidgetConfig({
      type: 'announcements',
      title: 'Announcements',
      description: 'Recent announcements and notifications',
      size: 'md',
      permissions: ['view_announcements']
    }),
    createWidgetConfig({
      type: 'calendar',
      title: 'Calendar',
      description: 'Upcoming events and deadlines',
      size: 'md',
      permissions: ['view_calendar']
    }),
    createWidgetConfig({
      type: 'evaluation-summary',
      title: 'Evaluation Summary',
      description: 'Summary of trainee evaluations',
      size: 'lg',
      permissions: ['view_evaluations']
    })
  ]
};