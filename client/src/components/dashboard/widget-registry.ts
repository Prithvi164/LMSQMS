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

// Define some basic mock data to show an example when no data is yet retrieved from the API
const exampleAttendanceData = {
  totalDays: 30,
  completedDays: 15,
  presentCount: 120,
  absentCount: 15,
  lateCount: 8,
  leaveCount: 7,
  attendanceRate: 85.2,
  dailyAttendance: [
    {
      date: "2025-04-01",
      presentCount: 10,
      absentCount: 2,
      lateCount: 1,
      leaveCount: 0,
      attendanceRate: 83.3,
      totalTrainees: 13
    }
  ],
  phaseAttendance: [
    {
      phase: "Introduction",
      presentCount: 50,
      absentCount: 5,
      lateCount: 3,
      leaveCount: 2,
      attendanceRate: 86.7,
      totalDays: 10,
      totalRecords: 60
    }
  ],
  traineeAttendance: [
    {
      traineeId: 1,
      traineeName: "Example Trainee",
      presentCount: 12,
      absentCount: 2,
      lateCount: 1,
      leaveCount: 0,
      attendanceRate: 85.7
    }
  ]
};

// Create a wrapper for the basic AttendanceBreakdown to provide sample data
const BasicAttendanceBreakdownWidget = (props: any) => {
  return React.createElement(AttendanceBreakdown, {
    ...props,
    attendanceData: exampleAttendanceData,
    initialView: 'overall',
    className: 'border rounded-lg overflow-hidden shadow-sm'
  });
};

// Define standard widget configurations
export const widgetConfigurations = {
  'enhanced-attendance-breakdown': {
    title: 'Attendance Breakdown',
    description: 'Enhanced widget with filters for viewing attendance data across processes and batches',
    defaultHeight: 550,
    defaultWidth: 12, // 12 column span in grid (full width)
    minHeight: 400,
    minWidth: 6,
    maxWidth: 12,
    resizable: true,
    removable: true,
    chartOptions: {
      height: 400,
      responsive: true,
      maintainAspectRatio: false
    },
    defaultOptions: {
      view: 'overall'
    }
  },
  'attendance-trends': {
    title: 'Attendance Trends',
    description: 'View attendance trends over time with daily breakdown',
    defaultHeight: 450,
    defaultWidth: 12,
    minHeight: 350, 
    minWidth: 6,
    maxWidth: 12,
    resizable: true,
    removable: true,
    chartOptions: {
      height: 350,
      responsive: true,
      maintainAspectRatio: false
    },
    defaultOptions: {
      view: 'daily'
    }
  },
  'attendance-overview': {
    title: 'Attendance Overview',
    description: 'Basic overview of attendance statistics',
    defaultHeight: 400,
    defaultWidth: 6,
    minHeight: 300,
    minWidth: 4,
    maxWidth: 6,
    resizable: true,
    removable: true,
    chartOptions: {
      height: 300,
      responsive: true,
      maintainAspectRatio: false
    },
    defaultOptions: {
      view: 'overall'
    }
  }
};

// Registry of widget components mapped by their type
export const widgetRegistry: Record<WidgetType, React.ComponentType<any>> = {
  'attendance-breakdown': BasicAttendanceBreakdownWidget,
  'enhanced-attendance-breakdown': EnhancedAttendanceBreakdownWidget,
  'attendance-overview': BasicAttendanceBreakdownWidget,
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