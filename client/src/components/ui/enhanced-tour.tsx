import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface TourStep {
  id: number;
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
  steps: TourStep[];
}

interface TourProgress {
  id: number;
  tourId: number;
  completed: boolean;
  currentStep: number;
  lastAccessed: string;
  completedAt: string | null;
}

interface PositionData {
  top?: number;
  left?: number;
  width?: number;
  height?: number;
}

export function EnhancedTour() {
  const { user } = useAuth();
  const [location] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Get available tours for the current user's role
  const { data: tours = [] } = useQuery<Tour[]>({
    queryKey: ['tours', user?.role],
    queryFn: async () => {
      if (!user) return [];
      const response = await apiRequest<Tour[]>(`/api/tours/available?role=${user.role}`);
      return response;
    },
    enabled: !!user,
  });

  // Get user's progress for all tours
  const { data: tourProgress = [] } = useQuery<TourProgress[]>({
    queryKey: ['tour-progress', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const response = await apiRequest<TourProgress[]>(`/api/tours/progress?userId=${user.id}`);
      return response;
    },
    enabled: !!user,
  });

  // Find a relevant tour for the current page and user role
  const relevantTour = tours.find((tour) => 
    tour.isActive && 
    tour.startUrl === location &&
    !tourProgress.find((progress) => progress.tourId === tour.id && progress.completed)
  );

  // State for currently active tour
  const [activeTour, setActiveTour] = useState<Tour | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  // Update tour progress mutation
  const updateProgressMutation = useMutation({
    mutationFn: async (data: { tourId: number; currentStep: number; completed: boolean }) => {
      if (!user) return null;
      return apiRequest('/api/tours/progress', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tour-progress', user?.id] });
    },
  });

  // Start a tour manually
  const startTour = (tour: Tour) => {
    setActiveTour(tour);
    setCurrentStepIndex(0);
    updateProgressMutation.mutate({
      tourId: tour.id,
      currentStep: 0,
      completed: false,
    });
  };

  // Navigate to the next step
  const nextStep = () => {
    if (!activeTour) return;
    
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < activeTour.steps.length) {
      setCurrentStepIndex(nextIndex);
      updateProgressMutation.mutate({
        tourId: activeTour.id,
        currentStep: nextIndex,
        completed: false,
      });
    } else {
      // Tour completed
      updateProgressMutation.mutate({
        tourId: activeTour.id,
        currentStep: activeTour.steps.length,
        completed: true,
      });
      setActiveTour(null);
      toast({
        title: "Tour Completed",
        description: "You've completed the guided tour!",
      });
    }
  };

  // Skip the tour
  const skipTour = () => {
    if (!activeTour) return;
    updateProgressMutation.mutate({
      tourId: activeTour.id,
      currentStep: activeTour.steps.length,
      completed: true,
    });
    setActiveTour(null);
  };

  // Check if there's a relevant tour when the page loads
  useEffect(() => {
    if (relevantTour) {
      const progress = tourProgress.find((p) => p.tourId === relevantTour.id);
      if (progress && !progress.completed) {
        setActiveTour(relevantTour);
        setCurrentStepIndex(progress.currentStep);
      } else if (!progress) {
        setActiveTour(relevantTour);
        setCurrentStepIndex(0);
      }
    }
  }, [relevantTour, tourProgress, location]);

  if (!activeTour || !activeTour.steps[currentStepIndex]) {
    return null;
  }

  const currentStep = activeTour.steps[currentStepIndex];
  
  // Get target element position for the tooltip
  const getTargetPosition = (): PositionData => {
    if (!currentStep.targetElement) return {};
    
    const element = document.querySelector(currentStep.targetElement);
    if (!element) return {};
    
    const rect = element.getBoundingClientRect();
    return {
      top: rect.top + window.scrollY,
      left: rect.left + window.scrollX,
      width: rect.width,
      height: rect.height,
    };
  };

  const targetPosition: PositionData = getTargetPosition();

  // Calculate tooltip position based on target and preferred position
  const calculateTooltipStyle = (): React.CSSProperties => {
    if (!currentStep.targetElement) {
      return {
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 1000,
      } as React.CSSProperties;
    }

    // Position calculations based on target element
    const position = currentStep.position || 'bottom';
    let style: React.CSSProperties = {
      position: 'absolute',
      zIndex: 1000,
    };

    if (!targetPosition.top || !targetPosition.left || !targetPosition.width || !targetPosition.height) {
      return style;
    }

    switch (position) {
      case 'top':
        style.top = `${targetPosition.top - 10}px`;
        style.left = `${targetPosition.left + targetPosition.width / 2}px`;
        style.transform = 'translate(-50%, -100%)';
        break;
      case 'right':
        style.top = `${targetPosition.top + targetPosition.height / 2}px`;
        style.left = `${targetPosition.left + targetPosition.width + 10}px`;
        style.transform = 'translateY(-50%)';
        break;
      case 'bottom':
        style.top = `${targetPosition.top + targetPosition.height + 10}px`;
        style.left = `${targetPosition.left + targetPosition.width / 2}px`;
        style.transform = 'translateX(-50%)';
        break;
      case 'left':
        style.top = `${targetPosition.top + targetPosition.height / 2}px`;
        style.left = `${targetPosition.left - 10}px`;
        style.transform = 'translate(-100%, -50%)';
        break;
    }

    return style;
  };

  // Highlight target element
  useEffect(() => {
    if (currentStep.targetElement) {
      const targetElement = document.querySelector(currentStep.targetElement);
      if (targetElement) {
        // Add highlight class
        targetElement.classList.add('tour-highlight');
        
        // Ensure element is in view
        targetElement.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
        
        return () => {
          targetElement.classList.remove('tour-highlight');
        };
      }
    }
  }, [currentStep]);

  return (
    <>
      {/* Overlay */}
      <div 
        className="fixed inset-0 bg-black/50 z-50"
        onClick={skipTour}
      />
      
      {/* Tooltip */}
      <div
        className="bg-card text-card-foreground p-4 rounded-lg shadow-lg w-80"
        style={calculateTooltipStyle()}
      >
        <div className="flex flex-col gap-3">
          <h3 className="text-lg font-bold">{currentStep.title}</h3>
          <p>{currentStep.content}</p>
          
          <div className="flex items-center justify-between mt-4">
            <div className="text-sm text-muted-foreground">
              Step {currentStepIndex + 1} of {activeTour.steps.length}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={skipTour}
              >
                Skip
              </Button>
              <Button
                size="sm"
                onClick={nextStep}
              >
                {currentStepIndex < activeTour.steps.length - 1 ? 'Next' : 'Finish'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}