import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DraggableCardProps {
  id: string;
  children: React.ReactNode;
  className?: string;
  isDragDisabled?: boolean;
}

export const DraggableCard = ({ id, children, className, isDragDisabled = false }: DraggableCardProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled: isDragDisabled });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "relative group",
        isDragging && "z-50 opacity-75",
        className
      )}
    >
      {!isDragDisabled && (
        <div
          {...attributes}
          {...listeners}
          className="absolute left-2 top-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
        >
          <GripVertical className="h-4 w-4 text-muted-foreground hover:text-foreground" />
        </div>
      )}
      <div className={cn("transition-all duration-200", !isDragDisabled && "pl-6")}>
        {children}
      </div>
    </div>
  );
};