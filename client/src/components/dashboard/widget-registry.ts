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

// Create a mock attendance data object
const mockAttendanceData = {
  totalDays: 30,
  completedDays: 15,
  presentCount: 120,
  absentCount: 15,
  lateCount: 8,
  leaveCount: 7,
  attendanceRate: 85.2,
  dailyAttendance: [],
  phaseAttendance: [],
  traineeAttendance: []
};

// Wrapper to provide mock data to components requiring attendanceData
const withMockData = (Component: React.ComponentType<any>) => {
  return function WrappedComponent(props: any) {
    // If the component is AttendanceBreakdown, ensure it gets the required attendanceData prop
    if (Component === AttendanceBreakdown) {
      return React.createElement(Component, { ...props, attendanceData: mockAttendanceData });
    }
    return React.createElement(Component, props);
  };
};

// Registry of widget components mapped by their type
export const widgetRegistry: Record<WidgetType, React.ComponentType<any>> = {
  'attendance-breakdown': withMockData(AttendanceBreakdown),
  'enhanced-attendance-breakdown': EnhancedAttendanceBreakdownWidget,
  'attendance-overview': withMockData(AttendanceBreakdown),
  'attendance-trends': EnhancedAttendanceBreakdownWidget,
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