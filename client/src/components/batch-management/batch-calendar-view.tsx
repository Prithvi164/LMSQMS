import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { OrganizationBatch } from "@shared/schema";

export function BatchCalendarView() {
  const { user } = useAuth();

  const {
    data: batches = [],
    isLoading,
  } = useQuery<OrganizationBatch[]>({
    queryKey: [`/api/organizations/${user?.organizationId}/batches`],
    enabled: !!user?.organizationId
  });

  const getEventColor = (status: string) => {
    switch (status) {
      case 'ongoing':
        return '#22c55e'; // Green
      case 'planned':
        return '#3b82f6'; // Blue
      case 'completed':
        return '#6b7280'; // Gray
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
      category: batch.batchCategory
    }
  }));

  const renderEventContent = (eventInfo: any) => {
    return (
      <div className="p-1">
        <div className="font-semibold">{eventInfo.event.title}</div>
        <div className="text-xs">
          <Badge variant="secondary" className="mr-1">
            {eventInfo.event.extendedProps.status.charAt(0).toUpperCase() + 
             eventInfo.event.extendedProps.status.slice(1)}
          </Badge>
          {eventInfo.event.extendedProps.process}
        </div>
      </div>
    );
  };

  if (isLoading) {
    return <div>Loading calendar...</div>;
  }

  return (
    <Card className="p-4">
      <div className="mb-4">
        <h3 className="text-lg font-semibold">Batch Calendar</h3>
        <div className="flex flex-wrap gap-2 mt-2">
          {['planned', 'induction', 'training', 'certification', 'ojt', 'ojt_certification', 'completed'].map(status => (
            <div key={status} className="flex items-center gap-1">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: getEventColor(status) }}
              />
              <span className="text-sm">
                {status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')}
              </span>
            </div>
          ))}
        </div>
      </div>
      <FullCalendar
        plugins={[dayGridPlugin, interactionPlugin]}
        initialView="dayGridMonth"
        events={events}
        eventContent={renderEventContent}
        headerToolbar={{
          left: 'prev,next today',
          center: 'title',
          right: 'dayGridMonth,dayGridWeek'
        }}
        eventDidMount={(info) => {
          // Add tooltip with more details
          const tooltip = `
            ${info.event.title}
            Status: ${info.event.extendedProps.status}
            Process: ${info.event.extendedProps.process}
            Location: ${info.event.extendedProps.location}
            Trainer: ${info.event.extendedProps.trainer}
          `;
          info.el.setAttribute('title', tooltip);
        }}
        height="auto"
        aspectRatio={1.8}
      />
    </Card>
  );
}
