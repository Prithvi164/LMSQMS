import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { X, Check } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { MultiSelect } from "@/components/ui/multi-select";
import { User, OrganizationLocation, OrganizationLineOfBusiness, OrganizationProcess } from "@shared/schema";
import { z } from "zod";
import { insertUserSchema } from "@shared/schema";

// Extended schema for the edit form
const editUserSchema = insertUserSchema.extend({
  // Handle string IDs for select fields
  locationId: z.union([z.literal("none"), z.string()]).optional()
    .transform(val => val === "none" ? null : val),
  managerId: z.union([z.literal("none"), z.string()]).optional()
    .transform(val => val === "none" ? null : val),
  // String fields with proper handling for empty values
  dateOfJoining: z.string().optional()
    .transform(val => val === "" ? null : val),
  dateOfBirth: z.string().optional()
    .transform(val => val === "" ? null : val),
  education: z.string().optional()
    .transform(val => val === "" ? null : val),
  // Required fields
  category: z.string().default("active"),
  // Process selection
  processes: z.array(z.number()).optional().default([]),
}).omit({ certified: true }).partial();

type UserFormData = z.infer<typeof editUserSchema>;

interface EditUserModalProps {
  user: User;
  isOpen: boolean;
  onClose: () => void;
  onSave: (userId: number, data: any) => Promise<void>;
  locations: OrganizationLocation[];
  users: User[];
  lineOfBusinesses: OrganizationLineOfBusiness[];
  processes: OrganizationProcess[];
  userProcesses: Record<number, any[]>;
}

export function FixedEditUserModal({
  user,
  isOpen,
  onClose,
  onSave,
  locations,
  users,
  lineOfBusinesses,
  processes,
  userProcesses
}: EditUserModalProps) {
  const [selectedLOBs, setSelectedLOBs] = useState<number[]>([]);
  const [filteredProcesses, setFilteredProcesses] = useState<OrganizationProcess[]>([]);
  const modalRef = useRef<HTMLDivElement>(null);
  
  // Safe string conversion to prevent null/undefined values
  const safeString = (value: any): string => {
    if (value === null || value === undefined) return "";
    return String(value);
  };
  
  // Create form with minimal defaults first
  const form = useForm<UserFormData>({
    resolver: zodResolver(editUserSchema),
    defaultValues: {
      username: "",
      email: "",
      role: "advisor",
      processes: [],
    }
  });
  
  // Once the modal is opened, initialize the form with the user data
  useEffect(() => {
    if (isOpen && user) {
      form.reset({
        username: safeString(user.username),
        fullName: safeString(user.fullName),
        email: safeString(user.email),
        employeeId: safeString(user.employeeId),
        role: user.role,
        phoneNumber: safeString(user.phoneNumber),
        locationId: user.locationId ? String(user.locationId) : "none",
        managerId: user.managerId ? String(user.managerId) : "none",
        dateOfJoining: safeString(user.dateOfJoining),
        dateOfBirth: safeString(user.dateOfBirth),
        education: safeString(user.education),
        active: user.active,
        category: user.category || "active",
        processes: [],
      });
      
      // Initialize selected LOBs and processes if the user has any
      const userProcessData = userProcesses[user.id] || [];
      const processIds = userProcessData.map((p: any) => p.processId);
      form.setValue("processes", processIds);
      
      // Find associated line of businesses from the process IDs
      const lobIds = processIds.map(pid => {
        const process = processes.find(p => p.id === pid);
        return process ? process.lineOfBusinessId : null;
      }).filter(Boolean) as number[];
      
      // Set unique LOBs
      const validLobIds = lobIds.filter(id => 
        lineOfBusinesses.some(lob => lob.id === id)
      );
      setSelectedLOBs(Array.from(new Set(validLobIds)));
    }
  }, [isOpen, user, form, processes, lineOfBusinesses, userProcesses]);
  
  // Update filtered processes when selected LOBs change
  useEffect(() => {
    if (selectedLOBs.length > 0) {
      const filtered = processes.filter(process => 
        selectedLOBs.includes(process.lineOfBusinessId)
      );
      setFilteredProcesses(filtered);
    } else {
      setFilteredProcesses([]);
    }
  }, [selectedLOBs, processes]);
  
  // Set up the handleSubmit function
  const handleFormSubmit = async (data: UserFormData) => {
    // Add the selected processes to the form data
    data.processes = form.getValues("processes");
    
    try {
      await onSave(user.id, data);
      onClose();
    } catch (error) {
      console.error('Error saving user:', error);
    }
  };
  
  // Event handler for the modal backdrop
  const handleBackdropClick = (e: React.MouseEvent) => {
    // Only close if clicked outside the modal
    if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
      onClose();
    }
  };
  
  // Clean up on unmount
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);
  
  if (!isOpen) return null;
  
  return createPortal(
    <div 
      className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4" 
      onClick={handleBackdropClick}
    >
      <div 
        ref={modalRef}
        className="bg-background rounded-lg shadow-lg w-full max-w-3xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Edit User</h2>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Username */}
                <FormField
                  control={form.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Username</FormLabel>
                      <FormControl>
                        <Input {...field} disabled={user.role === "owner"} value={field.value || ''} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                {/* Full Name */}
                <FormField
                  control={form.control}
                  name="fullName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full Name</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value || ''} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                {/* Email */}
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input {...field} type="email" value={field.value || ''} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                {/* Employee ID */}
                <FormField
                  control={form.control}
                  name="employeeId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Employee ID</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value || ''} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                {/* Phone Number */}
                <FormField
                  control={form.control}
                  name="phoneNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone Number</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value || ''} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                {/* Active Status */}
                <FormField
                  control={form.control}
                  name="active"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select
                        disabled={user.role === "owner"}
                        onValueChange={(value) => {
                          field.onChange(value === "true");
                        }}
                        value={field.value ? "true" : "false"}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent position="popper">
                          <SelectItem value="true">
                            Active
                          </SelectItem>
                          <SelectItem value="false">
                            Inactive
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      {user.role === "owner" && (
                        <p className="text-sm text-muted-foreground">
                          Status cannot be changed for owner accounts
                        </p>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                {/* Role */}
                <FormField
                  control={form.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Role</FormLabel>
                      <Select
                        disabled={user.role === "owner"}
                        onValueChange={(value) => {
                          field.onChange(value);
                        }}
                        value={field.value || ''}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a role" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent position="popper">
                          <SelectItem value="admin">
                            Admin
                          </SelectItem>
                          <SelectItem value="manager">
                            Manager
                          </SelectItem>
                          <SelectItem value="team_lead">
                            Team Lead
                          </SelectItem>
                          <SelectItem value="quality_analyst">
                            Quality Analyst
                          </SelectItem>
                          <SelectItem value="trainer">
                            Trainer
                          </SelectItem>
                          <SelectItem value="advisor">
                            Advisor
                          </SelectItem>
                          <SelectItem value="trainee">
                            Trainee
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      {user.role === "owner" && (
                        <p className="text-sm text-muted-foreground">
                          Role cannot be changed for owner accounts
                        </p>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                {/* Location */}
                <FormField
                  control={form.control}
                  name="locationId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Location</FormLabel>
                      <Select
                        onValueChange={(value) => {
                          field.onChange(value);
                        }}
                        value={field.value || ''}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a location" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent position="popper">
                          <SelectItem value="none">
                            No Location
                          </SelectItem>
                          {locations?.map((location) => (
                            <SelectItem 
                              key={location.id} 
                              value={location.id.toString()}
                            >
                              {location.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                {/* Manager */}
                <FormField
                  control={form.control}
                  name="managerId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Manager</FormLabel>
                      <Select
                        onValueChange={(value) => {
                          field.onChange(value);
                        }}
                        value={field.value || ''}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a manager" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent position="popper">
                          <SelectItem value="none">
                            No Manager
                          </SelectItem>
                          {users
                            .filter(u => u.id !== user.id && u.active) // Can't self-assign
                            .map(manager => (
                              <SelectItem 
                                key={manager.id} 
                                value={manager.id.toString()}
                              >
                                {manager.fullName || manager.username}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                {/* Date of Joining */}
                <FormField
                  control={form.control}
                  name="dateOfJoining"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date of Joining</FormLabel>
                      <FormControl>
                        <Input {...field} type="date" value={field.value || ''} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                {/* Date of Birth */}
                <FormField
                  control={form.control}
                  name="dateOfBirth"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date of Birth</FormLabel>
                      <FormControl>
                        <Input {...field} type="date" value={field.value || ''} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                {/* Education */}
                <FormField
                  control={form.control}
                  name="education"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Education</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value || ''} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                {/* Category */}
                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>
                      <Select
                        onValueChange={(value) => {
                          field.onChange(value);
                        }}
                        value={field.value || ''}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a category" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent position="popper">
                          <SelectItem value="active">
                            Active
                          </SelectItem>
                          <SelectItem value="trainee">
                            Trainee
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              {/* Process Selection */}
              <div className="space-y-2">
                <Label>Processes</Label>
                <div className="grid grid-cols-2 gap-4">
                  {/* Line of Business Selection */}
                  <div>
                    <Label className="text-sm font-normal">Line of Business</Label>
                    <MultiSelect
                      options={lineOfBusinesses.map(lob => ({
                        value: lob.id.toString(),
                        label: lob.name
                      }))}
                      selectedValues={selectedLOBs.map(id => id.toString())}
                      onChange={(values) => {
                        // Convert back to numbers
                        setSelectedLOBs(values.map(v => parseInt(v, 10)));
                      }}
                      placeholder="Select line of business..."
                      className="mt-1"
                    />
                  </div>
                  
                  {/* Process Selection */}
                  <div>
                    <Label className="text-sm font-normal">Processes</Label>
                    <MultiSelect
                      options={filteredProcesses.map(process => ({
                        value: process.id.toString(),
                        label: process.name
                      }))}
                      selectedValues={(form.watch("processes") || []).map(id => id.toString())}
                      onChange={(values) => {
                        // Convert back to numbers
                        form.setValue(
                          "processes", 
                          values.map(v => parseInt(v, 10))
                        );
                      }}
                      placeholder="Select processes..."
                      className="mt-1"
                    />
                  </div>
                </div>
              </div>
              
              <div className="flex justify-end gap-2 pt-4 border-t mt-4">
                <Button type="button" variant="outline" onClick={onClose}>
                  Cancel
                </Button>
                <Button type="submit">
                  Save Changes
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </div>
    </div>,
    document.body
  );
}