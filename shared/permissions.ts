import { permissionEnum } from './schema';

// Define default permissions for each role
export const defaultPermissions = {
  owner: permissionEnum.enumValues.filter(p => p !== 'create_admin'), // Owner gets all permissions except create_admin
  admin: [
    'manage_users',
    'view_users',
    'edit_users',
    'delete_users',
    'upload_users',
    'manage_organization',
    'manage_performance',
    'export_reports',
    // Quiz permissions
    'manage_quiz',
    'edit_quiz',
    'delete_quiz',
    'create_quiz',
    'take_quiz',
    'view_quiz',
    'view_take_quiz',
    // Evaluation form permissions
    'manage_evaluation_form',
    'edit_evaluation_form',
    'delete_evaluation_form',
    'create_evaluation_form',
    'view_evaluation_form',
    // Allocation and feedback permissions
    'manage_allocation',
    'view_allocation',
    'manage_feedback',
    'view_feedback'
  ],
  manager: [
    'view_users',
    'edit_users',
    'view_organization',
    'manage_performance',
    'manage_processes',
    'manage_batches',
    // Quiz permissions
    'manage_quiz',
    'edit_quiz',
    'delete_quiz',
    'create_quiz',
    'take_quiz',
    'view_quiz',
    'view_take_quiz',
    // Evaluation form permissions
    'manage_evaluation_form',
    'edit_evaluation_form',
    'delete_evaluation_form',
    'create_evaluation_form',
    'view_evaluation_form',
    // Feedback permissions
    'manage_feedback',
    'view_feedback'
  ],
  team_lead: [
    'view_users',
    'manage_performance',
    'view_organization',
    // Feedback permissions
    'manage_feedback',
    'view_feedback'
  ],
  quality_analyst: [
    'view_users',
    'manage_performance',
    'export_reports',
    'view_organization',
    // Evaluation form permissions
    'manage_evaluation_form',
    'edit_evaluation_form',
    'delete_evaluation_form',
    'create_evaluation_form',
    'view_evaluation_form',
    // Feedback permissions
    'manage_feedback',
    'view_feedback'
  ],
  trainer: [
    'view_users',
    'view_performance',
    'manage_batches',
    // Quiz permissions
    'manage_quiz',
    'edit_quiz',
    'delete_quiz',
    'create_quiz',
    'take_quiz',
    'view_quiz',
    'view_take_quiz',
    // Feedback permissions
    'view_feedback'
  ],
  advisor: [
    'view_users',
    'view_performance',
    'export_reports',
    // Quiz permissions for active advisors
    'take_quiz',
    'view_take_quiz',
    // Feedback permissions for active advisors
    'manage_feedback',
    'view_feedback'
  ],
  trainee: [
    // Quiz permissions for trainees
    'take_quiz',
    'view_take_quiz',
    // Feedback permissions for trainees
    'manage_feedback'
  ]
} as const;

// Function to get default permissions for a role
export function getDefaultPermissions(role: string): string[] {
  // Handle specific role mapping to ensure backward compatibility
  const mappedRole = role === 'quality_analyst' ? 'quality_analyst' : 
                     role === 'qualityassurance' ? 'quality_analyst' : role;
                     
  return [...defaultPermissions[mappedRole as keyof typeof defaultPermissions] || []];
}
