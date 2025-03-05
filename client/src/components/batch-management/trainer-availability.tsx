
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Calendar as CalendarIcon } from "lucide-react";
import { format, isWithinInterval, isSameDay } from "date-fns";

// Interface for trainer availability
interface TrainerAvailability {
  trainerId: number;
  dates: Date[];
  batchAssignments: {
    batchId: number;
    batchName: string;
    startDate: Date;
    endDate: Date;
  }[];
}

// Interface for calendar event display
interface CalendarEvent {
  date: Date;
  batchName: string;
  status: string;
}

export function TrainerAvailability() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedTrainer, setSelectedTrainer] = useState<number | null>(null);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<Date>(new Date());

  // Fetch trainers (users with 'trainer' role)
  const { data: trainers = [], isLoading: isLoadingTrainers } = useQuery({
    queryKey: [`/api/organizations/${user?.organizationId}/users/trainers`],
    queryFn: async () => {
      const response = await fetch(`/api/organizations/${user?.organizationId}/users`);
      if (!response.ok) {
        throw new Error('Failed to fetch trainers');
      }
      const users = await response.json();
      return users.filter(user => user.role === 'trainer');
    },
    enabled: !!user?.organizationId,
  });

  // Fetch batches to extract trainer assignments
  const { data: batches = [], isLoading: isLoadingBatches } = useQuery({
    queryKey: [`/api/organizations/${user?.organizationId}/batches`],
    enabled: !!user?.organizationId,
  });

  // When trainer or batches change, update calendar events
  useEffect(() => {
    if (!selectedTrainer || !batches.length) return;
    
    // Filter batches for the selected trainer
    const trainerBatches = batches.filter(batch => batch.trainerId === selectedTrainer);
    
    // Create calendar events for each batch
    const events: CalendarEvent[] = [];
    trainerBatches.forEach(batch => {
      // Calculate dates between start and end
      const startDate = new Date(batch.startDate);
      const endDate = new Date(batch.endDate);
      
      // Add an event for each day of the batch
      let currentDate = new Date(startDate);
      while (currentDate <= endDate) {
        events.push({
          date: new Date(currentDate),
          batchName: batch.name,
          status: batch.status
        });
        currentDate.setDate(currentDate.getDate() + 1);
      }
    });
    
    setCalendarEvents(events);
  }, [selectedTrainer, batches]);

  // Function to determine if a day has an event
  const getDayEvents = (day: Date) => {
    return calendarEvents.filter(event => 
      isSameDay(new Date(event.date), day)
    );
  };

  // Render calendar day with batch info if assigned
  const renderCalendarDay = (day: Date) => {
    const events = getDayEvents(day);
    const hasEvents = events.length > 0;
    
    return (
      <div className={`relative ${hasEvents ? 'font-bold' : ''}`}>
        {day.getDate()}
        {hasEvents && (
          <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-blue-500" title={events.map(e => e.batchName).join(', ')} />
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Trainer Availability</h2>
      </div>
      
      <div className="flex flex-col md:flex-row gap-4">
        <Card className="flex-1">
          <CardHeader>
            <CardTitle>Select Trainer</CardTitle>
          </CardHeader>
          <CardContent>
            <Select
              onValueChange={(value) => setSelectedTrainer(parseInt(value))}
              value={selectedTrainer?.toString()}
              disabled={isLoadingTrainers}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a trainer" />
              </SelectTrigger>
              <SelectContent>
                {trainers.map((trainer) => (
                  <SelectItem key={trainer.id} value={trainer.id.toString()}>
                    {trainer.fullName} ({trainer.locationName || 'No location'})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            {isLoadingTrainers && (
              <div className="flex justify-center my-4">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            )}
          </CardContent>
        </Card>
        
        <Card className="flex-1">
          <CardHeader>
            <CardTitle>Availability Calendar</CardTitle>
          </CardHeader>
          <CardContent>
            {selectedTrainer ? (
              <Calendar
                mode="single"
                selected={undefined}
                onSelect={() => {}}
                month={selectedMonth}
                onMonthChange={setSelectedMonth}
                disabled={false}
                className="rounded-md border shadow"
                renderDay={renderCalendarDay}
              />
            ) : (
              <div className="flex justify-center items-center h-40 text-muted-foreground">
                Select a trainer to view their availability
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      
      {selectedTrainer && calendarEvents.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Assigned Batches</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {Array.from(new Set(calendarEvents.map(event => event.batchName))).map((batchName, index) => {
                const batch = batches.find(b => b.name === batchName);
                return (
                  <li key={index} className="flex items-center justify-between border-b pb-2">
                    <span className="font-medium">{batchName}</span>
                    <span className="text-sm text-muted-foreground">
                      {batch ? `${format(new Date(batch.startDate), 'MMM dd, yyyy')} - ${format(new Date(batch.endDate), 'MMM dd, yyyy')}` : ''}
                    </span>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}
      
      <div className="mt-6 flex items-center gap-6 text-sm border-t pt-4">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-blue-500" />
          <span className="font-medium">Assigned to Batch</span>
        </div>
      </div>
    </div>
  );
}
