import * as React from "react";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Generate time slots from 6:00 AM to 10:00 PM in 15-minute increments
const generateTimeSlots = () => {
  const slots: { value: string; label: string }[] = [];
  for (let hour = 6; hour <= 22; hour++) {
    for (let minute = 0; minute < 60; minute += 15) {
      const time24 = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
      const hour12 = hour % 12 || 12;
      const ampm = hour < 12 ? 'AM' : 'PM';
      const label = `${hour12}:${minute.toString().padStart(2, '0')} ${ampm}`;
      slots.push({ value: time24, label });
    }
  }
  return slots;
};

const TIME_SLOTS = generateTimeSlots();

// Format 24-hour time to 12-hour display
const formatTo12Hour = (time24: string): string => {
  if (!time24) return "";
  const [hourStr, minuteStr] = time24.split(':');
  const hour = parseInt(hourStr, 10);
  const hour12 = hour % 12 || 12;
  const ampm = hour < 12 ? 'AM' : 'PM';
  return `${hour12}:${minuteStr} ${ampm}`;
};

interface TimeComboboxProps {
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function TimeCombobox({
  value,
  onValueChange,
  placeholder = "Select time",
  disabled = false,
}: TimeComboboxProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Check if current value is a predefined slot
  const isPresetValue = TIME_SLOTS.some((slot) => slot.value === value);
  
  // Display value: use preset label if available, otherwise format the custom time
  const displayValue = value 
    ? (TIME_SLOTS.find((slot) => slot.value === value)?.label || formatTo12Hour(value))
    : "";

  const handleNativeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.value) {
      onValueChange(e.target.value);
    }
  };

  const openNativePicker = () => {
    if (inputRef.current) {
      // Try showPicker first (modern browsers), fallback to click
      if (typeof inputRef.current.showPicker === 'function') {
        inputRef.current.showPicker();
      } else {
        inputRef.current.click();
      }
    }
  };

  return (
    <div className="flex gap-2">
      {/* Main Select dropdown for quick time selection */}
      <Select 
        value={isPresetValue ? value : ""} 
        onValueChange={onValueChange} 
        disabled={disabled}
      >
        <SelectTrigger className={cn("flex-1", !value && "text-muted-foreground")}>
          <Clock className="mr-2 h-4 w-4 shrink-0 opacity-50" />
          <SelectValue placeholder={placeholder}>
            {displayValue || placeholder}
          </SelectValue>
        </SelectTrigger>
        <SelectContent className="max-h-[300px]">
          {TIME_SLOTS.map((slot) => (
            <SelectItem key={slot.value} value={slot.value}>
              {slot.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      
      {/* Clock button for native time picker (custom times) */}
      <Button 
        type="button"
        variant="outline" 
        size="icon"
        disabled={disabled}
        onClick={openNativePicker}
        title="Pick custom time"
      >
        <Clock className="h-4 w-4" />
      </Button>
      
      {/* Hidden native time input */}
      <input 
        ref={inputRef}
        type="time" 
        className="sr-only"
        value={value}
        onChange={handleNativeChange}
        tabIndex={-1}
        aria-hidden="true"
      />
    </div>
  );
}
