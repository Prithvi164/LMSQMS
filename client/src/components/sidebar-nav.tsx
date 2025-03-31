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
import { useQuery } from '@tanstack/react-query';

export function SidebarNav() {
  const [location] = useLocation();
  const { logout, user } = useAuth(); 

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

  // Define which features belong to which category
  const lmsFeatures = [
    { href: '/batch-management', label: 'Batch Management', icon: Users },
    { href: '/trainee-management', label: 'Trainee Management', icon: ClipboardCheck },
    { href: '/quiz-management', label: 'Quiz Management', icon: BookOpen },
  ];
  
  const qmsFeatures = [
    { href: '/evaluation-templates', label: 'Evaluation Forms', icon: CheckSquare },
    { href: '/conduct-evaluation', label: 'Conduct Evaluation', icon: FileSpreadsheet },
  ];

  // Filter non-trainee navigation items based on feature type setting
  const getNonTraineeItems = () => {
    switch (featureType) {
      case 'LMS': 
        return lmsFeatures;
      case 'QMS': 
        return qmsFeatures;
      case 'BOTH':
      default:
        return [...lmsFeatures, ...qmsFeatures];
    }
  };

  const navItems = [
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
    <div className="h-screen w-64 bg-sidebar border-r border-sidebar-border p-4 flex flex-col">
      <div className="mb-8">
        <h2 className="text-xl font-bold text-sidebar-foreground">{getAppName()}</h2>
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