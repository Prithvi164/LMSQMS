import { useQuery } from "@tanstack/react-query";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import type { User } from "@shared/schema";

// Helper function to get initials from name
const getInitials = (name: string) => {
  return name
    .split(' ')
    .map(part => part[0])
    .join('')
    .toUpperCase();
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

interface TreeNodeProps {
  node: TreeNode;
  isLast: boolean;
  level?: number;
}

// Tree Node Component
const TreeNode = ({ node, isLast, level = 0 }: TreeNodeProps) => {
  const paddingLeft = level * 40;

  return (
    <div className="relative">
      <div
        className="absolute border-l-2 border-dashed border-muted h-full left-6"
        style={{ 
          display: level > 0 ? 'block' : 'none',
          marginLeft: paddingLeft 
        }}
      />

      <div className="relative flex items-center py-2" style={{ paddingLeft: paddingLeft + (level > 0 ? 24 : 0) }}>
        {level > 0 && (
          <div 
            className="absolute border-t-2 border-dashed border-muted w-6 left-0"
            style={{ marginLeft: paddingLeft }}
          />
        )}

        <Card className="flex items-center p-2 gap-3 min-w-[300px]">
          <Avatar className="h-10 w-10">
            <AvatarFallback>
              {getInitials(node.user.fullName || node.user.username)}
            </AvatarFallback>
          </Avatar>
          <div>
            <div className="font-medium">{node.user.fullName || node.user.username}</div>
            <div className="text-sm text-muted-foreground flex items-center gap-2">
              <Badge variant="outline" className="capitalize">
                {node.user.role}
              </Badge>
              {node.user.employeeId && (
                <span className="text-xs">ID: {node.user.employeeId}</span>
              )}
            </div>
          </div>
        </Card>
      </div>

      {node.children.map((child, index) => (
        <TreeNode
          key={child.user.id}
          node={child}
          isLast={index === node.children.length - 1}
          level={level + 1}
        />
      ))}
    </div>
  );
};

export function OrganizationTree() {
  const { user } = useAuth();

  const { data: users = [], isLoading } = useQuery<User[]>({
    queryKey: ["/api/users"],
    enabled: !!user,
  });

  if (isLoading) {
    return <div>Loading organization structure...</div>;
  }

  // Find the root user (owner or highest level manager)
  const rootUser = users.find(u => u.role === "owner");
  if (!rootUser) return <div>No organization structure found</div>;

  const orgTree = [{
    user: rootUser,
    children: buildOrgTree(users, rootUser.id)
  }];

  return (
    <div className="p-4 space-y-6">
      <h2 className="text-2xl font-bold">Organization Structure</h2>
      <div className="overflow-x-auto">
        <div className="min-w-[800px]">
          {orgTree.map((node, index) => (
            <TreeNode
              key={node.user.id}
              node={node}
              isLast={index === orgTree.length - 1}
            />
          ))}
        </div>
      </div>
    </div>
  );
}