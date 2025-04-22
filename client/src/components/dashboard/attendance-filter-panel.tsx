import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { MultiSelect, Option } from '@/components/ui/multi-select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ChevronDown, ChevronUp, Filter } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';

// Props for the AttendanceFilterPanel component
interface AttendanceFilterPanelProps {
  onFilterChange: (filters: any) => void;
  className?: string;
}

export function AttendanceFilterPanel({ 
  onFilterChange,
  className
}: AttendanceFilterPanelProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  
  // Local state for filters
  const [processSelections, setProcessSelections] = useState<string[]>([]);
  const [batchSelections, setBatchSelections] = useState<string[]>([]);
  const [locationSelections, setLocationSelections] = useState<string[]>([]);
  const [lobSelections, setLobSelections] = useState<string[]>([]);
  const [startDate, setStartDate] = useState<string>(
    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] // 30 days ago
  );
  const [endDate, setEndDate] = useState<string>(
    new Date().toISOString().split('T')[0] // today
  );

  // Query for saved user filter preferences
  const { data: savedFilters, isLoading: filtersLoading } = useQuery({
    queryKey: ['/api/user/attendance-filter-preferences'],
    enabled: !!user,
  });

  // Query for processes with ACL check (only processes user has access to)
  const { data: processes = [], isLoading: processesLoading } = useQuery({
    queryKey: ['/api/processes/accessible'],
    enabled: !!user,
  });
  
  // Convert processes into options for MultiSelect
  const processOptions: Option[] = processes.map((process: any) => ({
    value: process.id.toString(),
    label: process.name,
  }));

  // Query for batches based on selected processes
  const { data: batches = [], isLoading: batchesLoading } = useQuery({
    queryKey: ['/api/batches', { processIds: processSelections }],
    enabled: !!user && processSelections.length > 0,
  });
  
  // Convert batches into options for MultiSelect
  const batchOptions: Option[] = batches.map((batch: any) => ({
    value: batch.id.toString(),
    label: batch.name,
  }));

  // Query for locations
  const { data: locations = [], isLoading: locationsLoading } = useQuery({
    queryKey: ['/api/locations'],
    enabled: !!user,
  });
  
  // Convert locations into options for MultiSelect
  const locationOptions: Option[] = locations.map((location: any) => ({
    value: location.id.toString(),
    label: location.name,
  }));

  // Query for lines of business
  const { data: lobs = [], isLoading: lobsLoading } = useQuery({
    queryKey: ['/api/lines-of-business'],
    enabled: !!user,
  });
  
  // Convert lines of business into options for MultiSelect
  const lobOptions: Option[] = lobs.map((lob: any) => ({
    value: lob.id.toString(),
    label: lob.name,
  }));

  // Apply saved filter preferences when data is loaded
  useEffect(() => {
    if (savedFilters && !filtersLoading) {
      setProcessSelections(savedFilters.processes || []);
      setBatchSelections(savedFilters.batches || []);
      setLocationSelections(savedFilters.locations || []);
      setLobSelections(savedFilters.lobs || []);
      
      if (savedFilters.dateRange) {
        if (savedFilters.dateRange.startDate) {
          setStartDate(savedFilters.dateRange.startDate);
        }
        if (savedFilters.dateRange.endDate) {
          setEndDate(savedFilters.dateRange.endDate);
        }
      }
    }
  }, [savedFilters, filtersLoading]);

  // Update parent component when filter changes
  useEffect(() => {
    onFilterChange({
      processes: processSelections,
      batches: batchSelections,
      locations: locationSelections,
      lobs: lobSelections,
      dateRange: {
        startDate,
        endDate
      }
    });
  }, [
    processSelections, 
    batchSelections, 
    locationSelections, 
    lobSelections, 
    startDate, 
    endDate, 
    onFilterChange
  ]);

  // Reset filters to default values
  const resetFilters = () => {
    setProcessSelections([]);
    setBatchSelections([]);
    setLocationSelections([]);
    setLobSelections([]);
    setStartDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
    setEndDate(new Date().toISOString().split('T')[0]);
  };
  
  // Check if any filter is active
  const anyFiltersActive = 
    processSelections.length > 0 || 
    batchSelections.length > 0 || 
    locationSelections.length > 0 || 
    lobSelections.length > 0 ||
    startDate !== new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] ||
    endDate !== new Date().toISOString().split('T')[0];

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className={`w-full border rounded-lg shadow-sm overflow-hidden ${className}`}
    >
      <div className="flex items-center justify-between p-4 bg-secondary/20">
        <div className="flex items-center space-x-2">
          <Filter className="w-5 h-5 text-muted-foreground" />
          <h3 className="text-sm font-medium">Attendance Filters</h3>
          {anyFiltersActive && (
            <span className="px-2 py-0.5 text-xs bg-primary text-primary-foreground rounded-full">
              Active
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {anyFiltersActive && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={resetFilters}
              className="text-xs h-8"
            >
              Reset
            </Button>
          )}
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              {open ? 
                <ChevronUp className="h-4 w-4" /> : 
                <ChevronDown className="h-4 w-4" />
              }
              <span className="sr-only">Toggle filter panel</span>
            </Button>
          </CollapsibleTrigger>
        </div>
      </div>
      <CollapsibleContent>
        <CardContent className="p-4 pt-0 grid gap-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
            {/* Process Filter */}
            <div className="space-y-2">
              <Label htmlFor="processes">Processes</Label>
              <MultiSelect
                id="processes"
                options={processOptions}
                selectedValues={processSelections}
                onValueChange={setProcessSelections}
                placeholder="Select processes"
                disabled={processesLoading}
              />
            </div>
            
            {/* Batch Filter */}
            <div className="space-y-2">
              <Label htmlFor="batches">Batches</Label>
              <MultiSelect
                id="batches"
                options={batchOptions}
                selectedValues={batchSelections}
                onValueChange={setBatchSelections}
                placeholder="Select batches"
                disabled={batchesLoading || processSelections.length === 0}
              />
            </div>
            
            {/* Location Filter */}
            <div className="space-y-2">
              <Label htmlFor="locations">Locations</Label>
              <MultiSelect
                id="locations"
                options={locationOptions}
                selectedValues={locationSelections}
                onValueChange={setLocationSelections}
                placeholder="Select locations"
                disabled={locationsLoading}
              />
            </div>
            
            {/* Line of Business Filter */}
            <div className="space-y-2">
              <Label htmlFor="lobs">Lines of Business</Label>
              <MultiSelect
                id="lobs"
                options={lobOptions}
                selectedValues={lobSelections}
                onValueChange={setLobSelections}
                placeholder="Select lines of business"
                disabled={lobsLoading}
              />
            </div>
            
            {/* Date Range Filter */}
            <div className="space-y-2">
              <Label htmlFor="start-date">Start Date</Label>
              <Input
                id="start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                max={endDate}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="end-date">End Date</Label>
              <Input
                id="end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                min={startDate}
              />
            </div>
          </div>
        </CardContent>
      </CollapsibleContent>
    </Collapsible>
  );
}