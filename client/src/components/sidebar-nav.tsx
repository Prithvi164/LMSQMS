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
  ClipboardList
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';

export function SidebarNav() {
  const [location] = useLocation();
  const { user, logout } = useAuth();

  const baseNavItems = [
    { href: '/', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/batch-management', label: 'Batch Management', icon: Users },
    { href: '/trainee-management', label: 'Trainee Management', icon: ClipboardCheck },
    { href: '/learning-paths', label: 'Learning Paths', icon: GraduationCap },
    { href: '/performance', label: 'Performance', icon: BarChart2 },
  ];

  // Add manager-specific navigation items
  const navItems = user?.role === 'manager' 
    ? [
        ...baseNavItems,
        { 
          href: '/manager-dashboard', 
          label: 'Approval Requests', 
          icon: ClipboardList 
        }
      ]
    : baseNavItems;

  return (
    <div className="h-screen w-64 bg-sidebar border-r border-sidebar-border p-4 flex flex-col">
      <div className="mb-8">
        <h2 className="text-xl font-bold text-sidebar-foreground">CloudLMS</h2>
      </div>

      <nav className="space-y-2 flex-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href}>
              <a className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                location === item.href 
                  ? "bg-sidebar-accent text-sidebar-accent-foreground" 
                  : "text-sidebar-foreground hover:bg-sidebar-accent/50"
              )}>
                <Icon className="h-4 w-4" />
                {item.label}
              </a>
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