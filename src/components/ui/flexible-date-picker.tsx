import * as React from "react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

type DatePrecision = "year" | "month" | "full";

interface FlexibleDatePickerProps {
  value?: string;
  onChange?: (value: string) => void;
  className?: string;
  disabled?: boolean;
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

// Generate years from current year back 100 years
const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 100 }, (_, i) => currentYear - i);

// Generate days 1-31
const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);

// Helper to parse existing value and determine precision
const parseFlexibleDate = (value: string | undefined): {
  precision: DatePrecision;
  year: string;
  month: string;
  day: string;
} => {
  if (!value) {
    return { precision: "year", year: "", month: "", day: "" };
  }

  // Year only: "2018"
  if (/^\d{4}$/.test(value)) {
    return { precision: "year", year: value, month: "", day: "" };
  }

  // Month + Year: "2018-03"
  if (/^\d{4}-\d{2}$/.test(value)) {
    const [year, month] = value.split("-");
    return { precision: "month", year, month, day: "" };
  }

  // Full date: "2018-03-15"
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-");
    return { precision: "full", year, month, day };
  }

  // Try to parse as full date string
  try {
    const date = new Date(value);
    if (!isNaN(date.getTime())) {
      return {
        precision: "full",
        year: date.getFullYear().toString(),
        month: (date.getMonth() + 1).toString().padStart(2, "0"),
        day: date.getDate().toString().padStart(2, "0"),
      };
    }
  } catch {
    // Fall through to default
  }

  return { precision: "year", year: "", month: "", day: "" };
};

export function FlexibleDatePicker({
  value,
  onChange,
  className,
  disabled = false,
}: FlexibleDatePickerProps) {
  const parsed = React.useMemo(() => parseFlexibleDate(value), [value]);
  
  const [precision, setPrecision] = React.useState<DatePrecision>(parsed.precision);
  const [year, setYear] = React.useState(parsed.year);
  const [month, setMonth] = React.useState(parsed.month);
  const [day, setDay] = React.useState(parsed.day);

  // Update local state when value prop changes
  React.useEffect(() => {
    const parsed = parseFlexibleDate(value);
    setPrecision(parsed.precision);
    setYear(parsed.year);
    setMonth(parsed.month);
    setDay(parsed.day);
  }, [value]);

  // Build the output value based on precision and selected values
  const buildValue = React.useCallback(
    (p: DatePrecision, y: string, m: string, d: string): string => {
      if (!y) return "";
      
      switch (p) {
        case "year":
          return y;
        case "month":
          return m ? `${y}-${m.padStart(2, "0")}` : y;
        case "full":
          if (m && d) {
            return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
          } else if (m) {
            return `${y}-${m.padStart(2, "0")}`;
          }
          return y;
        default:
          return y;
      }
    },
    []
  );

  const handlePrecisionChange = (newPrecision: string) => {
    if (!newPrecision) return;
    const p = newPrecision as DatePrecision;
    setPrecision(p);
    
    // Clear irrelevant fields when reducing precision
    let newMonth = month;
    let newDay = day;
    
    if (p === "year") {
      newMonth = "";
      newDay = "";
    } else if (p === "month") {
      newDay = "";
    }
    
    setMonth(newMonth);
    setDay(newDay);
    
    if (year) {
      onChange?.(buildValue(p, year, newMonth, newDay));
    }
  };

  const handleYearChange = (newYear: string) => {
    setYear(newYear);
    onChange?.(buildValue(precision, newYear, month, day));
  };

  const handleMonthChange = (newMonth: string) => {
    setMonth(newMonth);
    onChange?.(buildValue(precision, year, newMonth, day));
  };

  const handleDayChange = (newDay: string) => {
    setDay(newDay);
    onChange?.(buildValue(precision, year, month, newDay));
  };

  // Get valid days for selected month/year
  const validDays = React.useMemo(() => {
    if (!year || !month) return DAYS;
    const daysInMonth = new Date(parseInt(year), parseInt(month), 0).getDate();
    return DAYS.filter((d) => d <= daysInMonth);
  }, [year, month]);

  return (
    <div className={cn("space-y-3", className)}>
      {/* Precision Toggle */}
      <ToggleGroup
        type="single"
        value={precision}
        onValueChange={handlePrecisionChange}
        className="justify-start"
        disabled={disabled}
      >
        <ToggleGroupItem value="year" size="sm" className="text-xs">
          Year Only
        </ToggleGroupItem>
        <ToggleGroupItem value="month" size="sm" className="text-xs">
          Month & Year
        </ToggleGroupItem>
        <ToggleGroupItem value="full" size="sm" className="text-xs">
          Full Date
        </ToggleGroupItem>
      </ToggleGroup>

      {/* Date Selectors */}
      <div className="flex gap-2">
        {/* Year - Always visible */}
        <div className="flex-1">
          <Label className="text-xs text-muted-foreground mb-1 block">Year</Label>
          <Select value={year} onValueChange={handleYearChange} disabled={disabled}>
            <SelectTrigger>
              <SelectValue placeholder="Year" />
            </SelectTrigger>
            <SelectContent className="bg-background/95 backdrop-blur-sm border shadow-lg z-50 max-h-[200px]">
              {YEARS.map((y) => (
                <SelectItem key={y} value={y.toString()}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Month - Visible for month and full precision */}
        {(precision === "month" || precision === "full") && (
          <div className="flex-1">
            <Label className="text-xs text-muted-foreground mb-1 block">Month</Label>
            <Select value={month} onValueChange={handleMonthChange} disabled={disabled}>
              <SelectTrigger>
                <SelectValue placeholder="Month" />
              </SelectTrigger>
              <SelectContent className="bg-background/95 backdrop-blur-sm border shadow-lg z-50 max-h-[200px]">
                {MONTHS.map((m, index) => (
                  <SelectItem key={m} value={(index + 1).toString().padStart(2, "0")}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Day - Visible only for full precision */}
        {precision === "full" && (
          <div className="w-24">
            <Label className="text-xs text-muted-foreground mb-1 block">Day</Label>
            <Select value={day} onValueChange={handleDayChange} disabled={disabled}>
              <SelectTrigger>
                <SelectValue placeholder="Day" />
              </SelectTrigger>
              <SelectContent className="bg-background/95 backdrop-blur-sm border shadow-lg z-50 max-h-[200px]">
                {validDays.map((d) => (
                  <SelectItem key={d} value={d.toString().padStart(2, "0")}>
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
    </div>
  );
}

// Helper function to format flexible dates for display
export function formatFlexibleDate(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null;

  // Year only: "2018"
  if (/^\d{4}$/.test(dateStr)) {
    return dateStr;
  }

  // Month + Year: "2018-03"
  if (/^\d{4}-\d{2}$/.test(dateStr)) {
    const [year, month] = dateStr.split("-");
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  }

  // Full date: "2018-03-15" or ISO string
  try {
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      return date.toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      });
    }
  } catch {
    return dateStr;
  }

  return dateStr;
}
