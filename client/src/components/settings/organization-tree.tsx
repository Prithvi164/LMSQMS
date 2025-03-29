import { useQuery } from "@tanstack/react-query";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { 
  Search, 
  Building, 
  Map, 
  ZoomIn, 
  ZoomOut, 
  Users, 
  ChevronUp, 
  RotateCcw,
  Briefcase,
  Calendar,
  GraduationCap
} from "lucide-react";
import { useState, useRef, useEffect } from "react";
import type { User } from "@shared/schema";

// Helper function to get initials from name
const getInitials = (name: string) => {
  return name
    .split(' ')
    .map(part => part[0])
    .join('')
    .toUpperCase();
};

// Helper function to get a random color based on name
const getAvatarColor = (name: string) => {
  // Using darker, more vibrant colors for better visibility
  const colors = [
    'bg-blue-600',
    'bg-indigo-600',
    'bg-purple-600',
    'bg-pink-600',
    'bg-red-600',
    'bg-orange-600',
    'bg-yellow-600',
    'bg-emerald-600',
    'bg-teal-600',
    'bg-cyan-600'
  ];
  
  // Generate a hash from the name
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  // Use the hash to select a color
  const index = Math.abs(hash) % colors.length;
  return colors[index];
};

interface TreeNode {
  user: User;
  children: TreeNode[];
}

// Helper function to build the tree structure
const buildOrgTree = (users: User[], rootUserId: number | null = null): TreeNode[] => {
  const children = users.filter(user => user.managerId === rootUserId);
  if (!children.length) return [];

  return children.map(child => ({
    user: child,
    children: buildOrgTree(users, child.id)
  }));
};

// Find a user's reporting hierarchy
const findUserHierarchy = (
  userId: number, 
  allUsers: User[]
): TreeNode | null => {
  const currentUser = allUsers.find(u => u.id === userId);
  if (!currentUser) return null;
  
  return {
    user: currentUser,
    children: buildOrgTree(allUsers, currentUser.id)
  };
};

interface UserCardProps {
  user: User;
  color?: string;
  department?: string;
  location?: string;
  processName?: string;
  batchInfo?: {
    name: string;
    status: string;
  } | null;
  reportCount?: number;
}

// User Card Component
const UserCard = ({ 
  user, 
  color, 
  department = "", 
  location = "", 
  processName = "", 
  batchInfo = null, 
  reportCount = 0 
}: UserCardProps) => {
  const avatarColor = color || getAvatarColor(user.fullName || user.username);
  const roleColor = user.role === "owner" ? "bg-primary" : 
                   user.role === "admin" ? "bg-indigo-600" : 
                   user.role === "manager" ? "bg-emerald-600" : 
                   user.role === "trainer" ? "bg-orange-600" : 
                   "bg-blue-600";
  
  return (
    <Card className="min-w-[260px] max-w-[260px] shadow-lg hover:shadow-xl transition-all p-0 overflow-hidden border-2 border-muted">
      {/* Colored header based on role */}
      <div className={`${roleColor} h-2 w-full`}></div>
      
      <div className="p-4">
        <div className="flex flex-col items-center text-center mb-3">
          <Avatar className={`h-16 w-16 ${avatarColor} text-white mb-3 ring-4 ring-background shadow-md`}>
            <AvatarFallback className="text-xl font-bold">
              {getInitials(user.fullName || user.username)}
            </AvatarFallback>
          </Avatar>
          <div className="font-bold text-base truncate w-full">{user.fullName || user.username}</div>
          <div className="text-sm text-muted-foreground truncate w-full mt-1">
            {user.role && user.role.replace(/_/g, " ")}
          </div>
        </div>
        
        <div className="flex justify-center mb-3">
          <Badge variant={user.role === "owner" ? "default" : "outline"} 
                 className={`capitalize ${user.role === "owner" ? "bg-primary-600" : ""} px-3 py-1`}>
            {user.role}
          </Badge>
        </div>
        
        <div className="text-xs text-muted-foreground space-y-2 bg-muted/20 p-2 rounded-md">
          {department && (
            <div className="flex items-center justify-center gap-1">
              <Building className="h-3 w-3 text-primary/70" />
              <span className="truncate font-medium">{department}</span>
            </div>
          )}
          {location && (
            <div className="flex items-center justify-center gap-1">
              <Map className="h-3 w-3 text-primary/70" />
              <span className="truncate font-medium">{location}</span>
            </div>
          )}
          {processName && (
            <div className="flex items-center justify-center gap-1">
              <Briefcase className="h-3 w-3 text-primary/70" />
              <span className="truncate font-medium">{processName}</span>
            </div>
          )}
          {batchInfo && (
            <div className="flex items-center justify-center gap-1">
              <GraduationCap className="h-3 w-3 text-primary/70" />
              <span className="truncate font-medium">
                {batchInfo.name} 
                <span className={`ml-1 inline-block w-2 h-2 rounded-full ${
                  batchInfo.status === 'active' ? 'bg-green-500' : 
                  batchInfo.status === 'completed' ? 'bg-blue-500' : 
                  batchInfo.status === 'on_hold' ? 'bg-amber-500' : 
                  'bg-gray-500'
                }`}></span>
              </span>
            </div>
          )}
        </div>
        
        {reportCount > 0 && (
          <div className="mt-3 pt-2 border-t border-border flex justify-center">
            <Badge variant="secondary" className="text-xs px-2 py-1 bg-muted/50 hover:bg-muted">
              {reportCount} direct {reportCount === 1 ? 'report' : 'reports'}
            </Badge>
          </div>
        )}
      </div>
    </Card>
  );
};

interface OrgNodeProps {
  node: TreeNode;
  level: number;
}

// Organization Node Component for horizontal tree
const OrgNode = ({ node, level }: OrgNodeProps) => {
  const { user: currentUser } = useAuth();
  const isRoot = level === 0;
  const hasChildren = node.children.length > 0;
  
  // Get the location information from the API using React Query
  const { data: locations = [] } = useQuery<{ id: number; name: string; }[]>({
    queryKey: ["/api/organizations", currentUser?.organizationId, "locations"],
    enabled: !!currentUser?.organizationId,
  });
  
  // Get processes for the organization
  const { data: processes = [] } = useQuery<{ id: number; name: string; }[]>({
    queryKey: ["/api/organizations", currentUser?.organizationId, "processes"],
    enabled: !!currentUser?.organizationId,
  });
  
  // Get batch information
  const { data: batches = [] } = useQuery<{ 
    id: number; 
    name: string; 
    status: string;
    processId: number;
  }[]>({
    queryKey: ["/api/organizations", currentUser?.organizationId, "batches"],
    enabled: !!currentUser?.organizationId,
  });
  
  // Function to get location name based on locationId
  const getLocationName = (user: User): string => {
    if (!user.locationId) return "";
    
    const location = locations.find(loc => loc.id === user.locationId);
    return location ? location.name : "";
  };
  
  // Function to get process name for a user - simplified for display purposes
  const getProcessName = (user: User): string => {
    // Show a process name based on role for visualization only
    if (user.role === "trainer") {
      return "Training Process";
    } else if (user.role === "trainee") {
      return "Learning Process";
    } else if (user.role === "quality_analyst") {
      return "QA Process";
    }
    return "";
  };
  
  // Function to get batch information for a user - simplified for display purposes
  const getBatchInfo = (user: User) => {
    // Only show batch info for trainees
    if (user.role === "trainee") {
      return {
        name: "Current Training Batch",
        status: "active"
      };
    }
    return null;
  };
  
  return (
    <div className="flex flex-col items-center">
      {/* User card */}
      <div className="mb-6">
        <UserCard 
          user={node.user}
          // Use a safe way to pass department data
          department={node.user.role === "trainee" ? "Training" : node.user.role === "trainer" ? "Training" : "Management"}
          // Pass location information or empty string
          location={getLocationName(node.user)}
          // Pass process information
          processName={getProcessName(node.user)}
          // Pass batch information
          batchInfo={getBatchInfo(node.user)}
          reportCount={node.children.length}
        />
      </div>
      
      {/* Connector line to children */}
      {hasChildren && (
        <div className="w-[2px] h-10 bg-primary/30" />
      )}
      
      {/* Children */}
      {hasChildren && (
        <div className="relative">
          {/* Horizontal connecting line */}
          <div className="absolute left-1/2 -translate-x-1/2 -top-6 h-6 w-[2px] bg-primary/30" />
          
          {/* Horizontal line above children */}
          <div 
            className={`absolute h-[2px] bg-primary/30 ${node.children.length > 1 ? 'left-0 right-0' : 'w-0'}`} 
            style={{ top: '-6px' }} 
          />
          
          <div className="flex gap-8 mt-4">
            {node.children.map((child, index) => (
              <div key={child.user.id} className="relative">
                {/* Vertical connecting line to parent */}
                {node.children.length > 1 && index > 0 && (
                  <div className="absolute left-1/2 -translate-x-1/2 -top-6 h-6 w-[2px] bg-primary/30" />
                )}
                <OrgNode node={child} level={level + 1} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export function OrganizationTree() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [groupByDepartment, setGroupByDepartment] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [viewMode, setViewMode] = useState<'full' | 'myHierarchy'>('full');
  
  const chartContainerRef = useRef<HTMLDivElement>(null);

  const { data: users = [], isLoading } = useQuery<User[]>({
    queryKey: ["/api/users"],
    enabled: !!user,
  });

  // Zoom in function
  const zoomIn = () => {
    setZoomLevel(prev => Math.min(prev + 0.1, 2));
  };

  // Zoom out function
  const zoomOut = () => {
    setZoomLevel(prev => Math.max(prev - 0.1, 0.5));
  };

  // Reset zoom function
  const resetZoom = () => {
    setZoomLevel(1);
  };

  // View top of organization
  const viewFullOrg = () => {
    setViewMode('full');
  };

  // View my reporting hierarchy
  const viewMyHierarchy = () => {
    setViewMode('myHierarchy');
  };
  
  // Scroll to center when zoom changes
  useEffect(() => {
    if (chartContainerRef.current) {
      const container = chartContainerRef.current;
      const scrollToCenter = () => {
        // Get the container dimensions
        const containerWidth = container.offsetWidth;
        const containerHeight = container.offsetHeight;
        
        // Get the content dimensions
        const contentWidth = container.scrollWidth;
        const contentHeight = container.scrollHeight;
        
        // Calculate the center point
        const scrollLeft = (contentWidth - containerWidth) / 2;
        const scrollTop = (contentHeight - containerHeight) / 2;
        
        // Scroll to center
        container.scrollTo(scrollLeft, scrollTop);
      };
      
      scrollToCenter();
    }
  }, [zoomLevel, viewMode]);

  if (isLoading) {
    return (
      <div className="p-4">
        <div className="h-8 w-64 bg-muted animate-pulse rounded mb-6" />
        <div className="h-40 w-full bg-muted animate-pulse rounded-lg" />
      </div>
    );
  }

  // Find the root user (owner or highest level manager)
  const rootUser = users.find(u => u.role === "owner");
  if (!rootUser) return <div>No organization structure found</div>;

  // Build the appropriate tree based on view mode
  let displayTree: TreeNode[] = [];
  
  if (viewMode === 'full') {
    displayTree = [{
      user: rootUser,
      children: buildOrgTree(users, rootUser.id)
    }];
  } else if (viewMode === 'myHierarchy' && user) {
    const myHierarchy = findUserHierarchy(user.id, users);
    if (myHierarchy) {
      displayTree = [myHierarchy];
    } else {
      // Fallback to full org if user's hierarchy not found
      displayTree = [{
        user: rootUser,
        children: buildOrgTree(users, rootUser.id)
      }];
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h2 className="text-2xl font-bold">Organization Structure</h2>
        
        <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search Employee" 
              className="pl-8"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              className="flex items-center gap-1" 
              onClick={viewFullOrg}
              disabled={viewMode === 'full'}
            >
              <ChevronUp className="h-4 w-4" />
              <span className="hidden sm:inline">Top of Org</span>
            </Button>
            
            <Button 
              variant="outline" 
              size="sm" 
              className="flex items-center gap-1"
              onClick={viewMyHierarchy}
              disabled={viewMode === 'myHierarchy'}
            >
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">My Hierarchy</span>
            </Button>
            
            <div className="flex items-center gap-2 ml-2">
              <span className="text-sm text-muted-foreground whitespace-nowrap">Group by dept</span>
              <div 
                className={`h-5 w-10 rounded-full p-0.5 cursor-pointer transition-colors ${groupByDepartment ? 'bg-primary' : 'bg-muted'}`}
                onClick={() => setGroupByDepartment(!groupByDepartment)}
              >
                <div 
                  className={`h-4 w-4 rounded-full bg-white transform transition-transform ${groupByDepartment ? 'translate-x-5' : 'translate-x-0'}`}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div 
        className="bg-muted/30 rounded-lg p-6 overflow-auto" 
        style={{ minHeight: '400px', maxHeight: '70vh' }}
        ref={chartContainerRef}
      >
        {/* Zoom controls */}
        <div className="fixed bottom-6 right-6 flex flex-col gap-2 z-10">
          <Button size="icon" variant="outline" onClick={zoomIn} className="rounded-full bg-background">
            <ZoomIn size={18} />
          </Button>
          <Button size="icon" variant="outline" onClick={zoomOut} className="rounded-full bg-background">
            <ZoomOut size={18} />
          </Button>
          <Button size="icon" variant="outline" onClick={resetZoom} className="rounded-full bg-background">
            <RotateCcw size={18} />
          </Button>
        </div>
        
        <div 
          className="flex justify-center min-w-max pb-6 transition-transform duration-300"
          style={{
            transform: `scale(${zoomLevel})`,
            transformOrigin: 'center top',
          }}
        >
          <div className="org-chart">
            {displayTree.map((node) => (
              <OrgNode key={node.user.id} node={node} level={0} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}