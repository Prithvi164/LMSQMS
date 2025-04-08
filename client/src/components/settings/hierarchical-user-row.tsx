import React from "react";
import { ChevronDown, ChevronRight, Trash2, User as UserRound, MapPin } from "lucide-react";
import { User } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TableCell, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface HierarchicalUserRowProps {
  user: User;
  users: User[];
  level: number;
  expandedManagers: number[];
  toggleExpanded: (userId: number) => void;
  getManagerName: (managerId: number | null) => string;
  getLocationName: (locationId: number | null) => string;
  getProcessNames: (userId: number) => string;
  canManageUsers: boolean;
  canDeleteUsers: boolean;
  editUserComponent: (user: User) => React.ReactNode;
  toggleUserStatus: (userId: number, currentStatus: boolean, userRole: string) => void;
  handleDeleteClick: (user: User) => void;
  getFormattedReportingPath: (userId: number, users: User[]) => string;
}

export const HierarchicalUserRow: React.FC<HierarchicalUserRowProps> = ({
  user,
  users,
  level,
  expandedManagers,
  toggleExpanded,
  getManagerName,
  getLocationName,
  getProcessNames,
  canManageUsers,
  canDeleteUsers,
  editUserComponent,
  toggleUserStatus,
  handleDeleteClick,
  getFormattedReportingPath
}) => {
  // Find direct reports (users whose manager is the current user)
  const directReports = users.filter(u => u.managerId === user.id);
  const hasDirectReports = directReports.length > 0;
  const isExpanded = expandedManagers.includes(user.id);
  
  // Calculate indentation based on hierarchy level
  const indentPadding = level * 20; // 20px per level
  
  // Determine if this entry is directly matched by filters
  const isFilterMatch = users.some(u => u.id === user.id);
  
  // Role colors using style instead of variant
  const getRoleStyle = (role: string): string => {
    switch (role) {
      case 'owner': return 'bg-destructive text-destructive-foreground';
      case 'admin': return 'bg-primary text-primary-foreground';
      case 'manager': return 'bg-purple-500 text-white';
      case 'team_lead': return 'bg-indigo-500 text-white';
      case 'trainer': return 'bg-amber-500 text-white';
      case 'advisor': return 'bg-teal-500 text-white';
      case 'trainee': return 'bg-secondary text-secondary-foreground';
      default: return 'bg-muted text-muted-foreground';
    }
  };
  
  return (
    <>
      <TableRow 
        key={user.id} 
        className={cn(
          "transition-all duration-200 hover:bg-muted/40",
          !user.active && "opacity-50",
          !isFilterMatch && "opacity-70"
        )}
      >
        <TableCell>
          <div className="relative flex items-center" style={{ paddingLeft: `${indentPadding}px` }}>
            {/* Hierarchy connector lines */}
            {level > 0 && (
              <div 
                className="absolute left-0 top-0 bottom-0 border-l-2 border-muted-foreground/20" 
                style={{ left: `${(level-1) * 20 + 10}px`, height: "100%" }}
              />
            )}
            {level > 0 && (
              <div 
                className="absolute border-t-2 border-muted-foreground/20" 
                style={{ left: `${(level-1) * 20 + 10}px`, width: "10px", top: "50%" }}
              />
            )}
            {/* Expand/collapse button for users with direct reports */}
            {hasDirectReports && (
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-6 w-6 p-0 mr-1" 
                onClick={() => toggleExpanded(user.id)}
              >
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </Button>
            )}
            
            {/* Indentation for users without direct reports */}
            {!hasDirectReports && level > 0 && (
              <div className="w-7"></div>
            )}
            
            <span className="font-medium">{user.username}</span>
          </div>
        </TableCell>
        <TableCell>
          <span className={cn(
            "text-sm",
            !isFilterMatch && "text-muted-foreground"
          )}>{user.email}</span>
        </TableCell>
        <TableCell>
          <span className={cn(
            "font-medium",
            !isFilterMatch && "text-muted-foreground"
          )}>{user.fullName}</span>
        </TableCell>
        <TableCell>
          <div className={cn(
            "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize",
            getRoleStyle(user.role)
          )}>
            {user.role}
          </div>
        </TableCell>
        <TableCell>
          <Badge 
            variant={user.category === 'trainee' ? 'secondary' : 'outline'}
            className={cn(
              "capitalize",
              isFilterMatch && "ring-1 ring-offset-1",
              user.category === 'trainee' && isFilterMatch && "ring-secondary/30",
              user.category === 'active' && isFilterMatch && "ring-primary/30"
            )}
          >
            {user.category || 'active'}
          </Badge>
        </TableCell>
        <TableCell>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className={cn(
                  "cursor-help flex items-center w-fit px-1.5 py-0.5 rounded text-sm border border-muted",
                  user.managerId ? "bg-muted/40" : "italic text-muted-foreground"
                )}>
                  {user.managerId && <UserRound className="h-3 w-3 mr-1.5 opacity-70" />}
                  <span className={!user.managerId ? "text-xs" : ""}>
                    {getManagerName(user.managerId)}
                  </span>
                </div>
              </TooltipTrigger>
              <TooltipContent className="max-w-[250px]">
                <div className="space-y-1">
                  <p className="font-medium">Reporting Path:</p>
                  <p className="text-sm">{getFormattedReportingPath(user.id, users)}</p>
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </TableCell>
        <TableCell>
          <div className={cn(
            "w-fit px-1.5 py-0.5 rounded text-sm border border-muted flex items-center",
            user.locationId ? "bg-muted/40" : "italic text-muted-foreground"
          )}>
            {user.locationId && <MapPin className="h-3 w-3 mr-1.5 opacity-70" />}
            <span className={!user.locationId ? "text-xs" : ""}>
              {getLocationName(user.locationId)}
            </span>
          </div>
        </TableCell>
        <TableCell>
          <div className="max-w-[200px]">
            {getProcessNames(user.id) ? (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex flex-col space-y-1 cursor-help">
                      {getProcessNames(user.id).split(", ").map((process, idx) => (
                        <Badge key={idx} variant="outline" className="justify-start text-left w-full truncate">
                          {process}
                        </Badge>
                      ))}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="max-w-xs">
                    <p className="font-medium text-sm">Assigned Processes:</p>
                    <ul className="list-disc list-inside text-xs mt-1">
                      {getProcessNames(user.id).split(", ").map((process, idx) => (
                        <li key={idx}>{process}</li>
                      ))}
                    </ul>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : (
              <span className="text-muted-foreground text-sm italic">No processes</span>
            )}
          </div>
        </TableCell>
        <TableCell>
          {user.role === "owner" ? (
            <div className="flex items-center" title="Owner status cannot be changed">
              <Switch
                checked={true}
                disabled={true}
                className="opacity-50 cursor-not-allowed"
              />
            </div>
          ) : canManageUsers ? (
            <Switch
              checked={user.active}
              onCheckedChange={(checked) => toggleUserStatus(user.id, user.active, user.role)}
            />
          ) : (
            <Switch checked={user.active} disabled={true} />
          )}
        </TableCell>
        {canManageUsers && (
          <TableCell className="text-right">
            <div className="flex justify-end gap-2">
              {editUserComponent(user)}
              {user.role !== "owner" && canDeleteUsers && (
                <Button
                  variant="outline"
                  size="icon"
                  className="text-destructive hover:bg-destructive/10"
                  onClick={() => handleDeleteClick(user)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </TableCell>
        )}
      </TableRow>
      
      {/* Render direct reports recursively when expanded */}
      {isExpanded && hasDirectReports && directReports.map(report => (
        <HierarchicalUserRow 
          key={report.id}
          user={report}
          users={users}
          level={level + 1}
          expandedManagers={expandedManagers}
          toggleExpanded={toggleExpanded}
          getManagerName={getManagerName}
          getLocationName={getLocationName}
          getProcessNames={getProcessNames}
          canManageUsers={canManageUsers}
          canDeleteUsers={canDeleteUsers}
          editUserComponent={editUserComponent}
          toggleUserStatus={toggleUserStatus}
          handleDeleteClick={handleDeleteClick}
          getFormattedReportingPath={getFormattedReportingPath}
        />
      ))}
    </>
  );
};