import { useState } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { nanoid } from 'nanoid';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { WidgetConfig, WidgetType } from './dashboard-configuration';
import { SortableWidget } from './sortable-widget';
import { Plus } from 'lucide-react';

// Props for the DraggableDashboard component
interface DraggableDashboardProps {
  widgets: WidgetConfig[];
  onWidgetsChange: (widgets: WidgetConfig[]) => void;
  batchIds?: number[];
}

// Schema for widget form validation
const widgetFormSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  type: z.string().min(1, 'Widget type is required'),
  size: z.enum(['small', 'medium', 'large']),
  chartType: z.enum(['bar', 'pie', 'line']).optional(),
});

// Type for widget form values
type WidgetFormValues = z.infer<typeof widgetFormSchema>;

export function DraggableDashboard({ widgets, onWidgetsChange, batchIds }: DraggableDashboardProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingWidget, setEditingWidget] = useState<WidgetConfig | null>(null);
  
  // Configure mouse and touch sensors for drag and drop
  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 10,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 250,
        tolerance: 5,
      },
    })
  );

  // Setup form with zod validation
  const form = useForm<WidgetFormValues>({
    resolver: zodResolver(widgetFormSchema),
    defaultValues: {
      title: '',
      type: '',
      size: 'medium',
      chartType: 'bar',
    },
  });

  // Track drag start to update active widget
  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string);
  }

  // Handle drag end to reorder widgets
  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveId(null);
    
    if (!over) return;
    
    if (active.id !== over.id) {
      const oldIndex = widgets.findIndex((w) => w.id === active.id);
      const newIndex = widgets.findIndex((w) => w.id === over.id);
      
      const newWidgets = arrayMove(widgets, oldIndex, newIndex);
      
      // Update positions to reflect new order
      const updatedWidgets = newWidgets.map((widget, index) => {
        const row = Math.floor(index / 2);
        const col = index % 2;
        return {
          ...widget,
          position: { x: col, y: row },
        };
      });
      
      onWidgetsChange(updatedWidgets);
    }
  }

  // Remove a widget from the dashboard
  function handleRemoveWidget(id: string) {
    const newWidgets = widgets.filter((w) => w.id !== id);
    const updatedWidgets = newWidgets.map((widget, index) => {
      const row = Math.floor(index / 2);
      const col = index % 2;
      return {
        ...widget,
        position: { x: col, y: row },
      };
    });
    
    onWidgetsChange(updatedWidgets);
  }

  // Open edit modal with widget data
  function handleEditWidget(widget: WidgetConfig) {
    setEditingWidget(widget);
    form.reset({
      title: widget.title,
      type: widget.type,
      size: widget.size,
      chartType: widget.chartType || 'bar',
    });
    setIsModalOpen(true);
  }

  // Save edited widget data
  function handleSaveEdit(values: WidgetFormValues) {
    if (editingWidget) {
      // Update existing widget
      const updatedWidgets = widgets.map((w) => {
        if (w.id === editingWidget.id) {
          return {
            ...w,
            title: values.title,
            type: values.type as WidgetType,
            size: values.size,
            chartType: values.chartType,
          };
        }
        return w;
      });
      onWidgetsChange(updatedWidgets);
    } else {
      // Create new widget
      const newWidget: WidgetConfig = {
        id: nanoid(),
        title: values.title,
        type: values.type as WidgetType,
        size: values.size,
        chartType: values.chartType,
        position: {
          x: (widgets.length % 2),
          y: Math.floor(widgets.length / 2),
        },
      };
      onWidgetsChange([...widgets, newWidget]);
    }
    
    handleCloseModal();
  }

  // Open modal to add a new widget
  function handleAddWidget() {
    setEditingWidget(null);
    form.reset({
      title: '',
      type: '',
      size: 'medium',
      chartType: 'bar',
    });
    setIsModalOpen(true);
  }

  // Close the edit/add modal
  function handleCloseModal() {
    setIsModalOpen(false);
    setEditingWidget(null);
  }

  // Get sorted widgets based on position
  const sortedWidgets = [...widgets].sort((a, b) => {
    if (a.position.y === b.position.y) {
      return a.position.x - b.position.x;
    }
    return a.position.y - b.position.y;
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={handleAddWidget} size="sm">
          <Plus className="h-4 w-4 mr-1" />
          Add Widget
        </Button>
      </div>
      
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="grid grid-cols-2 gap-4">
          {sortedWidgets.map((widget) => (
            <SortableWidget
              key={widget.id}
              widget={widget}
              batchIds={batchIds}
              onRemove={handleRemoveWidget}
              onEdit={handleEditWidget}
            />
          ))}
        </div>
      </DndContext>
      
      {/* Add/Edit Widget Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>
              {editingWidget ? 'Edit Widget' : 'Add New Widget'}
            </DialogTitle>
          </DialogHeader>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSaveEdit)} className="space-y-4">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Widget Title</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter widget title" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Widget Type</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select widget type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="assessment-performance">Assessment Performance</SelectItem>
                        <SelectItem value="certification-progress">Certification Progress</SelectItem>
                        <SelectItem value="attendance-overview">Attendance Overview</SelectItem>
                        <SelectItem value="attendance-trends">Attendance Trends</SelectItem>
                        <SelectItem value="performance-distribution">Performance Distribution</SelectItem>
                        <SelectItem value="phase-completion">Phase Completion</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="size"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Widget Size</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select widget size" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="small">Small</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="large">Large</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="chartType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Chart Type</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select chart type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="bar">Bar Chart</SelectItem>
                        <SelectItem value="pie">Pie Chart</SelectItem>
                        <SelectItem value="line">Line Chart</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="flex justify-end space-x-2 pt-4">
                <Button type="button" variant="outline" onClick={handleCloseModal}>
                  Cancel
                </Button>
                <Button type="submit">
                  {editingWidget ? 'Save Changes' : 'Add Widget'}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}