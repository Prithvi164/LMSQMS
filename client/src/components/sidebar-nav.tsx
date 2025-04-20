import { Link, useLocation } from 'wouter';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { 
  LayoutDashboard, 
  GraduationCap, 
  Users,
  ClipboardCheck,
  LogOut,
  BookOpen,
  FileCheck,
  CheckSquare,
  FileSpreadsheet,
  Cloud,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Menu,
  MessageSquare,
  FileAudio
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { usePermissions } from '@/hooks/use-permissions';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

export function SidebarNav() {
  const [location] = useLocation();
  const { logout, user } = useAuth();
  const [isCollapsed, setIsCollapsed] = useState(false);
  
  // Load collapsed state from localStorage
  useEffect(() => {
    const savedState = localStorage.getItem('sidebarCollapsed');
    if (savedState !== null) {
      setIsCollapsed(savedState === 'true');
    }
  }, []);
  
  // Save collapsed state to localStorage
  const toggleSidebar = () => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    localStorage.setItem('sidebarCollapsed', String(newState));
  };

  // Query organization settings to get feature type
  const { data: settings } = useQuery({
    queryKey: [`/api/organizations/${user?.organizationId}/settings`],
    enabled: !!user?.organizationId
  });

  const featureType = settings?.featureType || 'BOTH'; // Default to BOTH if not set
  console.log('Current feature type:', featureType);
  console.log('Current user category:', user?.category);

  const isTrainee = user?.category === 'trainee';
  const isQualityAnalyst = user?.role === 'quality_analyst';
  const { hasPermission } = usePermissions();

  // Define which features belong to which category with permission checks
  const lmsFeatures = [
    { href: '/batch-management', label: 'Batch Management', icon: Users, 
      permission: 'manage_batches' }, // Using manage_batches as the control permission
    { href: '/trainee-management', label: 'Trainee Management', icon: ClipboardCheck, 
      permission: 'view_trainee_management' },
    { href: '/quiz-management', label: 'Quiz Management', icon: BookOpen, 
      permission: 'view_quiz' }, // Only show if user has view_quiz permission
  ];
  
  // Define QMS features with permission checks
  const qmsFeatures = [
    { href: '/evaluation-templates', label: 'Evaluation Forms', icon: CheckSquare,
      permission: 'view_evaluation_form' },
    { href: '/conduct-evaluation', label: 'Conduct Evaluation', icon: FileSpreadsheet,
      permission: 'manage_conduct_form' },
    { href: '/evaluation-feedback', label: 'Evaluation Feedback', icon: MessageSquare,
      permission: 'manage_evaluation_feedback' },
    { href: '/audio-assignment-dashboard', label: 'Assignment Dashboard', icon: CalendarDays,
      permission: 'view_allocation' },
    { href: '/azure-storage', label: 'Browse Storage', icon: Cloud,
      permission: 'view_allocation' },
    { href: '/azure-storage-management', label: 'Manage Storage', icon: FileAudio,
      permission: 'view_allocation' },
  ];

  // Define the type for navigation items
  type NavItem = {
    href: string;
    label: string;
    icon: React.ComponentType<any>;
    permission?: string;
  };

  // Filter non-trainee navigation items based on feature type setting AND permissions
  const getNonTraineeItems = () => {
    // First get the features based on feature type
    let features: NavItem[] = [];
    switch (featureType) {
      case 'LMS': 
        features = lmsFeatures;
        break;
      case 'QMS': 
        features = qmsFeatures;
        break;
      case 'BOTH':
      default:
        features = [...lmsFeatures, ...qmsFeatures];
        break;
    }
    
    // Then filter based on permissions
    return features.filter(item => {
      // If no permission specified, always show
      if (!item.permission) return true;
      // Otherwise, only show if user has the permission
      return hasPermission(item.permission);
    });
  };

  const navItems: NavItem[] = [
    { href: '/', label: 'Dashboard', icon: LayoutDashboard },
    ...(isTrainee ? [
      { href: '/my-quizzes', label: 'My Quizzes', icon: FileCheck }
    ] : getNonTraineeItems()),
  ];

  // Determine app name based on feature type
  const getAppName = () => {
    switch (featureType) {
      case 'LMS': 
        return 'CloudLMS';
      case 'QMS': 
        return 'CloudQMS';
      case 'BOTH':
      default:
        return 'CloudLMS+QMS';
    }
  };

  return (
    <div className={cn(
      "h-screen bg-sidebar border-r border-sidebar-border p-4 flex flex-col transition-all duration-300 ease-in-out",
      isCollapsed ? "w-[70px]" : "w-64"
    )}>
      <div className="flex items-center justify-between mb-8">
        {!isCollapsed && (
          <h2 className="text-xl font-bold text-sidebar-foreground">{getAppName()}</h2>
        )}
        <Button 
          variant="ghost" 
          size="sm"
          className="ml-auto text-sidebar-foreground hover:bg-sidebar-accent/50 p-1 h-8 w-8"
          onClick={toggleSidebar}
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>

      <nav className="space-y-2 flex-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location === item.href;

          return (
            <Link key={item.href} href={item.href}>
              <Button
                variant="ghost"
                className={cn(
                  "w-full justify-start",
                  isActive 
                    ? "bg-sidebar-accent text-sidebar-accent-foreground" 
                    : "text-sidebar-foreground hover:bg-sidebar-accent/50",
                  isCollapsed && "px-2 justify-center"
                )}
                title={isCollapsed ? item.label : undefined}
              >
                <Icon className={cn("h-4 w-4", isCollapsed ? "mr-0" : "mr-3")} />
                {!isCollapsed && item.label}
              </Button>
            </Link>
          );
        })}
      </nav>

      <Button 
        variant="ghost" 
        className={cn(
          "text-sidebar-foreground hover:bg-sidebar-accent/50",
          isCollapsed ? "px-2 justify-center w-full" : "w-full justify-start"
        )}
        onClick={() => logout()}
        title={isCollapsed ? "Logout" : undefined}
      >
        <LogOut className={cn("h-4 w-4", isCollapsed ? "mr-0" : "mr-3")} />
        {!isCollapsed && "Logout"}
      </Button>
    </div>
  );
}