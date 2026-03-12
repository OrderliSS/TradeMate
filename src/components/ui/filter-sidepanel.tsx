import React, { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Filter, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface FilterSidePanelProps {
  children: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  activeCount?: number;
  onClearAll?: () => void;
  title?: string;
  triggerClassName?: string;
  showLabel?: boolean;
}

export const FilterSidePanel: React.FC<FilterSidePanelProps> = ({
  children,
  open,
  onOpenChange,
  activeCount = 0,
  onClearAll,
  title = "Filters",
  triggerClassName,
  showLabel = true,
}) => {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>
        <Button 
          variant={activeCount > 0 ? "default" : "outline"} 
          size="sm" 
          className={cn("h-9 gap-1.5 relative", triggerClassName)}
        >
          <Filter className="h-4 w-4" />
          {showLabel && <span className="hidden sm:inline">Filter</span>}
          {activeCount > 0 && (
            <Badge 
              variant="secondary" 
              className="h-5 min-w-[20px] px-1.5 text-xs bg-primary-foreground text-primary"
            >
              {activeCount}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-80 sm:w-96 bg-card">
        <SheetHeader className="flex flex-row items-center justify-between pb-4 border-b">
          <SheetTitle>{title}</SheetTitle>
          {activeCount > 0 && onClearAll && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={onClearAll}
              className="h-8 text-xs"
            >
              <X className="h-3 w-3 mr-1" />
              Clear All
            </Button>
          )}
        </SheetHeader>
        <div className="py-4 space-y-4 overflow-y-auto max-h-[calc(100vh-120px)]">
          {children}
        </div>
      </SheetContent>
    </Sheet>
  );
};

// Popover variant for inline filter display
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface FilterPopoverProps {
  children: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  activeCount?: number;
  onClearAll?: () => void;
  triggerClassName?: string;
  showLabel?: boolean;
  align?: "start" | "center" | "end";
}

export const FilterPopover: React.FC<FilterPopoverProps> = ({
  children,
  open,
  onOpenChange,
  activeCount = 0,
  onClearAll,
  triggerClassName,
  showLabel = true,
  align = "start",
}) => {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button 
          variant={activeCount > 0 ? "default" : "outline"} 
          size="sm" 
          className={cn("h-9 gap-1.5 relative", triggerClassName)}
        >
          <Filter className="h-4 w-4" />
          {showLabel && <span className="hidden sm:inline">Filter</span>}
          {activeCount > 0 && (
            <Badge 
              variant="secondary" 
              className="h-5 min-w-[20px] px-1.5 text-xs bg-primary-foreground text-primary"
            >
              {activeCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        align={align} 
        className="w-80 p-4 bg-popover z-50"
        sideOffset={8}
      >
        <div className="space-y-4">
          {activeCount > 0 && onClearAll && (
            <div className="flex items-center justify-between pb-2 border-b">
              <span className="text-sm font-medium">Filters</span>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={onClearAll}
                className="h-7 text-xs"
              >
                Clear All
              </Button>
            </div>
          )}
          {children}
        </div>
      </PopoverContent>
    </Popover>
  );
};
