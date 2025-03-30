import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Edit, GripVertical, X } from 'lucide-react';
import { WidgetConfig } from './dashboard-configuration';
import { WidgetFactory } from './widget-factory';

// Props for the SortableWidget component
interface SortableWidgetProps {
  widget: WidgetConfig;
  batchIds?: number[];
  onRemove: (id: string) => void;
  onEdit: (widget: WidgetConfig) => void;
}

export function SortableWidget({ widget, batchIds, onRemove, onEdit }: SortableWidgetProps) {
  // Setup sortable functionality
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: widget.id });

  // Apply the transform from drag operations
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  // Determine widget size classes
  const sizeClasses = {
    small: 'h-64',
    medium: 'h-80',
    large: widget.type === 'phase-completion' ? 'col-span-2 h-96' : 'h-96',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        widget.size === 'large' && widget.type === 'phase-completion' ? 'col-span-2' : '',
        'relative',
        isDragging ? 'z-10 opacity-50' : ''
      )}
      {...attributes}
    >
      <Card className={cn('relative overflow-hidden', sizeClasses[widget.size])}>
        <CardHeader className="p-3 flex flex-row items-center justify-between bg-muted/20">
          <div
            {...listeners}
            className="cursor-move p-1 rounded hover:bg-muted"
          >
            <GripVertical className="h-4 w-4" />
          </div>
          <CardTitle className="text-sm font-medium line-clamp-1 flex-grow mx-2">
            {widget.title}
          </CardTitle>
          <div className="flex space-x-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => onEdit(widget)}
            >
              <Edit className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => onRemove(widget.id)}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0 h-[calc(100%-40px)]">
          <WidgetFactory widget={widget} batchIds={batchIds} />
        </CardContent>
      </Card>
    </div>
  );
}