import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { TrendingUp, TrendingDown, Minus, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ComponentType<{ className?: string }>;
  trend?: {
    value: number;
    direction: "up" | "down" | "neutral";
    label?: string;
  };
  progress?: {
    value: number;
    max?: number;
    color?: "default" | "primary" | "secondary" | "destructive" | "warning" | "success";
  };
  variant?: "default" | "compact" | "detailed";
  className?: string;
  children?: React.ReactNode;
}

export const MetricCard = ({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  progress,
  variant = "default",
  className,
  children
}: MetricCardProps) => {
  const getTrendIcon = () => {
    switch (trend?.direction) {
      case "up": return ArrowUpRight;
      case "down": return ArrowDownRight;
      default: return Minus;
    }
  };

  const getTrendColor = () => {
    switch (trend?.direction) {
      case "up": return "text-green-600";
      case "down": return "text-red-600";
      default: return "text-muted-foreground";
    }
  };

  const TrendIcon = trend ? getTrendIcon() : null;

  if (variant === "compact") {
    return (
      <div className={cn("flex items-center justify-between p-3 rounded-lg border bg-card", className)}>
        <div className="flex items-center gap-2">
          {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
          <span className="text-sm font-medium">{title}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold">{value}</span>
          {trend && TrendIcon && (
            <div className={cn("flex items-center gap-1 text-xs", getTrendColor())}>
              <TrendIcon className="h-3 w-3" />
              <span>{Math.abs(trend.value)}%</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            {Icon && <Icon className="h-4 w-4" />}
            {title}
          </CardTitle>
          {trend && TrendIcon && (
            <div className={cn("flex items-center gap-1 text-xs", getTrendColor())}>
              <TrendIcon className="h-3 w-3" />
              <span>{Math.abs(trend.value)}%</span>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="text-2xl font-bold">{value}</div>
          
          {subtitle && (
            <div className="text-xs text-muted-foreground">{subtitle}</div>
          )}
          
          {progress && (
            <div className="space-y-1">
              <Progress 
                value={(progress.value / (progress.max || 100)) * 100} 
                className="h-2"
              />
              <div className="text-xs text-muted-foreground">
                {progress.value} / {progress.max || 100}
              </div>
            </div>
          )}
          
          {trend?.label && (
            <div className={cn("text-xs", getTrendColor())}>
              {trend.label}
            </div>
          )}
          
          {children}
        </div>
      </CardContent>
    </Card>
  );
};

interface MetricsGridProps {
  metrics: Array<Omit<MetricCardProps, "className">>;
  columns?: 2 | 3 | 4 | 6;
  className?: string;
}

export const MetricsGrid = ({ 
  metrics, 
  columns = 4, 
  className 
}: MetricsGridProps) => {
  const getGridCols = () => {
    switch (columns) {
      case 2: return "grid-cols-1 md:grid-cols-2";
      case 3: return "grid-cols-1 md:grid-cols-2 lg:grid-cols-3";
      case 4: return "grid-cols-1 md:grid-cols-2 lg:grid-cols-4";
      case 6: return "grid-cols-2 md:grid-cols-3 lg:grid-cols-6";
      default: return "grid-cols-1 md:grid-cols-2 lg:grid-cols-4";
    }
  };

  return (
    <div className={cn("grid gap-4", getGridCols(), className)}>
      {metrics.map((metric, index) => (
        <MetricCard key={index} {...metric} />
      ))}
    </div>
  );
};

interface MetricsSummaryProps {
  title: string;
  description?: string;
  metrics: Array<{
    label: string;
    value: string | number;
    change?: {
      value: number;
      direction: "up" | "down" | "neutral";
    };
  }>;
  className?: string;
}

export const MetricsSummary = ({
  title,
  description,
  metrics,
  className
}: MetricsSummaryProps) => {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        {description && (
          <div className="text-sm text-muted-foreground">{description}</div>
        )}
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {metrics.map((metric, index) => (
            <div key={index}>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{metric.label}</span>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{metric.value}</span>
                  {metric.change && (
                    <Badge 
                      variant={
                        metric.change.direction === "up" 
                          ? "default" 
                          : metric.change.direction === "down" 
                            ? "destructive" 
                            : "secondary"
                      }
                      className="text-xs"
                    >
                      {metric.change.direction === "up" ? "+" : ""}
                      {metric.change.value}%
                    </Badge>
                  )}
                </div>
              </div>
              {index < metrics.length - 1 && <Separator className="mt-3" />}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};