/**
 * PendingReasonBadge Component
 * 
 * Displays the fulfillment pending reason as a compact, clickable badge.
 * Used on ticket cards to show pending status at a glance without opening dialogs.
 * 
 * @example
 * <PendingReasonBadge
 *   reason="pending_customer_pickup"
 *   onClick={() => openFulfillmentDialog()}
 *   isEditable={!isClosed}
 *   size="sm"
 * />
 * 
 * @see DeliveryFulfillmentDialog for PENDING_REASON_OPTIONS constant
 */
import * as React from "react";
import { MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface PendingReasonBadgeProps {
  /** The pending reason value (internal key or custom text) */
  reason: string | null;
  /** Callback when badge is clicked (typically opens edit dialog) */
  onClick?: () => void;
  /** Whether the badge should be clickable/editable */
  isEditable?: boolean;
  /** Size variant for compact displays */
  size?: "sm" | "default";
  /** Additional CSS classes */
  className?: string;
}

/**
 * Maps internal reason keys to user-friendly display labels.
 * Synced with PENDING_REASON_OPTIONS in DeliveryFulfillmentDialog.
 */
const reasonDisplayMap: Record<string, string> = {
  "pending_customer_pickup": "Customer Pickup",
  "awaiting_payment": "Awaiting Payment",
  "awaiting_customer_response": "Customer Response",
  "customer_on_leave": "Customer on Leave",
  "scheduling_delivery": "Scheduling Delivery",
  "pending_stock_arrival": "Stock Arrival",
  "other": "Other",
};

export function PendingReasonBadge({
  reason,
  onClick,
  isEditable = true,
  size = "default",
  className,
}: PendingReasonBadgeProps) {
  if (!reason) return null;

  // Get display label - use mapped value or original if not found
  const displayLabel = reasonDisplayMap[reason] || reason;
  
  // Truncate long custom reasons
  const truncatedLabel = displayLabel.length > 25 
    ? `${displayLabel.substring(0, 22)}...` 
    : displayLabel;
  
  const needsTruncation = displayLabel.length > 25;

  const badgeContent = (
    <div
      onClick={isEditable && onClick ? onClick : undefined}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-medium transition-colors",
        size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-sm",
        "bg-slate-100 text-slate-700 border-slate-200/80",
        "dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
        "hover:bg-slate-200 dark:hover:bg-slate-700",
        isEditable && "cursor-pointer",
        className
      )}
    >
      <MessageCircle className={cn(size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5")} />
      <span>{truncatedLabel}</span>
    </div>
  );

  // Only wrap in tooltip if text is truncated or if editable
  if (needsTruncation || isEditable) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            {badgeContent}
          </TooltipTrigger>
          <TooltipContent>
            <div className="text-center">
              <div className="font-medium">{displayLabel}</div>
              {isEditable && onClick && (
                <div className="text-xs text-muted-foreground mt-1">Click to edit</div>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return badgeContent;
}
