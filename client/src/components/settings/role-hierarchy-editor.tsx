import { useState } from "react";
import { motion, Reorder } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { roleEnum } from "@shared/schema";
import { defaultPermissions } from "@shared/permissions";

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
  // Get roles from the enum, excluding system roles
  const initialRoles = roleEnum.enumValues;
  const [roles, setRoles] = useState(initialRoles);
  const [selectedRole, setSelectedRole] = useState<string | null>(null);

  const handleRoleSelect = (role: string) => {
    setSelectedRole(role === selectedRole ? null : role);
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
              <div className="p-4 bg-muted rounded-lg">
                <h4 className="font-semibold capitalize mb-2">
                  {selectedRole.replace('_', ' ')} Permissions
                </h4>
                <ul className="list-disc list-inside space-y-1">
                  {defaultPermissions[selectedRole as keyof typeof defaultPermissions].map((permission) => (
                    <li key={permission} className="text-sm">
                      {permission.replace('_', ' ')}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};