import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  Play, 
  Pause, 
  Truck, 
  Package, 
  DollarSign,
  TrendingUp,
  TrendingDown
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"

const enhancedStatusBadgeVariants = cva(
  "inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium transition-all duration-200",
  {
    variants: {
      variant: {
        default: "bg-secondary text-secondary-foreground",
        new: "bg-status-new-bg text-status-new border border-status-new-border",
        inprogress: "bg-status-inprogress-bg text-status-inprogress border border-status-inprogress-border",
        onhold: "bg-status-onhold-bg text-status-onhold border border-status-onhold-border",
        completed: "bg-status-completed-bg text-status-completed border border-status-completed-border",
        cancelled: "bg-status-cancelled-bg text-status-cancelled border border-status-cancelled-border",
        success: "bg-success-bg text-success border border-success-border",
        warning: "bg-warning-bg text-warning border border-warning-border",
        danger: "bg-danger-bg text-danger border border-danger-border",
        info: "bg-info-bg text-info border border-info-border",
        profit: "bg-financial-profit-bg text-financial-profit-text border border-financial-profit-bg",
        loss: "bg-financial-loss-bg text-financial-loss-text border border-financial-loss-bg",
        ordered: "bg-delivery-ordered-bg text-delivery-ordered border border-delivery-ordered-border",
        processing: "bg-delivery-processing-bg text-delivery-processing border border-delivery-processing-border",
        shipped: "bg-delivery-shipped-bg text-delivery-shipped border border-delivery-shipped-border",
        intransit: "bg-delivery-intransit-bg text-delivery-intransit border border-delivery-intransit-border",
        delivered: "bg-delivery-delivered-bg text-delivery-delivered border border-delivery-delivered-border",
      },
      size: {
        default: "text-xs px-2.5 py-1",
        sm: "text-xs px-2 py-0.5",
        lg: "text-sm px-3 py-1.5",
      },
      animated: {
        true: "hover:scale-[1.005] active:scale-95",
        false: "",
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default",
      animated: false,
    },
  }
)

const statusIcons = {
  new: Clock,
  inprogress: Play,
  onhold: Pause,
  completed: CheckCircle,
  cancelled: XCircle,
  success: CheckCircle,
  warning: AlertCircle,
  danger: XCircle,
  info: AlertCircle,
  profit: TrendingUp,
  loss: TrendingDown,
  ordered: Package,
  processing: Clock,
  shipped: Truck,
  intransit: Truck,
  delivered: CheckCircle,
}

export interface EnhancedStatusBadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof enhancedStatusBadgeVariants> {
  children: React.ReactNode
  showIcon?: boolean
  pulse?: boolean
  iconPosition?: "left" | "right"
}

const EnhancedStatusBadge = React.forwardRef<HTMLDivElement, EnhancedStatusBadgeProps>(
  ({ 
    className, 
    variant, 
    size, 
    animated, 
    children, 
    showIcon = true, 
    pulse = false,
    iconPosition = "left",
    ...props 
  }, ref) => {
    const IconComponent = variant && statusIcons[variant as keyof typeof statusIcons]
    
    return (
      <Badge
        className={cn(
          enhancedStatusBadgeVariants({ variant, size, animated, className }),
          pulse && "animate-pulse",
          "rounded-full"
        )}
        {...props}
      >
        {showIcon && IconComponent && iconPosition === "left" && (
          <IconComponent className="w-3 h-3" />
        )}
        <span>{children}</span>
        {showIcon && IconComponent && iconPosition === "right" && (
          <IconComponent className="w-3 h-3" />
        )}
      </Badge>
    )
  }
)
EnhancedStatusBadge.displayName = "EnhancedStatusBadge"

// Predefined status badges for common use cases
const TaskStatusBadge = ({ status }: { status: string }) => {
  const statusMap: Record<string, { variant: any; label: string; pulse?: boolean }> = {
    new: { variant: "new", label: "New" },
    inprogress: { variant: "inprogress", label: "In Progress" },
    onhold: { variant: "onhold", label: "On Hold" },
    completed: { variant: "completed", label: "Completed" },
    cancelled: { variant: "cancelled", label: "Cancelled" },
  }

  const config = statusMap[status] || { variant: "default", label: status }

  return (
    <EnhancedStatusBadge 
      variant={config.variant} 
      pulse={config.pulse}
      animated
    >
      {config.label}
    </EnhancedStatusBadge>
  )
}

const DeliveryStatusBadge = ({ status }: { status: string }) => {
  const statusMap: Record<string, { variant: any; label: string; pulse?: boolean }> = {
    ordered: { variant: "ordered", label: "Ordered" },
    processing: { variant: "processing", label: "Processing" },
    shipped: { variant: "shipped", label: "Shipped" },
    intransit: { variant: "intransit", label: "In Transit" },
    delivered: { variant: "delivered", label: "Delivered" },
  }

  const config = statusMap[status] || { variant: "default", label: status }

  return (
    <EnhancedStatusBadge 
      variant={config.variant} 
      pulse={config.pulse}
      animated
    >
      {config.label}
    </EnhancedStatusBadge>
  )
}

const FinancialBadge = ({ amount, type }: { amount: number; type?: "profit" | "loss" | "auto" }) => {
  const isPositive = amount >= 0
  const finalType = type === "auto" ? (isPositive ? "profit" : "loss") : type
  const variant = finalType || (isPositive ? "profit" : "loss")

  return (
    <EnhancedStatusBadge variant={variant} animated>
      <DollarSign className="w-3 h-3" />
      {Math.abs(amount).toLocaleString()}
    </EnhancedStatusBadge>
  )
}

export { 
  EnhancedStatusBadge, 
  TaskStatusBadge, 
  DeliveryStatusBadge, 
  FinancialBadge,
  enhancedStatusBadgeVariants 
}