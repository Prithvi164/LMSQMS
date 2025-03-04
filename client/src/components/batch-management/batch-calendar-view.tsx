import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { OrganizationBatch } from "@shared/schema";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useState } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";

export function BatchCalendarView() {
  const { user } = useAuth();
  const [selectedBatch, setSelectedBatch] = useState<OrganizationBatch | null>(null);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);

  const {
    data: batches = [],
    isLoading,
  } = useQuery<OrganizationBatch[]>({
    queryKey: [`/api/organizations/${user?.organizationId}/batches`],
    enabled: !!user?.organizationId
  });

  const getEventColor = (status: string) => {
    switch (status) {
      case 'planned':
        return '#3b82f6'; // Blue
      case 'induction':
        return '#8b5cf6'; // Purple
      case 'training':
        return '#f59e0b'; // Orange
      case 'certification':
        return '#ec4899'; // Pink
      case 'ojt':
        return '#06b6d4'; // Cyan
      case 'ojt_certification':
        return '#14b8a6'; // Teal
      case 'completed':
        return '#6b7280'; // Gray
      default:
        return '#6b7280'; // Default gray
    }
  };

  const events = batches.map(batch => ({
    id: batch.id.toString(),
    title: batch.name,
    start: batch.startDate,
    end: batch.endDate,
    backgroundColor: getEventColor(batch.status),
    extendedProps: {
      status: batch.status,
      process: batch.process?.name,
      location: batch.location?.name,
      trainer: batch.trainer?.fullName,
      category: batch.batchCategory,
      batch: batch // Store the full batch object for reference
    }
  }));

  const handleEventClick = (eventInfo: any) => {
    const batch = eventInfo.event.extendedProps.batch;
    setSelectedBatch(batch);
    setIsDetailDialogOpen(true);
  };

  const renderEventContent = (eventInfo: any) => {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="p-1 cursor-pointer">
              <div className="font-semibold truncate">{eventInfo.event.title}</div>
              <div className="text-xs">
                <Badge variant="secondary" className="mr-1">
                  {eventInfo.event.extendedProps.status.charAt(0).toUpperCase() + 
                   eventInfo.event.extendedProps.status.slice(1).replace('_', ' ')}
                </Badge>
                <span className="truncate">{eventInfo.event.extendedProps.process}</span>
              </div>
            </div>
          </TooltipTrigger>
          <TooltipContent side="top" className="p-2">
            <div className="space-y-1">
              <p className="font-semibold">{eventInfo.event.title}</p>
              <p>Process: {eventInfo.event.extendedProps.process}</p>
              <p>Location: {eventInfo.event.extendedProps.location}</p>
              <p>Trainer: {eventInfo.event.extendedProps.trainer}</p>
              <p>Category: {eventInfo.event.extendedProps.category}</p>
              <p>Status: {eventInfo.event.extendedProps.status}</p>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  if (isLoading) {
    return <div>Loading calendar...</div>;
  }

  const statusColors = [
    { status: 'planned', color: '#3b82f6' },
    { status: 'induction', color: '#8b5cf6' },
    { status: 'training', color: '#f59e0b' },
    { status: 'certification', color: '#ec4899' },
    { status: 'ojt', color: '#06b6d4' },
    { status: 'ojt_certification', color: '#14b8a6' },
    { status: 'completed', color: '#6b7280' }
  ];

  return (
    <Card className="p-4">
      <div className="mb-4">
        <h3 className="text-lg font-semibold">Batch Calendar</h3>
        <div className="flex flex-wrap gap-2 mt-2">
          {statusColors.map(({ status, color }) => (
            <TooltipProvider key={status}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-1 cursor-help">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: color }}
                    />
                    <span className="text-sm">
                      {status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')}
                    </span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  Click on any {status} batch to view details
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ))}
        </div>
      </div>

      <FullCalendar
        plugins={[dayGridPlugin, interactionPlugin]}
        initialView="dayGridMonth"
        events={events}
        eventContent={renderEventContent}
        eventClick={handleEventClick}
        headerToolbar={{
          left: 'prev,next today',
          center: 'title',
          right: 'dayGridMonth,dayGridWeek'
        }}
        height="auto"
        aspectRatio={1.8}
        eventDisplay="block"
        eventTimeFormat={{
          hour: 'numeric',
          minute: '2-digit',
          meridiem: 'short'
        }}
        slotMinTime="07:00:00"
        slotMaxTime="22:00:00"
        dayMaxEvents={4}
        eventOverlap={false}
        eventBorderColor="transparent"
        eventClassNames="rounded-md shadow-sm hover:shadow-md transition-shadow"
      />

      <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedBatch?.name}</DialogTitle>
          </DialogHeader>
          {selectedBatch && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="font-semibold mb-2">Basic Information</h4>
                  <div className="space-y-2">
                    <p><span className="font-medium">Category:</span> {selectedBatch.batchCategory}</p>
                    <p><span className="font-medium">Status:</span> {selectedBatch.status}</p>
                    <p><span className="font-medium">Capacity:</span> {selectedBatch.capacityLimit}</p>
                  </div>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Timeline</h4>
                  <div className="space-y-2">
                    <p><span className="font-medium">Start Date:</span> {new Date(selectedBatch.startDate).toLocaleDateString()}</p>
                    <p><span className="font-medium">End Date:</span> {new Date(selectedBatch.endDate).toLocaleDateString()}</p>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-semibold mb-2">Phase Dates</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <p><span className="font-medium">Induction:</span><br />
                      {new Date(selectedBatch.inductionStartDate).toLocaleDateString()} - {new Date(selectedBatch.inductionEndDate).toLocaleDateString()}</p>
                    <p><span className="font-medium">Training:</span><br />
                      {new Date(selectedBatch.trainingStartDate).toLocaleDateString()} - {new Date(selectedBatch.trainingEndDate).toLocaleDateString()}</p>
                    <p><span className="font-medium">Certification:</span><br />
                      {new Date(selectedBatch.certificationStartDate).toLocaleDateString()} - {new Date(selectedBatch.certificationEndDate).toLocaleDateString()}</p>
                  </div>
                  <div className="space-y-2">
                    <p><span className="font-medium">OJT:</span><br />
                      {new Date(selectedBatch.ojtStartDate).toLocaleDateString()} - {new Date(selectedBatch.ojtEndDate).toLocaleDateString()}</p>
                    <p><span className="font-medium">OJT Certification:</span><br />
                      {new Date(selectedBatch.ojtCertificationStartDate).toLocaleDateString()} - {new Date(selectedBatch.ojtCertificationEndDate).toLocaleDateString()}</p>
                    <p><span className="font-medium">Handover to Ops:</span><br />
                      {new Date(selectedBatch.handoverToOpsDate).toLocaleDateString()}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}