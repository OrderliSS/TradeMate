import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Copy, Check, ExternalLink, TrendingUp, TrendingDown, Minus } from "lucide-react"

/**
 * Premium Metric Card System
 * - Refined shadows and borders
 * - Clear visual hierarchy
 * - Subtle hover states for interactive cards
 */
const metricCardVariants = cva(
  "relative overflow-hidden rounded-[var(--radius-lg)] border border-border/60 bg-card text-card-foreground shadow-[var(--shadow-card)] transition-all duration-200 ease-out",
  {
    variants: {
      variant: {
        default: "",
        gradient: "bg-gradient-to-br from-primary/[0.03] to-accent/[0.03] border-primary/15",
        success: "border-success/20 bg-success/[0.03]",
        warning: "border-warning/20 bg-warning/[0.03]",
        danger: "border-destructive/20 bg-destructive/[0.03]",
        info: "border-primary/20 bg-primary/[0.03]",
      },
      size: {
        default: "p-5",
        sm: "p-4",
        lg: "p-6",
      },
      interactive: {
        true: "cursor-pointer hover:shadow-[var(--shadow-card-hover)] hover:border-border active:scale-[0.995]",
        false: "",
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default",
      interactive: false,
    },
  }
)

const trendIndicatorVariants = cva(
  "inline-flex items-center gap-1 text-xs font-medium rounded-full px-2 py-0.5",
  {
    variants: {
      trend: {
        up: "text-success bg-success/10",
        down: "text-destructive bg-destructive/10",
        neutral: "text-muted-foreground bg-muted/50",
      }
    },
    defaultVariants: {
      trend: "neutral",
    },
  }
)

export interface MetricCardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof metricCardVariants> {
  title: string
  value: string | number
  description?: string
  icon?: React.ReactNode
  trend?: {
    value: number
    label?: string
  }
  badge?: string
}

export interface CopyableTextProps
  extends React.HTMLAttributes<HTMLDivElement> {
  text: string
  displayText?: string
  variant?: "default" | "minimal" | "badge"
}

export interface TrendIndicatorProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof trendIndicatorVariants> {
  value: number
  label?: string
  showIcon?: boolean
}

export interface StatisticDisplayProps
  extends React.HTMLAttributes<HTMLDivElement> {
  label: string
  value: string | number
  change?: {
    value: number
    period: string
  }
  format?: "number" | "currency" | "percentage"
  loading?: boolean
}

const MetricCard = React.forwardRef<HTMLDivElement, MetricCardProps>(
  ({ className, variant, size, interactive, title, value, description, icon, trend, badge, onClick, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(metricCardVariants({ variant, size, interactive, className }))}
        onClick={onClick}
        {...props}
      >
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <p className={cn(
                "text-sm font-medium",
                variant === "gradient" ? "text-foreground" : "text-muted-foreground"
              )}>{title}</p>
              {badge && (
                <Badge variant="secondary" className="text-xs">
                  {badge}
                </Badge>
              )}
            </div>
            <p className={cn(
              "text-2xl font-bold",
              variant === "gradient" ? "text-foreground" : ""
            )}>{value}</p>
            {description && (
              <p className={cn(
                "text-xs",
                variant === "gradient" ? "text-foreground/80" : "text-muted-foreground"
              )}>{description}</p>
            )}
            {trend && (
              <TrendIndicator 
                value={trend.value} 
                label={trend.label}
                showIcon
              />
            )}
          </div>
          {icon && (
            <div className={cn(
              "flex-shrink-0",
              variant === "gradient" ? "text-foreground/70" : "text-muted-foreground"
            )}>
              {icon}
            </div>
          )}
        </div>
      </div>
    )
  }
)
MetricCard.displayName = "MetricCard"

const CopyableText = React.forwardRef<HTMLDivElement, CopyableTextProps>(
  ({ className, text, displayText, variant = "default", ...props }, ref) => {
    const [copied, setCopied] = React.useState(false)

    const handleCopy = async (e: React.MouseEvent) => {
      e.stopPropagation()
      try {
        await navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      } catch (err) {
        console.error('Failed to copy:', err)
      }
    }

    if (variant === "minimal") {
      return (
        <div
          ref={ref}
          className={cn("inline-flex items-center gap-1 group", className)}
          {...props}
        >
          <span className="font-mono text-sm">{displayText || text}</span>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleCopy}
            className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            {copied ? (
              <Check className="h-3 w-3 text-success" />
            ) : (
              <Copy className="h-3 w-3" />
            )}
          </Button>
        </div>
      )
    }

    if (variant === "badge") {
      return (
        <Badge
          variant="outline"
          className={cn("cursor-pointer hover:bg-accent font-mono", className)}
          onClick={handleCopy}
          {...props}
        >
          {displayText || text}
          {copied ? (
            <Check className="h-3 w-3 ml-1 text-success" />
          ) : (
            <Copy className="h-3 w-3 ml-1" />
          )}
        </Badge>
      )
    }

    return (
      <div
        ref={ref}
        className={cn(
          "flex items-center gap-2 p-2 rounded-md border bg-muted/50 hover:bg-muted transition-colors cursor-pointer group",
          className
        )}
        onClick={handleCopy}
        {...props}
      >
        <span className="font-mono text-sm flex-1">{displayText || text}</span>
        {copied ? (
          <Check className="h-4 w-4 text-success" />
        ) : (
          <Copy className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
        )}
      </div>
    )
  }
)
CopyableText.displayName = "CopyableText"

const TrendIndicator = React.forwardRef<HTMLDivElement, TrendIndicatorProps>(
  ({ className, trend, value, label, showIcon = true, ...props }, ref) => {
    const trendType = value > 0 ? 'up' : value < 0 ? 'down' : 'neutral'
    const displayValue = Math.abs(value)
    
    const TrendIcon = trendType === 'up' ? TrendingUp : trendType === 'down' ? TrendingDown : Minus

    return (
      <div
        ref={ref}
        className={cn(trendIndicatorVariants({ trend: trendType, className }))}
        {...props}
      >
        {showIcon && <TrendIcon className="h-3 w-3" />}
        <span>
          {trendType !== 'neutral' && (trendType === 'up' ? '+' : '-')}
          {displayValue}%
        </span>
        {label && <span className="text-muted-foreground">• {label}</span>}
      </div>
    )
  }
)
TrendIndicator.displayName = "TrendIndicator"

const StatisticDisplay = React.forwardRef<HTMLDivElement, StatisticDisplayProps>(
  ({ className, label, value, change, format = "number", loading, ...props }, ref) => {
    const formatValue = (val: string | number) => {
      if (loading) return "..."
      
      const numVal = typeof val === 'string' ? parseFloat(val) : val
      
      switch (format) {
        case "currency":
          return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
          }).format(numVal)
        case "percentage":
          return `${numVal}%`
        case "number":
        default:
          return numVal.toLocaleString()
      }
    }

    return (
      <div
        ref={ref}
        className={cn("space-y-1", className)}
        {...props}
      >
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <div className="flex items-end gap-2">
          <p className="text-2xl font-bold">{formatValue(value)}</p>
          {change && (
            <div className="flex items-center gap-1 mb-1">
              <TrendIndicator 
                value={change.value} 
                label={change.period}
                showIcon
                className="text-xs"
              />
            </div>
          )}
        </div>
      </div>
    )
  }
)
StatisticDisplay.displayName = "StatisticDisplay"

export {
  MetricCard,
  CopyableText,
  TrendIndicator,
  StatisticDisplay,
  metricCardVariants,
  trendIndicatorVariants,
}