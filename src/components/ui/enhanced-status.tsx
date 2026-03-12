import { Badge, BadgeProps } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  XCircle, 
  Package, 
  Truck, 
  ShoppingCart,
  User,
  Settings,
  Archive
} from "lucide-react";

const statusConfig = {
  // Asset statuses
  available: {
    label: "Available",
    variant: "default" as BadgeProps["variant"],
    icon: CheckCircle2,
    color: "text-green-600"
  },
  allocated: {
    label: "Allocated", 
    variant: "secondary" as BadgeProps["variant"],
    icon: User,
    color: "text-blue-600"
  },
  sold: {
    label: "Sold",
    variant: "outline" as BadgeProps["variant"], 
    icon: ShoppingCart,
    color: "text-purple-600"
  },
  in_transit: {
    label: "In Transit",
    variant: "secondary" as BadgeProps["variant"],
    icon: Truck,
    color: "text-orange-600"
  },
  ordered: {
    label: "Ordered",
    variant: "outline" as BadgeProps["variant"],
    icon: Clock,
    color: "text-blue-500"
  },
  maintenance: {
    label: "Maintenance",
    variant: "destructive" as BadgeProps["variant"],
    icon: Settings,
    color: "text-yellow-600"
  },
  retired: {
    label: "Retired",
    variant: "secondary" as BadgeProps["variant"],
    icon: Archive,
    color: "text-gray-500"
  },
  cancelled: {
    label: "Cancelled",
    variant: "destructive" as BadgeProps["variant"],
    icon: XCircle,
    color: "text-red-600"
  },
  returned: {
    label: "Returned",
    variant: "outline" as BadgeProps["variant"],
    icon: AlertCircle,
    color: "text-amber-600"
  },
  
  // Generic statuses
  active: {
    label: "Active",
    variant: "default" as BadgeProps["variant"],
    icon: CheckCircle2,
    color: "text-green-600"
  },
  inactive: {
    label: "Inactive",
    variant: "secondary" as BadgeProps["variant"],
    icon: XCircle,
    color: "text-gray-500"
  },
  pending: {
    label: "Pending",
    variant: "outline" as BadgeProps["variant"],
    icon: Clock,
    color: "text-amber-600"
  },
  completed: {
    label: "Completed",
    variant: "default" as BadgeProps["variant"],
    icon: CheckCircle2,
    color: "text-green-600"
  },
  failed: {
    label: "Failed",
    variant: "destructive" as BadgeProps["variant"],
    icon: XCircle,
    color: "text-red-600"
  },
  processing: {
    label: "Processing",
    variant: "secondary" as BadgeProps["variant"],
    icon: Settings,
    color: "text-blue-600"
  }
} as const;

export type StatusType = keyof typeof statusConfig;

interface StatusBadgeProps {
  status: StatusType | string;
  showIcon?: boolean;
  size?: "sm" | "default" | "lg";
  className?: string;
  children?: React.ReactNode;
  onClick?: () => void;
}

export const StatusBadge = ({ 
  status, 
  showIcon = true, 
  size = "default",
  className,
  children,
  onClick
}: StatusBadgeProps) => {
  const config = statusConfig[status as StatusType] || {
    label: status.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase()),
    variant: "outline" as BadgeProps["variant"],
    icon: AlertCircle,
    color: "text-muted-foreground"
  };

  const Icon = config.icon;
  
  const sizeClasses = {
    sm: "text-xs px-2 py-0.5",
    default: "text-sm px-2.5 py-0.5", 
    lg: "text-sm px-3 py-1"
  };

  return (
    <Badge 
      variant={config.variant}
      className={cn(
        "flex items-center gap-1.5 font-medium",
        sizeClasses[size],
        onClick && "cursor-pointer hover:opacity-80",
        className
      )}
      onClick={onClick}
    >
      {showIcon && <Icon className="h-3 w-3" />}
      {children || config.label}
    </Badge>
  );
};

interface StatusIndicatorProps {
  status: StatusType | string;
  size?: "sm" | "default" | "lg";
  className?: string;
}

export const StatusIndicator = ({ 
  status, 
  size = "default",
  className 
}: StatusIndicatorProps) => {
  const config = statusConfig[status as StatusType] || {
    color: "text-muted-foreground"
  };

  const sizeClasses = {
    sm: "h-2 w-2",
    default: "h-3 w-3",
    lg: "h-4 w-4"
  };

  return (
    <div 
      className={cn(
        "rounded-full bg-current",
        config.color,
        sizeClasses[size],
        className
      )}
      title={statusConfig[status as StatusType]?.label || status.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}
    />
  );
};

interface StatusListProps {
  items: Array<{
    status: StatusType | string;
    label?: string;
    count?: number;
    onClick?: () => void;
  }>;
  variant?: "badges" | "list" | "compact";
  className?: string;
}

export const StatusList = ({ 
  items, 
  variant = "badges",
  className 
}: StatusListProps) => {
  if (variant === "compact") {
    return (
      <div className={cn("flex flex-wrap gap-2", className)}>
        {items.map((item, index) => (
          <div 
            key={index}
            className={cn(
              "flex items-center gap-2 text-sm",
              item.onClick && "cursor-pointer hover:underline"
            )}
            onClick={item.onClick}
          >
            <StatusIndicator status={item.status} />
            <span>{item.label || item.status}</span>
            {item.count && (
              <span className="text-muted-foreground">({item.count})</span>
            )}
          </div>
        ))}
      </div>
    );
  }

  if (variant === "list") {
    return (
      <div className={cn("space-y-2", className)}>
        {items.map((item, index) => (
          <div 
            key={index}
            className={cn(
              "flex items-center justify-between p-2 rounded-lg border bg-card",
              item.onClick && "cursor-pointer hover:bg-accent"
            )}
            onClick={item.onClick}
          >
            <div className="flex items-center gap-3">
              <StatusIndicator status={item.status} />
              <span className="font-medium">{item.label || item.status}</span>
            </div>
            {item.count && (
              <Badge variant="secondary">{item.count}</Badge>
            )}
          </div>
        ))}
      </div>
    );
  }

  // Default: badges variant
  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {items.map((item, index) => (
        <StatusBadge
          key={index}
          status={item.status}
          className={item.onClick ? "cursor-pointer hover:opacity-80" : undefined}
          onClick={item.onClick}
        >
          {item.label || statusConfig[item.status as StatusType]?.label || item.status}
          {item.count && <span className="ml-1">({item.count})</span>}
        </StatusBadge>
      ))}
    </div>
  );
};