import { Link, useLocation } from 'wouter';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { 
  LayoutDashboard, 
  GraduationCap, 
  BarChart2, 
  Users,
  ClipboardCheck,
  LogOut,
  BookOpen,
  FileQuestion // Added for My Quizzes icon
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';

export function SidebarNav() {
  const [location] = useLocation();
  const { logout, user } = useAuth(); // Added user to check role

  // Define nav items based on user role
  const baseNavItems = [
    { href: '/', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/learning-paths', label: 'Learning Paths', icon: GraduationCap },
    { href: '/performance', label: 'Performance', icon: BarChart2 },
  ];

  // Add trainee-specific items
  const traineeItems = [
    { href: '/my-quizzes', label: 'My Quizzes', icon: FileQuestion },
  ];

  // Add admin/trainer items
  const adminItems = [
    { href: '/batch-management', label: 'Batch Management', icon: Users },
    { href: '/trainee-management', label: 'Trainee Management', icon: ClipboardCheck },
    { href: '/quiz-management', label: 'Quiz Management', icon: BookOpen },
  ];

  // Combine nav items based on user role
  const navItems = [
    ...baseNavItems,
    ...(user?.role === 'trainee' ? traineeItems : adminItems),
  ];

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