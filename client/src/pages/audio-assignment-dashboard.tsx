import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Download, FileAudio, Filter, RefreshCw, Calendar } from 'lucide-react';
import { format, isSameDay, isThisWeek, isThisMonth, parseISO } from 'date-fns';

// Define types for the components
type AudioFileAllocation = {
  id: number;
  name: string;
  description: string;
  allocationDate: string;
  dueDate: string | null;
  status: 'pending' | 'allocated' | 'evaluated' | 'archived';
  allocatedBy: number;
  allocatedByName: string;
  qualityAnalystId: number;
  qualityAnalystName: string;
  audioFileId: number;
  audioFileName: string;
  evaluatedCount: number;
  totalFiles: number;
  allocatedCount: number;
  createdAt: string;
  organizationId: number;
};

// Helper functions
const formatDuration = (seconds: number) => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'pending': return 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200';
    case 'allocated': return 'bg-blue-100 text-blue-800 hover:bg-blue-200';
    case 'evaluated': return 'bg-green-100 text-green-800 hover:bg-green-200';
    case 'archived': return 'bg-gray-100 text-gray-800 hover:bg-gray-200';
    default: return 'bg-gray-100 text-gray-800 hover:bg-gray-200';
  }
};

const getAllocationStatusColor = (allocatedCount: number, totalCount: number) => {
  if (allocatedCount === 0) return 'bg-red-100 text-red-800';
  if (allocatedCount < totalCount) return 'bg-yellow-100 text-yellow-800';
  return 'bg-green-100 text-green-800';
};

const AudioAssignmentDashboard = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('today');
  const [dateFilter, setDateFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [analyticFilter, setAnalyticFilter] = useState('all');
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);

  // Query for fetching allocations
  const { data: allocations = [], isLoading: loadingAllocations, refetch: refetchAllocations } = useQuery<AudioFileAllocation[]>({
    queryKey: ['/api/organizations/' + user?.organizationId + '/audio-file-allocations', dateFilter, statusFilter, analyticFilter],
    enabled: !!user?.organizationId,
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
      
      // Add more filters as needed
      
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
        <div className="space-y-6">
          {sortedDates.map(date => (
            <Card key={date} className="mb-6">
              <CardHeader className="pb-2">
                <div className="flex items-center">
                  <Calendar className="h-5 w-5 mr-2 text-primary" />
                  <CardTitle>{new Date(date).toLocaleDateString(undefined, { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })}</CardTitle>
                </div>
                <CardDescription>
                  {groupedAllocations[date].length} audio assignment{groupedAllocations[date].length > 1 ? 's' : ''}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Audio File</TableHead>
                      <TableHead>Assigned To</TableHead>
                      <TableHead>Assigned By</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {groupedAllocations[date].map((allocation: AudioFileAllocation) => (
                      <TableRow key={allocation.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{allocation.audioFileName}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p>{allocation.qualityAnalystName}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p>{allocation.allocatedByName}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          {allocation.dueDate ? format(new Date(allocation.dueDate), 'MMM dd, yyyy') : 'No due date'}
                        </TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(allocation.status)}>
                            {allocation.status.charAt(0).toUpperCase() + allocation.status.slice(1)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex space-x-2">
                            <Button 
                              size="sm"
                              variant="outline"
                              className="h-8"
                              asChild
                            >
                              <a 
                                href={`/api/audio-files/${allocation.audioFileId}/download`} 
                                target="_blank" 
                                rel="noopener noreferrer"
                              >
                                <Download className="h-4 w-4 mr-1" />
                                Download
                              </a>
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8"
                              onClick={() => window.location.href = `/audio-file-details/${allocation.audioFileId}`}
                            >
                              View Details
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default AudioAssignmentDashboard;