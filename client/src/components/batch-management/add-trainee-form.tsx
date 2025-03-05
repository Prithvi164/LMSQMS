import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Check } from "lucide-react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { User, Organization, OrganizationProcess, OrganizationLineOfBusiness, OrganizationLocation } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";

interface AddTraineeFormProps {
  batchId: number;
  onSuccess?: () => void;
}

export function AddTraineeForm({ batchId, onSuccess }: AddTraineeFormProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedLOBs, setSelectedLOBs] = useState<number[]>([]);
  const [openLOB, setOpenLOB] = useState(false);
  const [openProcess, setOpenProcess] = useState(false);
  const [openLocation, setOpenLocation] = useState(false);

  const [newUserData, setNewUserData] = useState({
    username: "",
    password: "",
    fullName: "",
    employeeId: "",
    category: "trainee",
    email: "",
    phoneNumber: "",
    education: "",
    dateOfJoining: "",
    dateOfBirth: "",
    locationId: "none",
    processes: [] as number[],
  });

  const { data: organization } = useQuery({
    queryKey: [`/api/organizations/${user?.organizationId}`],
    enabled: !!user?.organizationId,
  });

  const { data: lineOfBusinesses = [], isLoading: isLoadingLOB } = useQuery<OrganizationLineOfBusiness[]>({
    queryKey: [`/api/organizations/${organization?.id}/line-of-businesses`],
    enabled: !!organization?.id,
    staleTime: 5 * 60 * 1000,
  });

  const { data: locations = [], isLoading: isLoadingLocations } = useQuery<OrganizationLocation[]>({
    queryKey: [`/api/organizations/${organization?.id}/locations`],
    enabled: !!organization?.id,
    staleTime: 5 * 60 * 1000,
  });

  const { data: processes = [], isLoading: isLoadingProcesses } = useQuery<OrganizationProcess[]>({
    queryKey: [`/api/organizations/${organization?.id}/processes`],
    enabled: !!organization?.id && selectedLOBs.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  const filteredProcesses = processes.filter(process =>
    selectedLOBs.includes(process.lineOfBusinessId)
  );

  const createTraineeMutation = useMutation({
    mutationFn: async (data: typeof newUserData) => {
      try {
        // Get the selected location ID
        const locationId = data.locationId !== "none" ? Number(data.locationId) : null;

        // Get the first selected LOB ID when processes are selected
        const lineOfBusinessId = selectedLOBs.length > 0 ? selectedLOBs[0] : null;

        // Create the payload
        const payload = {
          ...data,
          locationId,
          organizationId: organization?.id || null,
          processes: data.processes,
          lineOfBusinessId,
          batchId
        };

        const response = await apiRequest(`/api/batches/${batchId}/trainees`, {
          method: 'POST',
          body: JSON.stringify(payload),
        });

        return response;
      } catch (error: any) {
        throw new Error(error.message || "An unexpected error occurred");
      }
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Trainee added successfully to the batch",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/batches/${batchId}/trainees`] });
      setNewUserData({
        username: "",
        password: "",
        fullName: "",
        employeeId: "",
        category: "trainee",
        email: "",
        phoneNumber: "",
        education: "",
        dateOfJoining: "",
        dateOfBirth: "",
        locationId: "none",
        processes: [],
      });
      setSelectedLOBs([]);
      onSuccess?.();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (!organization) {
    return null;
  }

  if (isLoadingLOB || isLoadingLocations) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        createTraineeMutation.mutate(newUserData);
      }}
    >
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="username">Username</Label>
          <Input
            id="username"
            value={newUserData.username}
            onChange={(e) => setNewUserData(prev => ({
              ...prev,
              username: e.target.value
            }))}
            required
          />
        </div>

        <div>
          <Label htmlFor="fullName">Full Name</Label>
          <Input
            id="fullName"
            value={newUserData.fullName}
            onChange={(e) => setNewUserData(prev => ({
              ...prev,
              fullName: e.target.value
            }))}
            required
          />
        </div>

        <div>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={newUserData.email}
            onChange={(e) => setNewUserData(prev => ({
              ...prev,
              email: e.target.value
            }))}
            required
          />
        </div>

        <div>
          <Label htmlFor="locationId">Location</Label>
          <Popover open={openLocation} onOpenChange={setOpenLocation}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={openLocation}
                className="w-full justify-between"
              >
                {newUserData.locationId === "none"
                  ? "Select location..."
                  : locations.find(l => l.id.toString() === newUserData.locationId)?.name || "Select location..."}
                <Check
                  className={cn(
                    "ml-2 h-4 w-4",
                    newUserData.locationId !== "none" ? "opacity-100" : "opacity-0"
                  )}
                />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[200px] p-0">
              <Command>
                <CommandInput placeholder="Search location..." />
                <CommandEmpty>No location found.</CommandEmpty>
                <CommandGroup>
                  <CommandItem
                    onSelect={() => {
                      setNewUserData(prev => ({ ...prev, locationId: "none" }));
                      setOpenLocation(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        newUserData.locationId === "none" ? "opacity-100" : "opacity-0"
                      )}
                    />
                    No Location
                  </CommandItem>
                  {locations.map((location) => (
                    <CommandItem
                      key={location.id}
                      onSelect={() => {
                        setNewUserData(prev => ({
                          ...prev,
                          locationId: location.id.toString()
                        }));
                        setOpenLocation(false);
                      }}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          newUserData.locationId === location.id.toString() ? "opacity-100" : "opacity-0"
                        )}
                      />
                      {location.name}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </Command>
            </PopoverContent>
          </Popover>
        </div>

        <div>
          <Label htmlFor="employeeId">Employee ID</Label>
          <Input
            id="employeeId"
            value={newUserData.employeeId}
            onChange={(e) => setNewUserData(prev => ({
              ...prev,
              employeeId: e.target.value
            }))}
            required
          />
        </div>

        <div className="col-span-2">
          <Label>Line of Business</Label>
          <div className="flex gap-2">
            <Popover open={openLOB} onOpenChange={setOpenLOB}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={openLOB}
                  className="w-full justify-between"
                >
                  {selectedLOBs.length > 0
                    ? `${selectedLOBs.length} LOBs selected`
                    : "Select Line of Business"}
                  <Check
                    className={cn(
                      "ml-2 h-4 w-4",
                      selectedLOBs.length > 0 ? "opacity-100" : "opacity-0"
                    )}
                  />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0">
                <Command>
                  <CommandInput placeholder="Search Line of Business..." />
                  <CommandEmpty>No Line of Business found.</CommandEmpty>
                  <CommandGroup className="max-h-64 overflow-auto">
                    {lineOfBusinesses.map((lob) => (
                      <CommandItem
                        key={lob.id}
                        onSelect={() => {
                          setSelectedLOBs(prev => {
                            const newSelection = prev.includes(lob.id)
                              ? prev.filter(id => id !== lob.id)
                              : [...prev, lob.id];
                            return newSelection;
                          });
                          setNewUserData(prev => ({
                            ...prev,
                            processes: []
                          }));
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            selectedLOBs.includes(lob.id) ? "opacity-100" : "opacity-0"
                          )}
                        />
                        {lob.name}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {selectedLOBs.length > 0 && (
          <div className="col-span-2">
            <Label>Processes</Label>
            <Popover open={openProcess} onOpenChange={setOpenProcess}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={openProcess}
                  className="w-full justify-between"
                >
                  {isLoadingProcesses ? (
                    <div className="flex items-center">
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Loading processes...
                    </div>
                  ) : (
                    <>
                      {newUserData.processes.length > 0
                        ? `${newUserData.processes.length} processes selected`
                        : "Select processes"}
                      <Check
                        className={cn(
                          "ml-2 h-4 w-4",
                          newUserData.processes.length > 0 ? "opacity-100" : "opacity-0"
                        )}
                      />
                    </>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0">
                <Command>
                  <CommandInput placeholder="Search processes..." />
                  <CommandEmpty>No process found.</CommandEmpty>
                  <CommandGroup className="max-h-64 overflow-auto">
                    {filteredProcesses.map((process) => (
                      <CommandItem
                        key={process.id}
                        onSelect={() => {
                          setNewUserData(prev => {
                            const newProcesses = prev.processes.includes(process.id)
                              ? prev.processes.filter(id => id !== process.id)
                              : [...prev.processes, process.id];
                            return { ...prev, processes: newProcesses };
                          });
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            newUserData.processes.includes(process.id) ? "opacity-100" : "opacity-0"
                          )}
                        />
                        {process.name}
                        <span className="ml-2 text-muted-foreground">
                          ({lineOfBusinesses.find(l => l.id === process.lineOfBusinessId)?.name})
                        </span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
        )}

        <div>
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            value={newUserData.password}
            onChange={(e) => setNewUserData(prev => ({
              ...prev,
              password: e.target.value
            }))}
            required
          />
        </div>

        <div>
          <Label htmlFor="phoneNumber">Phone Number</Label>
          <Input
            id="phoneNumber"
            value={newUserData.phoneNumber}
            onChange={(e) => setNewUserData(prev => ({
              ...prev,
              phoneNumber: e.target.value
            }))}
            required
          />
        </div>

        <div>
          <Label htmlFor="dateOfJoining">Date of Joining</Label>
          <Input
            id="dateOfJoining"
            type="date"
            value={newUserData.dateOfJoining}
            onChange={(e) => setNewUserData(prev => ({
              ...prev,
              dateOfJoining: e.target.value
            }))}
            required
          />
        </div>

        <div>
          <Label htmlFor="dateOfBirth">Date of Birth</Label>
          <Input
            id="dateOfBirth"
            type="date"
            value={newUserData.dateOfBirth}
            onChange={(e) => setNewUserData(prev => ({
              ...prev,
              dateOfBirth: e.target.value
            }))}
            required
          />
        </div>

        <div>
          <Label htmlFor="education">Education</Label>
          <Input
            id="education"
            value={newUserData.education}
            onChange={(e) => setNewUserData(prev => ({
              ...prev,
              education: e.target.value
            }))}
          />
        </div>
      </div>

      <Button
        type="submit"
        className="w-full mt-6"
        disabled={createTraineeMutation.isPending}
      >
        {createTraineeMutation.isPending ? (
          <div className="flex items-center">
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            Adding Trainee...
          </div>
        ) : (
          "Add Trainee"
        )}
      </Button>
    </form>
  );
}