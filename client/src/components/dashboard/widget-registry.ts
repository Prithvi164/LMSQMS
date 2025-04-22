import React from 'react';
import { EnhancedAttendanceBreakdownWidget } from './enhanced-attendance-breakdown-widget';
import { AttendanceBreakdown } from '@/components/batch-management/attendance-breakdown';

// Widget types from the configuration
export type WidgetType = 
  | 'attendance-breakdown'
  | 'enhanced-attendance-breakdown'
  | 'attendance-overview'
  | 'attendance-trends'
  | 'performance-distribution'
  | 'phase-completion'
  | 'batch-summary'
  | 'trainee-progress'
  | 'recent-activity'
  | 'quick-actions'
  | 'announcements'
  | 'calendar'
  | 'evaluation-summary';

// Placeholder components for future implementation
const BatchSummaryWidget = () => React.createElement('div', {className: 'p-4'}, 'Batch Summary Widget');
const TraineeProgressWidget = () => React.createElement('div', {className: 'p-4'}, 'Trainee Progress Widget');
const RecentActivityWidget = () => React.createElement('div', {className: 'p-4'}, 'Recent Activity Widget');
const QuickActionsWidget = () => React.createElement('div', {className: 'p-4'}, 'Quick Actions Widget');
const AnnouncementsWidget = () => React.createElement('div', {className: 'p-4'}, 'Announcements Widget');
const CalendarWidget = () => React.createElement('div', {className: 'p-4'}, 'Calendar Widget');
const EvaluationSummaryWidget = () => React.createElement('div', {className: 'p-4'}, 'Evaluation Summary Widget');
const PerformanceDistributionWidget = () => React.createElement('div', {className: 'p-4'}, 'Performance Distribution Widget');
const PhaseCompletionWidget = () => React.createElement('div', {className: 'p-4'}, 'Phase Completion Widget');

// Placeholder for the attendance overview widget
const AttendanceOverviewWidget = () => {
  return React.createElement('div', {
    className: 'p-4 text-center text-muted-foreground'
  }, 'Please use the Enhanced Attendance Breakdown for attendance data visualization.');
};

// A wrapper that uses EnhancedAttendanceBreakdownWidget with a daily view
const AttendanceTrendsWidget = (props: any) => {
  const newConfig = props.config ? {
    ...props.config,
    defaultOptions: { view: 'daily' }
  } : { defaultOptions: { view: 'daily' } };
  
  return React.createElement(EnhancedAttendanceBreakdownWidget, {
    ...props,
    config: newConfig
  });
};

// Basic breakdown widget placeholder
const SimpleAttendanceBreakdownWidget = () => {
  return React.createElement('div', {
    className: 'p-4 text-center text-muted-foreground'
  }, 'Please use the Enhanced Attendance Breakdown for better visualization and filtering.');
};

// Registry of widget components mapped by their type
export const widgetRegistry: Record<WidgetType, React.ComponentType<any>> = {
  'attendance-breakdown': SimpleAttendanceBreakdownWidget,
  'enhanced-attendance-breakdown': EnhancedAttendanceBreakdownWidget,
  'attendance-overview': AttendanceOverviewWidget,
  'attendance-trends': AttendanceTrendsWidget,
  'performance-distribution': PerformanceDistributionWidget,
  'phase-completion': PhaseCompletionWidget,
  'batch-summary': BatchSummaryWidget,
  'trainee-progress': TraineeProgressWidget,
  'recent-activity': RecentActivityWidget,
  'quick-actions': QuickActionsWidget,
  'announcements': AnnouncementsWidget,
  'calendar': CalendarWidget,
  'evaluation-summary': EvaluationSummaryWidget,
};