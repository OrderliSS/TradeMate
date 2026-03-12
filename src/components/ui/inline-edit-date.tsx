import { useState } from "react";
import { Button } from "./button";
import { Calendar } from "./calendar";
import { Input } from "./input";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { Edit3, Check, X, Loader2, CalendarIcon, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, parse } from "date-fns";
import { formatDateAsStored } from "@/lib/date-utils";

interface InlineEditDateProps {
  value: Date | string | null | undefined;
  onSave: (value: string) => Promise<void>;
  canEdit: boolean;
  placeholder?: string;
  className?: string;
  displayClassName?: string;
  showTime?: boolean;
}

export const InlineEditDate = ({
  value,
  onSave,
  canEdit,
  placeholder = "No date set",
  className,
  displayClassName,
  showTime = true
}: InlineEditDateProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState<Date | undefined>();
  const [timeValue, setTimeValue] = useState<string>("12:00");
  const [isLoading, setIsLoading] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);

  const dateValue = value ? (typeof value === 'string' ? new Date(value) : value) : null;
  
  // Format display to include time when available and showTime is true
  // Use formatDateAsStored to display dates in their stored UTC time without timezone conversion
  const formatDisplay = (dateInput: Date | string) => {
    const dateStr = typeof dateInput === 'string' ? dateInput : dateInput.toISOString();
    
    if (showTime) {
      // Use formatDateAsStored to properly handle UTC dates
      const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
      // Adjust for timezone offset to check if time is meaningful
      const utcDate = new Date(date.getTime() + date.getTimezoneOffset() * 60000);
      const hasTime = utcDate.getHours() !== 0 || utcDate.getMinutes() !== 0;
      
      if (hasTime) {
        return formatDateAsStored(dateStr, "MMM d, yyyy 'at' h:mm a");
      }
    }
    return formatDateAsStored(dateStr, "PPP");
  };
  
  const displayValue = value ? formatDisplay(value) : placeholder;

  const handleEdit = () => {
    setEditValue(dateValue || undefined);
    if (dateValue) {
      setTimeValue(format(dateValue, "HH:mm"));
    } else {
      setTimeValue("12:00");
    }
    setIsEditing(true);
  };

  const handleSave = async () => {
    if (!editValue) {
      // Handle clearing the date
      if (dateValue) {
        setIsLoading(true);
        try {
          await onSave('');
          setIsEditing(false);
          setCalendarOpen(false);
        } catch (error) {
          // Error is handled by the parent component
        } finally {
          setIsLoading(false);
        }
      } else {
        setIsEditing(false);
      }
      return;
    }

    // Combine date and time
    const [hours, minutes] = timeValue.split(':').map(Number);
    const combinedDate = new Date(editValue);
    combinedDate.setHours(hours, minutes, 0, 0);
    
    const newDateString = showTime 
      ? combinedDate.toISOString()
      : format(combinedDate, "yyyy-MM-dd");
    const currentDateString = dateValue 
      ? (showTime ? dateValue.toISOString() : format(dateValue, "yyyy-MM-dd"))
      : '';
    
    if (newDateString === currentDateString) {
      setIsEditing(false);
      return;
    }

    setIsLoading(true);
    try {
      await onSave(newDateString);
      setIsEditing(false);
      setCalendarOpen(false);
    } catch (error) {
      // Error is handled by the parent component
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setEditValue(undefined);
    setIsEditing(false);
    setCalendarOpen(false);
  };

  if (!canEdit) {
    return (
      <span className={cn("text-muted-foreground", displayClassName)}>
        {displayValue}
      </span>
    );
  }

  if (isEditing) {
    return (
      <div className={cn("flex flex-wrap items-center gap-1 max-w-full print:hidden", className)}>
        <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className="h-7 justify-start text-left font-normal px-2 text-xs"
              disabled={isLoading}
            >
              <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
              {editValue ? format(editValue, "MMM d, yyyy") : "Pick a date"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0 z-50" align="start">
            <Calendar
              mode="single"
              selected={editValue}
              onSelect={setEditValue}
              initialFocus
              className={cn("p-2 pointer-events-auto")}
            />
          </PopoverContent>
        </Popover>
        {showTime && (
          <div className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
            <Input
              type="time"
              value={timeValue}
              onChange={(e) => setTimeValue(e.target.value)}
              className="h-7 w-[90px] text-[13px] px-1.5"
              disabled={isLoading}
            />
          </div>
        )}
        <div className="flex items-center gap-0.5 shrink-0">
          <Button
            size="sm"
            onClick={handleSave}
            disabled={isLoading}
            className="h-7 w-7 p-0"
            title="Save changes"
          >
            {isLoading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Check className="h-3.5 w-3.5" />
            )}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleCancel}
            disabled={isLoading}
            className="h-7 w-7 p-0"
            title="Cancel editing"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-2 group", className)}>
      <span className={cn("text-muted-foreground", displayClassName)}>
        {displayValue}
      </span>
      <Button
        size="sm"
        variant="ghost"
        onClick={handleEdit}
        className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <Edit3 className="h-3 w-3" />
      </Button>
    </div>
  );
};