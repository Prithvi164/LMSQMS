import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';

interface TourStep {
  id?: number;
  title: string;
  content: string;
  targetElement: string | null;
  position: 'top' | 'right' | 'bottom' | 'left';
  stepOrder: number;
  skipIf: string | null;
}

interface Tour {
  id: number;
  name: string;
  description: string | null;
  targetRole: string;
  isActive: boolean;
  startUrl: string;
  triggerType: 'automatic' | 'manual';
  steps: TourStep[];
  organizationId: number;
  createdAt: string;
  updatedAt: string;
}

interface FormState {
  name: string;
  description: string;
  targetRole: string;
  startUrl: string;
  isActive: boolean;
  triggerType: 'automatic' | 'manual';
  steps: TourStep[];
}

export default function TourManagementPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  
  // State for the new/edit tour form
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [currentTour, setCurrentTour] = useState<Tour | null>(null);
  const [formState, setFormState] = useState<FormState>({
    name: '',
    description: '',
    targetRole: 'trainee',
    startUrl: '',
    isActive: true,
    triggerType: 'automatic',
    steps: [{ title: '', content: '', targetElement: '', position: 'bottom', stepOrder: 0, skipIf: '' }]
  });
  
  // Get all tours
  const { data: tours = [], isLoading } = useQuery<Tour[]>({
    queryKey: ['tours'],
    queryFn: async () => {
      const response = await apiRequest<Tour[]>('/api/tours');
      return response;
    },
  });

  // Create tour mutation
  const createTourMutation = useMutation({
    mutationFn: async (data: FormState) => {
      return apiRequest('/api/tours', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tours'] });
      setIsEditDialogOpen(false);
      toast({
        title: 'Success',
        description: 'Tour created successfully',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: 'Failed to create tour: ' + (error.message || 'Unknown error'),
        variant: 'destructive',
      });
    },
  });

  // Update tour mutation
  const updateTourMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: FormState }) => {
      return apiRequest(`/api/tours/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tours'] });
      setIsEditDialogOpen(false);
      toast({
        title: 'Success',
        description: 'Tour updated successfully',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: 'Failed to update tour: ' + (error.message || 'Unknown error'),
        variant: 'destructive',
      });
    },
  });

  // Delete tour mutation
  const deleteTourMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest(`/api/tours/${id}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tours'] });
      toast({
        title: 'Success',
        description: 'Tour deleted successfully',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: 'Failed to delete tour: ' + (error.message || 'Unknown error'),
        variant: 'destructive',
      });
    },
  });

  // Open the edit dialog for a new tour
  const handleNewTour = () => {
    setCurrentTour(null);
    setFormState({
      name: '',
      description: '',
      targetRole: 'trainee',
      startUrl: '',
      isActive: true,
      triggerType: 'automatic',
      steps: [{ title: '', content: '', targetElement: '', position: 'bottom', stepOrder: 0, skipIf: '' }]
    });
    setIsEditDialogOpen(true);
  };

  // Open the edit dialog for an existing tour
  const handleEditTour = (tour: Tour) => {
    setCurrentTour(tour);
    setFormState({
      name: tour.name,
      description: tour.description || '',
      targetRole: tour.targetRole,
      startUrl: tour.startUrl,
      isActive: tour.isActive,
      triggerType: tour.triggerType,
      steps: tour.steps.length > 0 ? [...tour.steps] : [{ title: '', content: '', targetElement: '', position: 'bottom', stepOrder: 0, skipIf: '' }]
    });
    setIsEditDialogOpen(true);
  };

  // Handle form input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormState(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  // Handle form select changes
  const handleSelectChange = (name: string, value: string) => {
    setFormState(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  // Handle form switch changes
  const handleSwitchChange = (name: string, checked: boolean) => {
    setFormState(prev => ({
      ...prev,
      [name]: checked,
    }));
  };

  // Handle step input changes
  const handleStepChange = (index: number, field: string, value: string) => {
    const updatedSteps = [...formState.steps];
    updatedSteps[index] = {
      ...updatedSteps[index],
      [field]: value,
    };
    setFormState(prev => ({
      ...prev,
      steps: updatedSteps,
    }));
  };

  // Add a new step
  const handleAddStep = () => {
    setFormState(prev => ({
      ...prev,
      steps: [...prev.steps, { 
        title: '', 
        content: '', 
        targetElement: '', 
        position: 'bottom', 
        stepOrder: prev.steps.length,
        skipIf: '' 
      }],
    }));
  };

  // Remove a step
  const handleRemoveStep = (index: number) => {
    if (formState.steps.length <= 1) return;
    
    const updatedSteps = [...formState.steps];
    updatedSteps.splice(index, 1);
    
    // Reorder steps
    const reorderedSteps = updatedSteps.map((step, idx) => ({
      ...step,
      stepOrder: idx,
    }));
    
    setFormState(prev => ({
      ...prev,
      steps: reorderedSteps,
    }));
  };

  // Submit the form
  const handleSubmit = () => {
    // Basic validation
    if (!formState.name || !formState.startUrl) {
      toast({
        title: 'Validation Error',
        description: 'Name and Start URL are required',
        variant: 'destructive',
      });
      return;
    }

    // Validate steps
    const invalidSteps = formState.steps.filter(step => !step.title || !step.content);
    if (invalidSteps.length > 0) {
      toast({
        title: 'Validation Error',
        description: 'All steps must have a title and content',
        variant: 'destructive',
      });
      return;
    }

    // Submit form
    if (currentTour) {
      // Update existing tour
      updateTourMutation.mutate({
        id: currentTour.id,
        data: formState,
      });
    } else {
      // Create new tour
      createTourMutation.mutate(formState);
    }
  };

  // Check if user has access to this page
  useEffect(() => {
    if (user && !['admin', 'manager', 'team_lead'].includes(user.role)) {
      toast({
        title: 'Access Denied',
        description: 'You do not have permission to access this page',
        variant: 'destructive',
      });
    }
  }, [user, toast]);

  if (!user || !['admin', 'manager', 'team_lead'].includes(user.role)) {
    return (
      <div className="container mx-auto p-4">
        <Card>
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>You do not have permission to view this page.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Guided Tour Management</h1>
        <Button onClick={handleNewTour}>Create New Tour</Button>
      </div>

      {isLoading ? (
        <div className="text-center py-8">Loading tours...</div>
      ) : (
        <div className="grid gap-4">
          {tours.length === 0 ? (
            <Card>
              <CardContent className="py-10">
                <p className="text-center text-muted-foreground">No tours found. Create your first tour to get started.</p>
              </CardContent>
            </Card>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Target Role</TableHead>
                  <TableHead>Start URL</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Steps</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tours.map((tour) => (
                  <TableRow key={tour.id}>
                    <TableCell>{tour.name}</TableCell>
                    <TableCell className="capitalize">{tour.targetRole}</TableCell>
                    <TableCell>{tour.startUrl}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded-full text-xs ${tour.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                        {tour.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </TableCell>
                    <TableCell>{tour.steps.length}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => handleEditTour(tour)}>
                          Edit
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="destructive" size="sm">
                              Delete
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Tour</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete this tour? This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => deleteTourMutation.mutate(tour.id)}>
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      )}

      {/* Edit/Create Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{currentTour ? 'Edit Tour' : 'Create New Tour'}</DialogTitle>
            <DialogDescription>
              {currentTour 
                ? 'Edit the details of this guided tour'
                : 'Create a new guided tour for your users'}
            </DialogDescription>
          </DialogHeader>
          
          <Tabs defaultValue="general">
            <TabsList className="mb-4">
              <TabsTrigger value="general">General</TabsTrigger>
              <TabsTrigger value="steps">Tour Steps</TabsTrigger>
            </TabsList>
            
            <TabsContent value="general">
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">Tour Name</Label>
                  <Input 
                    id="name" 
                    name="name" 
                    value={formState.name} 
                    onChange={handleInputChange} 
                    placeholder="e.g., First-time User Tour"
                  />
                </div>
                
                <div className="grid gap-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea 
                    id="description" 
                    name="description" 
                    value={formState.description} 
                    onChange={handleInputChange} 
                    placeholder="Briefly describe the purpose of this tour"
                  />
                </div>
                
                <div className="grid gap-2">
                  <Label htmlFor="targetRole">Target Role</Label>
                  <Select 
                    value={formState.targetRole} 
                    onValueChange={(value) => handleSelectChange('targetRole', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="owner">Owner</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="manager">Manager</SelectItem>
                      <SelectItem value="team_lead">Team Lead</SelectItem>
                      <SelectItem value="quality_analyst">Quality Analyst</SelectItem>
                      <SelectItem value="trainer">Trainer</SelectItem>
                      <SelectItem value="advisor">Advisor</SelectItem>
                      <SelectItem value="trainee">Trainee</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="grid gap-2">
                  <Label htmlFor="startUrl">Start URL</Label>
                  <Input 
                    id="startUrl" 
                    name="startUrl" 
                    value={formState.startUrl} 
                    onChange={handleInputChange} 
                    placeholder="e.g., /dashboard"
                  />
                  <p className="text-sm text-muted-foreground">
                    The page path where this tour will start (e.g., /dashboard, /my-quizzes)
                  </p>
                </div>
                
                <div className="grid gap-2">
                  <Label htmlFor="triggerType">Trigger Type</Label>
                  <Select 
                    value={formState.triggerType} 
                    onValueChange={(value) => handleSelectChange('triggerType', value as 'automatic' | 'manual')}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select trigger type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="automatic">Automatic (On page load)</SelectItem>
                      <SelectItem value="manual">Manual (User initiated)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="flex items-center gap-2">
                  <Switch 
                    id="isActive"
                    checked={formState.isActive}
                    onCheckedChange={(checked) => handleSwitchChange('isActive', checked)}
                  />
                  <Label htmlFor="isActive">Active</Label>
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="steps">
              <div className="grid gap-6 py-4">
                {formState.steps.map((step, index) => (
                  <Card key={index} className="relative">
                    <CardHeader>
                      <CardTitle className="text-base">Step {index + 1}</CardTitle>
                      {formState.steps.length > 1 && (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="absolute top-2 right-2"
                          onClick={() => handleRemoveStep(index)}
                        >
                          Remove
                        </Button>
                      )}
                    </CardHeader>
                    <CardContent>
                      <div className="grid gap-4">
                        <div className="grid gap-2">
                          <Label htmlFor={`step-${index}-title`}>Title</Label>
                          <Input 
                            id={`step-${index}-title`}
                            value={step.title} 
                            onChange={(e) => handleStepChange(index, 'title', e.target.value)} 
                            placeholder="Step title"
                          />
                        </div>
                        
                        <div className="grid gap-2">
                          <Label htmlFor={`step-${index}-content`}>Content</Label>
                          <Textarea 
                            id={`step-${index}-content`}
                            value={step.content} 
                            onChange={(e) => handleStepChange(index, 'content', e.target.value)} 
                            placeholder="Step content"
                          />
                        </div>
                        
                        <div className="grid gap-2">
                          <Label htmlFor={`step-${index}-target`}>Target Element (CSS Selector)</Label>
                          <Input 
                            id={`step-${index}-target`}
                            value={step.targetElement || ''} 
                            onChange={(e) => handleStepChange(index, 'targetElement', e.target.value)} 
                            placeholder="e.g., #dashboard-widget, .navigation-item"
                          />
                          <p className="text-sm text-muted-foreground">
                            CSS selector for the element to highlight (optional)
                          </p>
                        </div>
                        
                        <div className="grid gap-2">
                          <Label htmlFor={`step-${index}-position`}>Tooltip Position</Label>
                          <Select 
                            value={step.position} 
                            onValueChange={(value) => handleStepChange(index, 'position', value as 'top' | 'right' | 'bottom' | 'left')}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select position" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="top">Top</SelectItem>
                              <SelectItem value="right">Right</SelectItem>
                              <SelectItem value="bottom">Bottom</SelectItem>
                              <SelectItem value="left">Left</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        
                        <div className="grid gap-2">
                          <Label htmlFor={`step-${index}-skip`}>Skip Condition (Advanced)</Label>
                          <Input 
                            id={`step-${index}-skip`}
                            value={step.skipIf || ''} 
                            onChange={(e) => handleStepChange(index, 'skipIf', e.target.value)} 
                            placeholder="e.g., !document.querySelector('#element')"
                          />
                          <p className="text-sm text-muted-foreground">
                            JavaScript condition to determine if this step should be skipped (optional)
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                
                <Button variant="outline" onClick={handleAddStep} className="mt-2">
                  Add Another Step
                </Button>
              </div>
            </TabsContent>
          </Tabs>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSubmit}
              disabled={createTourMutation.isPending || updateTourMutation.isPending}
            >
              {createTourMutation.isPending || updateTourMutation.isPending
                ? 'Saving...'
                : currentTour ? 'Update Tour' : 'Create Tour'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}