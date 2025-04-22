import React from 'react';
import { WidgetType } from './dashboard-configuration.ts';
import { EnhancedAttendanceBreakdownWidget } from './enhanced-attendance-breakdown-widget';
import { AttendanceBreakdown } from '@/components/batch-management/attendance-breakdown';

// Placeholder components for future implementation
const BatchSummaryWidget = () => React.createElement('div', {className: 'p-4'}, 'Batch Summary Widget');
const TraineeProgressWidget = () => React.createElement('div', {className: 'p-4'}, 'Trainee Progress Widget');
const RecentActivityWidget = () => React.createElement('div', {className: 'p-4'}, 'Recent Activity Widget');
const QuickActionsWidget = () => React.createElement('div', {className: 'p-4'}, 'Quick Actions Widget');
const AnnouncementsWidget = () => React.createElement('div', {className: 'p-4'}, 'Announcements Widget');
const CalendarWidget = () => React.createElement('div', {className: 'p-4'}, 'Calendar Widget');
const EvaluationSummaryWidget = () => React.createElement('div', {className: 'p-4'}, 'Evaluation Summary Widget');

// Registry of widget components mapped by their type
export const widgetRegistry: Record<WidgetType, React.ComponentType<any>> = {
  'attendance-breakdown': AttendanceBreakdown,
  'enhanced-attendance-breakdown': EnhancedAttendanceBreakdownWidget,
  'batch-summary': BatchSummaryWidget,
  'trainee-progress': TraineeProgressWidget,
  'recent-activity': RecentActivityWidget,
  'quick-actions': QuickActionsWidget,
  'announcements': AnnouncementsWidget,
  'calendar': CalendarWidget,
  'evaluation-summary': EvaluationSummaryWidget,
};