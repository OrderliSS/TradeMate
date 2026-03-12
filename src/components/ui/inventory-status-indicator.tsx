import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface InventoryStatusIndicatorProps {
  trueAvailable: number;
  allocated: number;
  pendingDeliveries: number;
  totalStock: number;
  showTooltip?: boolean;
  size?: "sm" | "default" | "lg";
}

export function InventoryStatusIndicator({
  trueAvailable,
  allocated,
  pendingDeliveries,
  totalStock,
  showTooltip = true,
  size = "default"
}: InventoryStatusIndicatorProps) {
  const getStatusInfo = () => {
    // Always show the actual available quantity, not pending deliveries
    if (trueAvailable <= 0) {
      return {
        variant: "destructive" as const,
        text: `${trueAvailable} Available`,
        color: "text-red-600",
        description: pendingDeliveries > 0 
          ? "No stock available, but items are on order"
          : "No stock available and nothing on order"
      };
    }
    
    if (trueAvailable < totalStock * 0.2) {
      return {
        variant: "outline" as const,
        text: `${trueAvailable} Low Stock`,
        color: "text-yellow-600",
        description: "Stock is running low, consider reordering"
      };
    }
    
    return {
      variant: "default" as const,
      text: `${trueAvailable} Available`,
      color: "text-green-600",
      description: "Sufficient stock available for allocation"
    };
  };

  const status = getStatusInfo();

  const sizeClasses = {
    sm: "text-xs",
    default: "text-sm", 
    lg: "text-base"
  };

  const indicator = (
    <Badge variant={status.variant} className={`${sizeClasses[size]}`}>
      <span className="whitespace-nowrap">{status.text}</span>
    </Badge>
  );

  if (!showTooltip) {
    return indicator;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {indicator}
        </TooltipTrigger>
        <TooltipContent>
          <div className="space-y-1">
            <p className="font-medium">{status.description}</p>
            <div className="text-xs text-muted-foreground space-y-1">
              <div>Total Stock: {totalStock}</div>
              <div>Allocated: {allocated}</div>
              <div>Pending Deliveries: {pendingDeliveries}</div>
              <div className="font-medium">Available: {trueAvailable}</div>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function InventoryBreakdown({
  trueAvailable,
  allocated,
  pendingDeliveries,
  totalStock,
  className = ""
}: InventoryStatusIndicatorProps & { className?: string }) {
  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Total Stock:</span>
        <span className="font-medium">{totalStock}</span>
      </div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Allocated:</span>
        <span className="font-medium text-orange-600">-{allocated}</span>
      </div>
      {pendingDeliveries > 0 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Pending Orders:</span>
          <span className="font-medium text-blue-600">-{pendingDeliveries}</span>
        </div>
      )}
      <hr className="my-1" />
      <div className="flex items-center justify-between text-sm font-semibold">
        <span>Available Now:</span>
        <span className={trueAvailable > 0 ? "text-green-600" : "text-red-600"}>
          {trueAvailable}
        </span>
      </div>
    </div>
  );
}