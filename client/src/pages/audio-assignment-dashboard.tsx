import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { BarChart3, ChevronDown, ChevronRight, FileAudio, Filter, Info, PieChart, RefreshCw, Calendar, ClipboardList } from 'lucide-react';
import { format, isSameDay, isThisWeek, isThisMonth, parseISO } from 'date-fns';

// Define types for the components
type AudioFileAllocation = {
  id: number;
  allocationDate: string;
  dueDate: string | null;
  status: 'pending' | 'allocated' | 'evaluated' | 'archived';
  allocatedBy: number;
  allocatedByName: string;
  qualityAnalystId: number;
  qualityAnalystName: string;
  audioFileId: number;
  audioFileName: string;
  createdAt: string;
  organizationId: number;
};

// Status color mapping
const getStatusColor = (status: string) => {
  switch (status) {
    case 'pending': return 'bg-yellow-100 text-yellow-800';
    case 'allocated': return 'bg-blue-100 text-blue-800';
    case 'evaluated': return 'bg-green-100 text-green-800';
    case 'archived': return 'bg-gray-100 text-gray-800';
    default: return 'bg-gray-100 text-gray-800';
  }
};

// Status background colors for cards
const getStatusBgColor = (status: string) => {
  switch (status) {
    case 'pending': return 'bg-yellow-50';
    case 'allocated': return 'bg-blue-50';
    case 'evaluated': return 'bg-green-50';
    case 'archived': return 'bg-gray-50';
    default: return 'bg-gray-50';
  }
};

// Format date to readable format
const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString(undefined, { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
};

const AudioAssignmentDashboard = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('today');
  const [dateFilter, setDateFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [analyticFilter, setAnalyticFilter] = useState('all');
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [expandedDate, setExpandedDate] = useState<string | null>(null);
  const [viewDetailsOpen, setViewDetailsOpen] = useState(false);
  const [selectedAllocation, setSelectedAllocation] = useState<AudioFileAllocation | null>(null);

  // Query for fetching allocations assigned to the current user only
  const { data: allocations = [], isLoading: loadingAllocations, refetch: refetchAllocations } = useQuery<AudioFileAllocation[]>({
    queryKey: ['/api/organizations/' + user?.organizationId + '/audio-file-allocations/assigned-to-me', user?.id, dateFilter, statusFilter, analyticFilter],
    enabled: !!user?.organizationId && !!user?.id,
  });

  // Filter allocations based on active tab and filters
  const getFilteredAllocations = () => {
    if (!allocations.length) return [];
    
    return allocations.filter((allocation: AudioFileAllocation) => {
      const allocationDate = parseISO(allocation.allocationDate);
      
      // Filter by tab selection (date period)
      if (activeTab === 'today' && !isSameDay(allocationDate, new Date())) {
        return false;
      } else if (activeTab === 'thisWeek' && !isThisWeek(allocationDate)) {
        return false;
      } else if (activeTab === 'thisMonth' && !isThisMonth(allocationDate)) {
        return false;
      }
      
      // Apply additional filters
      if (statusFilter !== 'all' && allocation.status !== statusFilter) {
        return false;
      }
      
      return true;
    });
  };

  const filteredAllocations = getFilteredAllocations();

  // Group allocations by date
  const groupedAllocations = filteredAllocations.reduce((groups: Record<string, AudioFileAllocation[]>, allocation: AudioFileAllocation) => {
    const date = new Date(allocation.allocationDate).toDateString();
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(allocation);
    return groups;
  }, {} as Record<string, AudioFileAllocation[]>);

  // Sort dates in descending order (newest first)
  const sortedDates = Object.keys(groupedAllocations).sort((a, b) => 
    new Date(b).getTime() - new Date(a).getTime()
  );

  // Calculate overall statistics
  const totalAssignments = filteredAllocations.length;
  const statusCounts = filteredAllocations.reduce((counts: Record<string, number>, allocation) => {
    counts[allocation.status] = (counts[allocation.status] || 0) + 1;
    return counts;
  }, {
    'pending': 0,
    'allocated': 0,
    'evaluated': 0,
    'archived': 0
  });

  // Toggle expanded date view
  const toggleDateExpansion = (date: string) => {
    if (expandedDate === date) {
      setExpandedDate(null);
    } else {
      setExpandedDate(date);
    }
  };

  // Generate status count UI for a specific date
  const generateStatusCountsForDate = (allocations: AudioFileAllocation[]) => {
    const statusCounts = allocations.reduce((counts: Record<string, number>, allocation) => {
      counts[allocation.status] = (counts[allocation.status] || 0) + 1;
      return counts;
    }, {
      'pending': 0,
      'allocated': 0,
      'evaluated': 0,
      'archived': 0
    });

    return (
      <div className="flex space-x-2 mt-1">
        {Object.entries(statusCounts).map(([status, count]) => (
          <Badge key={status} className={getStatusColor(status)}>
            {status.charAt(0).toUpperCase() + status.slice(1)}: {count}
          </Badge>
        ))}
      </div>
    );
  };

  return (
    <div className="container mx-auto py-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Audio Assignment Dashboard</h1>
        
        <div className="flex space-x-2">
          <Button variant="outline" onClick={() => refetchAllocations()}>
            <RefreshCw className="h-4 w-4 mr-1" />
            Refresh
          </Button>
          
          <Sheet open={filterSheetOpen} onOpenChange={setFilterSheetOpen}>
            <SheetTrigger asChild>
              <Button variant="outline">
                <Filter className="h-4 w-4 mr-1" />
                Filters
              </Button>
            </SheetTrigger>
            <SheetContent>
              <SheetHeader>
                <SheetTitle>Filters</SheetTitle>
                <SheetDescription>
                  Filter audio assignments by various criteria
                </SheetDescription>
              </SheetHeader>
              
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="filter-status">Status</Label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Filter by status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="allocated">Allocated</SelectItem>
                      <SelectItem value="evaluated">Evaluated</SelectItem>
                      <SelectItem value="archived">Archived</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="filter-date">Date Range</Label>
                  <Select value={dateFilter} onValueChange={setDateFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Filter by date range" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Time</SelectItem>
                      <SelectItem value="today">Today</SelectItem>
                      <SelectItem value="thisWeek">This Week</SelectItem>
                      <SelectItem value="thisMonth">This Month</SelectItem>
                      <SelectItem value="lastMonth">Last Month</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="filter-analyst">Quality Analyst</Label>
                  <Select value={analyticFilter} onValueChange={setAnalyticFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Filter by quality analyst" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Analysts</SelectItem>
                      {/* Dynamically populate with analysts - would need to fetch from API */}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <SheetFooter>
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setStatusFilter('all');
                    setDateFilter('all');
                    setAnalyticFilter('all');
                  }}
                >
                  Reset Filters
                </Button>
                <Button onClick={() => setFilterSheetOpen(false)}>Apply Filters</Button>
              </SheetFooter>
            </SheetContent>
          </Sheet>
        </div>
      </div>
      
      {/* Tabs for date range selection */}
      <Tabs defaultValue="today" value={activeTab} onValueChange={setActiveTab} className="mb-6">
        <TabsList>
          <TabsTrigger value="today">Today</TabsTrigger>
          <TabsTrigger value="thisWeek">This Week</TabsTrigger>
          <TabsTrigger value="thisMonth">This Month</TabsTrigger>
          <TabsTrigger value="all">All Time</TabsTrigger>
        </TabsList>
      </Tabs>
      
      {/* Overall Statistics Summary */}
      {!loadingAllocations && filteredAllocations.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-6">
              <ClipboardList className="h-8 w-8 text-primary mb-2" />
              <p className="text-2xl font-bold">{totalAssignments}</p>
              <p className="text-sm text-muted-foreground">Total Assignments</p>
            </CardContent>
          </Card>
          
          <Card className={getStatusBgColor('pending')}>
            <CardContent className="flex flex-col items-center justify-center py-6">
              <Badge className={getStatusColor('pending')}>Pending</Badge>
              <p className="text-2xl font-bold mt-2">{statusCounts['pending'] || 0}</p>
              <p className="text-sm text-muted-foreground">Pending Assignments</p>
            </CardContent>
          </Card>
          
          <Card className={getStatusBgColor('allocated')}>
            <CardContent className="flex flex-col items-center justify-center py-6">
              <Badge className={getStatusColor('allocated')}>Allocated</Badge>
              <p className="text-2xl font-bold mt-2">{statusCounts['allocated'] || 0}</p>
              <p className="text-sm text-muted-foreground">Allocated Assignments</p>
            </CardContent>
          </Card>
          
          <Card className={getStatusBgColor('evaluated')}>
            <CardContent className="flex flex-col items-center justify-center py-6">
              <Badge className={getStatusColor('evaluated')}>Evaluated</Badge>
              <p className="text-2xl font-bold mt-2">{statusCounts['evaluated'] || 0}</p>
              <p className="text-sm text-muted-foreground">Evaluated Assignments</p>
            </CardContent>
          </Card>
        </div>
      )}
      
      {/* Main Content */}
      {loadingAllocations ? (
        <div className="flex justify-center items-center py-12">
          <Spinner className="h-8 w-8" />
        </div>
      ) : filteredAllocations.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileAudio className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium">No audio assignments found</p>
            <p className="text-sm text-muted-foreground">
              {activeTab === 'today' ? 'No assignments for today.' : 
               activeTab === 'thisWeek' ? 'No assignments for this week.' :
               activeTab === 'thisMonth' ? 'No assignments for this month.' : 
               'No assignments available.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {/* Date-wise summary cards */}
          {sortedDates.map(date => (
            <Card key={date} className="mb-4">
              <CardHeader className="pb-2 cursor-pointer" onClick={() => toggleDateExpansion(date)}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <Calendar className="h-5 w-5 mr-2 text-primary" />
                    <div>
                      <CardTitle className="text-lg">{formatDate(date)}</CardTitle>
                      <div className="flex items-center">
                        <CardDescription className="mt-1">
                          {groupedAllocations[date].length} audio assignment{groupedAllocations[date].length > 1 ? 's' : ''}
                        </CardDescription>
                        {generateStatusCountsForDate(groupedAllocations[date])}
                      </div>
                    </div>
                  </div>
                  {expandedDate === date ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                </div>
              </CardHeader>
              
              {/* Expanded view with details */}
              {expandedDate === date && (
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Audio File</TableHead>
                        <TableHead>Assigned To</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Allocation Date</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {groupedAllocations[date].map((allocation: AudioFileAllocation) => (
                        <TableRow key={allocation.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">ID: {allocation.audioFileId}</p>
                              {allocation.audioFileName && (
                                <p className="text-xs text-muted-foreground truncate max-w-[200px]">{allocation.audioFileName}</p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <p>{allocation.qualityAnalystName}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={getStatusColor(allocation.status)}>
                              {allocation.status.charAt(0).toUpperCase() + allocation.status.slice(1)}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {format(new Date(allocation.allocationDate), 'MMM dd, yyyy HH:mm')}
                          </TableCell>
                          <TableCell>
                            <div className="flex space-x-2">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8"
                                onClick={() => {
                                  setSelectedAllocation(allocation);
                                  setViewDetailsOpen(true);
                                }}
                              >
                                <Info className="h-4 w-4 mr-1" />
                                View Details
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}
      
      {/* Details Dialog */}
      <Dialog open={viewDetailsOpen} onOpenChange={setViewDetailsOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Audio Assignment Details</DialogTitle>
            <DialogDescription>
              Complete information for the selected audio assignment
            </DialogDescription>
          </DialogHeader>
          
          {selectedAllocation && (
            <div className="grid gap-4 py-2">
              <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                <div>
                  <h3 className="font-semibold">Audio File Information</h3>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <div className="text-sm text-muted-foreground">Filename:</div>
                    <div className="text-sm font-medium">{selectedAllocation.audioFileName}</div>
                    
                    <div className="text-sm text-muted-foreground">ID:</div>
                    <div className="text-sm font-medium">{selectedAllocation.audioFileId}</div>
                    
                    <div className="text-sm text-muted-foreground">Status:</div>
                    <div className="text-sm font-medium">
                      <Badge className={getStatusColor(selectedAllocation.status)}>
                        {selectedAllocation.status.charAt(0).toUpperCase() + selectedAllocation.status.slice(1)}
                      </Badge>
                    </div>
                  </div>
                </div>
                
                <div>
                  <h3 className="font-semibold">Assignment Information</h3>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <div className="text-sm text-muted-foreground">Assigned To:</div>
                    <div className="text-sm font-medium">{selectedAllocation.qualityAnalystName}</div>
                    
                    <div className="text-sm text-muted-foreground">Assigned By:</div>
                    <div className="text-sm font-medium">{selectedAllocation.allocatedByName}</div>
                    
                    <div className="text-sm text-muted-foreground">Allocation Date:</div>
                    <div className="text-sm font-medium">
                      {format(new Date(selectedAllocation.allocationDate), 'MMM dd, yyyy HH:mm')}
                    </div>
                    
                    {selectedAllocation.dueDate && (
                      <>
                        <div className="text-sm text-muted-foreground">Due Date:</div>
                        <div className="text-sm font-medium">
                          {format(new Date(selectedAllocation.dueDate), 'MMM dd, yyyy')}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewDetailsOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AudioAssignmentDashboard;