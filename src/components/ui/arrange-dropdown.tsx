import React from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ArrowUpDown, ArrowUp, ArrowDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ArrangeOption {
  field: string;
  label: string;
}

interface ArrangeDropdownProps {
  options: ArrangeOption[];
  currentField?: string;
  currentDirection?: 'asc' | 'desc';
  onChange?: (field: string, direction: 'asc' | 'desc') => void;
  isActive?: boolean;
  className?: string;
  showLabel?: boolean;
}

export const ArrangeDropdown: React.FC<ArrangeDropdownProps> = ({
  options,
  currentField,
  currentDirection = 'asc',
  onChange,
  isActive = false,
  className,
  showLabel = true,
}) => {
  const currentOption = options.find(opt => opt.field === currentField);
  
  const handleFieldSelect = (field: string) => {
    onChange?.(field, currentDirection);
  };

  const handleDirectionToggle = () => {
    if (currentField) {
      onChange?.(currentField, currentDirection === 'asc' ? 'desc' : 'asc');
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant={isActive ? "default" : "outline"} 
          size="sm" 
          className={cn("h-9 gap-1.5 px-2.5", className)}
        >
          <ArrowUpDown className="h-4 w-4" />
          {showLabel && (
            <span className="hidden sm:inline">
              {currentOption ? currentOption.label : "Arrange"}
            </span>
          )}
          {currentField && (
            currentDirection === 'asc' 
              ? <ArrowUp className="h-3 w-3" />
              : <ArrowDown className="h-3 w-3" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48 bg-popover z-50">
        {options.map((option) => (
          <DropdownMenuItem
            key={option.field}
            onClick={() => handleFieldSelect(option.field)}
            className="flex items-center justify-between"
          >
            <span>{option.label}</span>
            {currentField === option.field && (
              <Check className="h-4 w-4 text-primary" />
            )}
          </DropdownMenuItem>
        ))}
        
        {currentField && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleDirectionToggle} className="flex items-center gap-2">
              {currentDirection === 'asc' ? (
                <>
                  <ArrowUp className="h-4 w-4" />
                  <span>Ascending</span>
                </>
              ) : (
                <>
                  <ArrowDown className="h-4 w-4" />
                  <span>Descending</span>
                </>
              )}
              <span className="ml-auto text-xs text-muted-foreground">Click to flip</span>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
