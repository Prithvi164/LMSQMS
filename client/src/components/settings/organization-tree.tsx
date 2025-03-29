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
  RotateCcw 
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
  const colors = [
    'bg-blue-500',
    'bg-indigo-500',
    'bg-purple-500',
    'bg-pink-500',
    'bg-red-500',
    'bg-orange-500',
    'bg-yellow-500',
    'bg-green-500',
    'bg-teal-500',
    'bg-cyan-500'
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
  reportCount?: number;
}

// User Card Component
const UserCard = ({ user, color, department = "", location = "", reportCount = 0 }: UserCardProps) => {
  const avatarColor = color || getAvatarColor(user.fullName || user.username);
  
  return (
    <Card className="min-w-[240px] max-w-[240px] shadow-md hover:shadow-lg transition-shadow p-3">
      <div className="flex flex-col items-center text-center mb-2">
        <Avatar className={`h-14 w-14 ${avatarColor} text-white mb-2`}>
          <AvatarFallback className="text-lg">
            {getInitials(user.fullName || user.username)}
          </AvatarFallback>
        </Avatar>
        <div className="font-semibold truncate w-full">{user.fullName || user.username}</div>
        <div className="text-sm text-muted-foreground truncate w-full">
          {user.role && user.role.replace(/_/g, " ")}
        </div>
      </div>
      
      <div className="flex justify-center mb-2">
        <Badge variant={user.role === "owner" ? "default" : "outline"} className="capitalize">
          {user.role}
        </Badge>
      </div>
      
      {(location || department) && (
        <div className="text-xs text-muted-foreground space-y-1">
          {location && (
            <div className="flex items-center justify-center gap-1">
              <Map className="h-3 w-3" />
              <span className="truncate">{location}</span>
            </div>
          )}
          {department && (
            <div className="flex items-center justify-center gap-1">
              <Building className="h-3 w-3" />
              <span className="truncate">{department}</span>
            </div>
          )}
        </div>
      )}
      
      {reportCount > 0 && (
        <div className="mt-2 pt-2 border-t border-border flex justify-center">
          <Badge variant="secondary" className="text-xs">
            {reportCount} direct {reportCount === 1 ? 'report' : 'reports'}
          </Badge>
        </div>
      )}
    </Card>
  );
};

interface OrgNodeProps {
  node: TreeNode;
  level: number;
}

// Organization Node Component for horizontal tree
const OrgNode = ({ node, level }: OrgNodeProps) => {
  const isRoot = level === 0;
  const hasChildren = node.children.length > 0;
  
  // Get the location name based on locationId if available
  const getLocationName = (user: User): string => {
    // For demonstration, we could try to find the location name based on locationId
    // In a real implementation, we would fetch the location data from the API
    return user.locationId ? `Location ID: ${user.locationId}` : "";
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
          reportCount={node.children.length}
        />
      </div>
      
      {/* Connector line to children */}
      {hasChildren && (
        <div className="w-px h-8 bg-border" />
      )}
      
      {/* Children */}
      {hasChildren && (
        <div className="relative">
          {/* Horizontal connecting line */}
          <div className="absolute left-1/2 -translate-x-1/2 -top-4 h-4 w-px bg-border" />
          
          {/* Horizontal line above children */}
          <div className={`absolute h-px bg-border ${node.children.length > 1 ? 'left-0 right-0' : 'w-0'}`} style={{ top: '-4px' }} />
          
          <div className="flex gap-6 mt-4">
            {node.children.map((child, index) => (
              <div key={child.user.id} className="relative">
                {/* Vertical connecting line to parent */}
                {node.children.length > 1 && index > 0 && (
                  <div className="absolute left-1/2 -translate-x-1/2 -top-4 h-4 w-px bg-border" />
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