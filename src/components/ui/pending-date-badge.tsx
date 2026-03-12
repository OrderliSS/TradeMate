import * as React from "react";
import { format, differenceInDays } from "date-fns";
import { CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface PendingDateBadgeProps {
  date: Date | string | null;
  reason?: string | null;
  onClick?: () => void;
  isEditable?: boolean;
  size?: "sm" | "default";
  className?: string;
}

export function PendingDateBadge({
  date,
  reason,
  onClick,
  isEditable = true,
  size = "default",
  className,
}: PendingDateBadgeProps) {
  
  
  const parsedDate = React.useMemo(() => {
    if (!date) return null;
    return typeof date === "string" ? new Date(date) : date;
  }, [date]);

  if (!parsedDate) return null;

  const now = new Date();
  const daysUntil = differenceInDays(parsedDate, now);
  const isOverdue = daysUntil < 0;
  const isApproaching = daysUntil >= 0 && daysUntil <= 2;


  // Check if time was intentionally set (not midnight)
  const hasTime = parsedDate.getHours() !== 0 || parsedDate.getMinutes() !== 0;
  
  // Format display: show time if set
  const displayFormat = hasTime ? "MMM d, h:mma" : "MMM d";
  const formattedDisplay = format(parsedDate, displayFormat).replace(':00', '').toLowerCase();
  
  const badgeContent = (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-medium transition-colors",
        size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-sm",
        isOverdue && "bg-warning/10 text-warning border-warning/30 hover:bg-warning/20",
        isApproaching && !isOverdue && "bg-amber-100/80 text-amber-700 border-amber-300/50 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-700/30 hover:bg-amber-200/80 dark:hover:bg-amber-950/50",
        !isOverdue && !isApproaching && "bg-muted/50 text-muted-foreground border-border/50 hover:bg-muted",
        isEditable && "cursor-pointer",
        className
      )}
    >
      <CalendarDays className={cn(size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5")} />
      <span>{formattedDisplay}</span>
    </div>
  );

  // Tooltip shows full date and time
  const tooltipDateFormat = hasTime ? "EEEE, MMMM d, yyyy 'at' h:mm a" : "EEEE, MMMM d, yyyy";
  
  const tooltipContent = (
    <div className="text-center">
      <div className="font-medium">{format(parsedDate, tooltipDateFormat)}</div>
      {reason && <div className="text-xs text-muted-foreground mt-0.5">{reason}</div>}
      {isOverdue && <div className="text-xs text-warning mt-0.5">Overdue by {Math.abs(daysUntil)} day{Math.abs(daysUntil) !== 1 ? 's' : ''}</div>}
      {isApproaching && !isOverdue && <div className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">{daysUntil === 0 ? 'Due today' : `Due in ${daysUntil} day${daysUntil !== 1 ? 's' : ''}`}</div>}
    </div>
  );

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div onClick={isEditable && onClick ? onClick : undefined}>
            {badgeContent}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          {tooltipContent}
          {isEditable && onClick && (
            <div className="text-xs text-muted-foreground mt-1">Click to edit</div>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
