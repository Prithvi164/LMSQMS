import { useState } from "react";
import { motion, Reorder } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { roleEnum } from "@shared/schema";
import { defaultPermissions } from "@shared/permissions";
import { RoleImpactSimulator } from "./role-impact-simulator";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, X } from "lucide-react";

interface RoleCardProps {
  role: string;
  isSelected: boolean;
  onClick: () => void;
}

const RoleCard = ({ role, isSelected, onClick }: RoleCardProps) => (
  <motion.div
    whileHover={{ scale: 1.02 }}
    whileTap={{ scale: 0.98 }}
    className={`p-4 rounded-lg shadow-md mb-2 cursor-grab ${
      isSelected ? 'bg-primary text-primary-foreground' : 'bg-card'
    }`}
    onClick={onClick}
  >
    <h3 className="font-semibold capitalize">{role.replace('_', ' ')}</h3>
    <p className="text-sm opacity-80">
      {role === 'owner' && 'Full system access'}
      {role === 'admin' && 'Organization-wide administration'}
      {role === 'manager' && 'Department/team management'}
      {role === 'team_lead' && 'Team supervision'}
      {role === 'qualityassurance' && 'Quality monitoring and assurance'}
      {role === 'trainer' && 'Training delivery'}
      {role === 'advisor' && 'Support and guidance'}
    </p>
  </motion.div>
);

export const RoleHierarchyEditor = () => {
  const initialRoles = roleEnum.enumValues;
  const [roles, setRoles] = useState(initialRoles);
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [editedPermissions, setEditedPermissions] = useState<string[]>([]);
  const [isEditing, setIsEditing] = useState(false);

  const handleRoleSelect = (role: string) => {
    if (role === selectedRole) {
      setSelectedRole(null);
      setEditedPermissions([]);
      setIsEditing(false);
    } else {
      setSelectedRole(role);
      setEditedPermissions(defaultPermissions[role as keyof typeof defaultPermissions] || []);
      setIsEditing(false);
    }
  };

  const handlePermissionToggle = (permission: string) => {
    if (!isEditing) return;

    setEditedPermissions(current => {
      if (current.includes(permission)) {
        return current.filter(p => p !== permission);
      } else {
        return [...current, permission];
      }
    });
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Role Hierarchy</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Role Order (Drag to reorder)</h3>
            <Reorder.Group axis="y" values={roles} onReorder={setRoles}>
              {roles.map((role) => (
                <Reorder.Item key={role} value={role}>
                  <RoleCard
                    role={role}
                    isSelected={role === selectedRole}
                    onClick={() => handleRoleSelect(role)}
                  />
                </Reorder.Item>
              ))}
            </Reorder.Group>
          </div>
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Role Details</h3>
            {selectedRole && (
              <>
                <div className="flex justify-between items-center mb-4">
                  <h4 className="font-semibold capitalize">
                    {selectedRole.replace('_', ' ')} Permissions
                  </h4>
                  {selectedRole !== 'owner' && (
                    <Button
                      variant={isEditing ? "destructive" : "default"}
                      onClick={() => setIsEditing(!isEditing)}
                    >
                      {isEditing ? 'Cancel' : 'Edit Permissions'}
                    </Button>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {defaultPermissions[selectedRole as keyof typeof defaultPermissions]?.map((permission) => (
                    <Badge
                      key={permission}
                      variant={isEditing ? "outline" : "secondary"}
                      className={`cursor-pointer ${
                        isEditing && !editedPermissions.includes(permission)
                          ? 'opacity-50'
                          : ''
                      }`}
                      onClick={() => handlePermissionToggle(permission)}
                    >
                      {isEditing && (
                        <>
                          {editedPermissions.includes(permission) ? (
                            <Check className="h-3 w-3 mr-1" />
                          ) : (
                            <X className="h-3 w-3 mr-1" />
                          )}
                        </>
                      )}
                      {permission.replace(/_/g, ' ')}
                    </Badge>
                  ))}
                </div>

                {/* Show impact simulation when editing */}
                {isEditing && (
                  <RoleImpactSimulator
                    selectedRole={selectedRole}
                    proposedPermissions={editedPermissions}
                  />
                )}
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};