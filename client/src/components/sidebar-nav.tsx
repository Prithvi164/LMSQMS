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
  FileSpreadsheet 
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useFeatures, FEATURES } from '@/hooks/use-features';

export function SidebarNav() {
  const [location] = useLocation();
  const { logout, user } = useAuth();
  const { hasAccess } = useFeatures();

  const isTrainee = user?.category === 'trainee';

  // Define all navigation items
  const allNavItems = [
    { 
      href: '/', 
      label: 'Dashboard', 
      icon: LayoutDashboard, 
      feature: 'DASHBOARD' as const
    },
    
    // LMS features
    { 
      href: '/my-quizzes', 
      label: 'My Quizzes', 
      icon: FileCheck, 
      feature: 'MY_QUIZZES' as const,
      showForTraineeOnly: true
    },
    { 
      href: '/batch-management', 
      label: 'Batch Management', 
      icon: Users, 
      feature: 'BATCH_MANAGEMENT' as const,
      hideForTrainee: true
    },
    { 
      href: '/trainee-management', 
      label: 'Trainee Management', 
      icon: ClipboardCheck, 
      feature: 'TRAINEE_MANAGEMENT' as const,
      hideForTrainee: true
    },
    { 
      href: '/quiz-management', 
      label: 'Quiz Management', 
      icon: BookOpen, 
      feature: 'QUIZ_MANAGEMENT' as const,
      hideForTrainee: true
    },
    
    // QMS features
    { 
      href: '/evaluation-templates', 
      label: 'Evaluation Forms', 
      icon: CheckSquare, 
      feature: 'EVALUATION_TEMPLATES' as const,
      hideForTrainee: true
    },
    { 
      href: '/conduct-evaluation', 
      label: 'Conduct Evaluation', 
      icon: FileSpreadsheet, 
      feature: 'CONDUCT_EVALUATION' as const,
      hideForTrainee: true
    },
  ];

  // Filter navigation items based on feature access and user role
  const navItems = allNavItems.filter(item => {
    // Check if user has access to this feature based on feature_type
    if (!hasAccess(item.feature)) {
      return false;
    }
    
    // Apply trainee-specific filtering
    if (isTrainee) {
      return !item.hideForTrainee;
    } else {
      return !item.showForTraineeOnly;
    }
  });

  return (
    <div className="h-screen w-64 bg-sidebar border-r border-sidebar-border p-4 flex flex-col">
      <div className="mb-8">
        <h2 className="text-xl font-bold text-sidebar-foreground">CloudLMS</h2>
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
                    : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                )}
              >
                <Icon className="h-4 w-4 mr-3" />
                {item.label}
              </Button>
            </Link>
          );
        })}
      </nav>

      <Button 
        variant="ghost" 
        className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent/50"
        onClick={() => logout()}
      >
        <LogOut className="h-4 w-4 mr-3" />
        Logout
      </Button>
    </div>
  );
}