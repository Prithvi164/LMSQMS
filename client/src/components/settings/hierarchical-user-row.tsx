import React from "react";
import { ChevronDown, ChevronRight, Trash2 } from "lucide-react";
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
  
  return (
    <>
      <TableRow key={user.id} className={cn(!user.active && "opacity-50")}>
        <TableCell>
          <div className="flex items-center" style={{ paddingLeft: `${indentPadding}px` }}>
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
        <TableCell>{user.email}</TableCell>
        <TableCell>{user.fullName}</TableCell>
        <TableCell>
          <Badge>{user.role}</Badge>
        </TableCell>
        <TableCell>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="cursor-help underline decoration-dotted">
                  {getManagerName(user.managerId)}
                </span>
              </TooltipTrigger>
              <TooltipContent>
                <p>Reporting Path: {getFormattedReportingPath(user.id, users)}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </TableCell>
        <TableCell>{getLocationName(user.locationId)}</TableCell>
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