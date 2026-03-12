import { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BulkActionBarProps {
  selectedCount: number;
  onClear: () => void;
  actions: ReactNode;
  className?: string;
}

export function BulkActionBar({ selectedCount, onClear, actions, className }: BulkActionBarProps) {
  if (selectedCount === 0) return null;

  return (
    <div
      className={cn(
        "fixed bottom-20 left-1/2 -translate-x-1/2 z-[60]",
        "bg-background border border-border rounded-lg shadow-lg",
        "px-4 py-3 flex items-center gap-4",
        "animate-in slide-in-from-bottom-5 duration-300",
        className
      )}
    >
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={onClear}
          className="h-8 w-8"
          aria-label="Clear selection"
        >
          <X className="h-4 w-4" />
        </Button>
        <span className="text-sm font-medium">
          {selectedCount} selected
        </span>
      </div>

      <div className="h-6 w-px bg-border" />

      <div className="flex items-center gap-2">
        {actions}
      </div>
    </div>
  );
}
