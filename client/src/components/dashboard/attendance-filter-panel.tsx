import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Calendar } from '@/components/ui/calendar';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { 
  Popover, 
  PopoverContent, 
  PopoverTrigger 
} from '@/components/ui/popover';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { MultiSelect } from '@/components/ui/multi-select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Loader2, CalendarIcon, FilterIcon, Save, ArrowDownToLine, X } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useUser } from '@/hooks/use-auth';
import { Badge } from '@/components/ui/badge';

// Define types
type BreakdownViewType = 'overall' | 'daily' | 'phase' | 'trainee';
type DateRange = { from: Date; to: Date } | undefined;

interface AttendanceFilterPreference {
  id: number;
  userId: number;
  organizationId: number;
  name: string;
  viewType: BreakdownViewType;
  processIds: number[] | null;
  batchIds: number[] | null;
  locationIds: number[] | null;
  lineOfBusinessIds: number[] | null;
  dateRange: { from: string; to: string } | null;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

type Process = {
  id: number;
  name: string;
}

type Batch = {
  id: number;
  name: string;
}

type Location = {
  id: number;
  name: string;
}

type LineOfBusiness = {
  id: number;
  name: string;
}

interface AttendanceFilterPanelProps {
  onFilterChange: (filters: {
    viewType: BreakdownViewType;
    processIds: number[];
    batchIds: number[];
    locationIds: number[];
    lineOfBusinessIds: number[];
    dateRange: { from: Date; to: Date } | undefined;
  }) => void;
}

export default function AttendanceFilterPanel({ onFilterChange }: AttendanceFilterPanelProps) {
  const user = useUser();
  const queryClient = useQueryClient();
  
  // Filter state
  const [isOpen, setIsOpen] = useState(true);
  const [viewType, setViewType] = useState<BreakdownViewType>('overall');
  const [selectedProcesses, setSelectedProcesses] = useState<number[]>([]);
  const [selectedBatches, setSelectedBatches] = useState<number[]>([]);
  const [selectedLocations, setSelectedLocations] = useState<number[]>([]);
  const [selectedLOBs, setSelectedLOBs] = useState<number[]>([]);
  const [dateRange, setDateRange] = useState<DateRange>(undefined);
  const [preferenceNameInput, setPreferenceNameInput] = useState('');
  const [selectedPreferenceId, setSelectedPreferenceId] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  // Data queries
  const { data: processes = [] } = useQuery({
    queryKey: ['/api/processes'],
    select: (data: any) => data.map((p: any) => ({ id: p.id, name: p.name }))
  });
  
  const { data: batches = [] } = useQuery({
    queryKey: ['/api/batches'],
    select: (data: any) => data.map((b: any) => ({ id: b.id, name: b.name }))
  });
  
  const { data: locations = [] } = useQuery({
    queryKey: ['/api/locations'],
    select: (data: any) => data.map((l: any) => ({ id: l.id, name: l.name }))
  });
  
  const { data: lineOfBusinesses = [] } = useQuery({
    queryKey: ['/api/line-of-businesses'],
    select: (data: any) => data.map((lob: any) => ({ id: lob.id, name: lob.name }))
  });
  
  // Saved preferences query
  const { data: savedPreferences = [], isLoading: isLoadingPreferences } = useQuery({
    queryKey: ['/api/attendance/filters'],
    onSuccess: () => setIsLoading(false)
  });
  
  // Default preference query
  const { data: defaultPreference, isLoading: isLoadingDefault } = useQuery({
    queryKey: ['/api/attendance/filters/default'],
    onSuccess: (data) => {
      if (data) {
        setSelectedPreferenceId(data.id);
        applyPreference(data);
      }
    },
    onError: () => {
      // No default preference is ok, just continue with default state
      setIsLoading(false);
    }
  });
  
  // Mutations
  const createPreferenceMutation = useMutation({
    mutationFn: async (preference: Omit<AttendanceFilterPreference, 'id' | 'userId' | 'organizationId' | 'createdAt' | 'updatedAt'>) => {
      return apiRequest('/api/attendance/filters', 'POST', preference);
    },
    onSuccess: () => {
      toast({
        title: "Filter preference saved",
        description: "Your filter preference has been saved.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/attendance/filters'] });
      setIsSaving(false);
      setPreferenceNameInput('');
    },
    onError: (error: any) => {
      toast({
        title: "Failed to save filter preference",
        description: error.message || "An error occurred while saving.",
        variant: "destructive"
      });
      setIsSaving(false);
    }
  });
  
  const updatePreferenceMutation = useMutation({
    mutationFn: async ({ id, ...preference }: { id: number, preference: Partial<AttendanceFilterPreference> }) => {
      return apiRequest(`/api/attendance/filters/${id}`, 'PUT', preference);
    },
    onSuccess: () => {
      toast({
        title: "Filter preference updated",
        description: "Your filter preference has been updated.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/attendance/filters'] });
      setIsSaving(false);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update filter preference",
        description: error.message || "An error occurred while updating.",
        variant: "destructive"
      });
      setIsSaving(false);
    }
  });
  
  const deletePreferenceMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest(`/api/attendance/filters/${id}`, 'DELETE');
    },
    onSuccess: () => {
      toast({
        title: "Filter preference deleted",
        description: "Your filter preference has been deleted.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/attendance/filters'] });
      setSelectedPreferenceId(null);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to delete filter preference",
        description: error.message || "An error occurred while deleting.",
        variant: "destructive"
      });
    }
  });
  
  // Helper function to apply a preference to the UI
  const applyPreference = (preference: AttendanceFilterPreference) => {
    setViewType(preference.viewType);
    setSelectedProcesses(preference.processIds || []);
    setSelectedBatches(preference.batchIds || []);
    setSelectedLocations(preference.locationIds || []);
    setSelectedLOBs(preference.lineOfBusinessIds || []);
    
    // Parse date range if it exists
    if (preference.dateRange) {
      setDateRange({
        from: new Date(preference.dateRange.from),
        to: new Date(preference.dateRange.to)
      });
    } else {
      setDateRange(undefined);
    }
  };
  
  // Update the parent component when filters change
  useEffect(() => {
    // Only trigger filter change if we're done loading
    if (!isLoading) {
      onFilterChange({
        viewType,
        processIds: selectedProcesses,
        batchIds: selectedBatches,
        locationIds: selectedLocations,
        lineOfBusinessIds: selectedLOBs,
        dateRange: dateRange
      });
    }
  }, [viewType, selectedProcesses, selectedBatches, selectedLocations, selectedLOBs, dateRange, isLoading]);
  
  // Save current filters as a preference
  const saveCurrentFilters = () => {
    if (!preferenceNameInput.trim()) {
      toast({
        title: "Name required",
        description: "Please provide a name for your filter preference.",
        variant: "destructive"
      });
      return;
    }
    
    setIsSaving(true);
    
    // Prepare date range format for API
    const apiDateRange = dateRange 
      ? { from: format(dateRange.from, 'yyyy-MM-dd'), to: format(dateRange.to, 'yyyy-MM-dd') }
      : null;
      
    const preferenceData = {
      name: preferenceNameInput,
      viewType,
      processIds: selectedProcesses.length > 0 ? selectedProcesses : null,
      batchIds: selectedBatches.length > 0 ? selectedBatches : null,
      locationIds: selectedLocations.length > 0 ? selectedLocations : null,
      lineOfBusinessIds: selectedLOBs.length > 0 ? selectedLOBs : null,
      dateRange: apiDateRange,
      isDefault: false
    };
    
    createPreferenceMutation.mutate(preferenceData);
  };
  
  // Update an existing preference
  const updatePreference = (id: number) => {
    setIsSaving(true);
    
    // Prepare date range format for API
    const apiDateRange = dateRange 
      ? { from: format(dateRange.from, 'yyyy-MM-dd'), to: format(dateRange.to, 'yyyy-MM-dd') }
      : null;
      
    const preferenceData = {
      viewType,
      processIds: selectedProcesses.length > 0 ? selectedProcesses : null,
      batchIds: selectedBatches.length > 0 ? selectedBatches : null,
      locationIds: selectedLocations.length > 0 ? selectedLocations : null,
      lineOfBusinessIds: selectedLOBs.length > 0 ? selectedLOBs : null,
      dateRange: apiDateRange
    };
    
    updatePreferenceMutation.mutate({ id, preference: preferenceData });
  };
  
  // Set a preference as default
  const setAsDefault = (id: number) => {
    updatePreferenceMutation.mutate({ id, preference: { isDefault: true } });
  };
  
  // Clear all filters
  const clearAllFilters = () => {
    setViewType('overall');
    setSelectedProcesses([]);
    setSelectedBatches([]);
    setSelectedLocations([]);
    setSelectedLOBs([]);
    setDateRange(undefined);
    setSelectedPreferenceId(null);
  };
  
  if (isLoading || isLoadingPreferences || isLoadingDefault) {
    return (
      <Card className="mb-6 p-4 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        <span>Loading filters...</span>
      </Card>
    );
  }
  
  return (
    <Card className="mb-6">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <div className="flex items-center">
            <FilterIcon className="h-5 w-5 mr-2" />
            <CardTitle>Attendance Filters</CardTitle>
            {selectedPreferenceId && (
              <Badge variant="outline" className="ml-2">
                {savedPreferences.find((p: any) => p.id === selectedPreferenceId)?.name}
              </Badge>
            )}
          </div>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm">
              {isOpen ? 'Hide' : 'Show'} Filters
            </Button>
          </CollapsibleTrigger>
        </CardHeader>
        
        <CollapsibleContent>
          <CardContent className="pt-2">
            <div className="space-y-4">
              {/* View Type Selection */}
              <div>
                <Label htmlFor="view-type">View Type</Label>
                <RadioGroup 
                  id="view-type"
                  value={viewType} 
                  onValueChange={(value) => setViewType(value as BreakdownViewType)}
                  className="flex space-x-4 mt-2"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="overall" id="overall" />
                    <Label htmlFor="overall">Overall</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="daily" id="daily" />
                    <Label htmlFor="daily">Daily</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="phase" id="phase" />
                    <Label htmlFor="phase">Phase</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="trainee" id="trainee" />
                    <Label htmlFor="trainee">Trainee</Label>
                  </div>
                </RadioGroup>
              </div>
              
              <Separator />
              
              {/* Process Selection */}
              <div>
                <Label htmlFor="processes">Processes</Label>
                <MultiSelect
                  id="processes"
                  placeholder="Select Processes"
                  options={processes.map((p: Process) => ({ label: p.name, value: p.id.toString() }))}
                  selectedValues={selectedProcesses.map(id => id.toString())}
                  onValueChange={(values) => setSelectedProcesses(values.map(v => parseInt(v)))}
                  className="mt-1"
                />
              </div>
              
              {/* Batch Selection */}
              <div>
                <Label htmlFor="batches">Batches</Label>
                <MultiSelect
                  id="batches"
                  placeholder="Select Batches"
                  options={batches.map((b: Batch) => ({ label: b.name, value: b.id.toString() }))}
                  selectedValues={selectedBatches.map(id => id.toString())}
                  onValueChange={(values) => setSelectedBatches(values.map(v => parseInt(v)))}
                  className="mt-1"
                />
              </div>
              
              {/* Location Selection */}
              <div>
                <Label htmlFor="locations">Locations</Label>
                <MultiSelect
                  id="locations"
                  placeholder="Select Locations"
                  options={locations.map((l: Location) => ({ label: l.name, value: l.id.toString() }))}
                  selectedValues={selectedLocations.map(id => id.toString())}
                  onValueChange={(values) => setSelectedLocations(values.map(v => parseInt(v)))}
                  className="mt-1"
                />
              </div>
              
              {/* Line of Business Selection */}
              <div>
                <Label htmlFor="lobs">Line of Business</Label>
                <MultiSelect
                  id="lobs"
                  placeholder="Select Line of Business"
                  options={lineOfBusinesses.map((lob: LineOfBusiness) => ({ label: lob.name, value: lob.id.toString() }))}
                  selectedValues={selectedLOBs.map(id => id.toString())}
                  onValueChange={(values) => setSelectedLOBs(values.map(v => parseInt(v)))}
                  className="mt-1"
                />
              </div>
              
              {/* Date Range Selection */}
              <div>
                <Label>Date Range</Label>
                <div className="flex items-center mt-1">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="justify-start text-left font-normal w-full">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dateRange?.from ? (
                          dateRange.to ? (
                            <>
                              {format(dateRange.from, 'LLL dd, y')} -{' '}
                              {format(dateRange.to, 'LLL dd, y')}
                            </>
                          ) : (
                            format(dateRange.from, 'LLL dd, y')
                          )
                        ) : (
                          <span>Select date range</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        initialFocus
                        mode="range"
                        defaultMonth={dateRange?.from}
                        selected={dateRange}
                        onSelect={setDateRange}
                        numberOfMonths={2}
                      />
                    </PopoverContent>
                  </Popover>
                  
                  {dateRange && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDateRange(undefined)}
                      className="ml-2"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
              
              <Separator />
              
              {/* Saved Preferences */}
              <div>
                <Label htmlFor="saved-preferences">Saved Preferences</Label>
                <div className="flex items-center mt-1 gap-2">
                  <Select 
                    value={selectedPreferenceId?.toString() || ''}
                    onValueChange={(value) => {
                      const id = parseInt(value);
                      setSelectedPreferenceId(id);
                      const preference = savedPreferences.find((p: any) => p.id === id);
                      if (preference) {
                        applyPreference(preference);
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a saved preference" />
                    </SelectTrigger>
                    <SelectContent>
                      {savedPreferences.map((pref: any) => (
                        <SelectItem key={pref.id} value={pref.id.toString()}>
                          {pref.name} {pref.isDefault && '(Default)'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  {selectedPreferenceId && (
                    <>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => updatePreference(selectedPreferenceId)}
                        disabled={isSaving}
                      >
                        {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                        Update
                      </Button>
                      
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => setAsDefault(selectedPreferenceId)}
                        disabled={isSaving || (defaultPreference?.id === selectedPreferenceId)}
                      >
                        {defaultPreference?.id === selectedPreferenceId ? 'Default' : 'Set Default'}
                      </Button>
                      
                      <Button 
                        variant="destructive" 
                        size="sm"
                        onClick={() => {
                          if (confirm('Are you sure you want to delete this preference?')) {
                            deletePreferenceMutation.mutate(selectedPreferenceId);
                          }
                        }}
                        disabled={isSaving}
                      >
                        Delete
                      </Button>
                    </>
                  )}
                </div>
              </div>
              
              {/* Save New Preference */}
              <div>
                <Label htmlFor="new-preference">Save Current Filters</Label>
                <div className="flex items-center mt-1 gap-2">
                  <input
                    id="new-preference"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    placeholder="Enter preference name"
                    value={preferenceNameInput}
                    onChange={(e) => setPreferenceNameInput(e.target.value)}
                  />
                  <Button
                    onClick={saveCurrentFilters}
                    disabled={isSaving || !preferenceNameInput.trim()}
                  >
                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
                    Save
                  </Button>
                </div>
              </div>
              
              <div className="flex justify-end mt-4">
                <Button
                  variant="outline"
                  onClick={clearAllFilters}
                >
                  Clear All Filters
                </Button>
              </div>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}