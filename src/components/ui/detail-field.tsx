import * as React from "react";
import { cn } from "@/lib/utils";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import { LucideIcon } from "lucide-react";

export interface DetailFieldProps {
  label: string;
  value: React.ReactNode;
  icon?: LucideIcon;
  className?: string;
  labelClassName?: string;
  valueClassName?: string;
  /** If true, always stack vertically regardless of screen size */
  alwaysStack?: boolean;
}

/**
 * A consistent label-value display component for detail pages.
 * Automatically handles responsive layout: stacks on mobile, inline on larger screens.
 */
export const DetailField = ({
  label,
  value,
  icon: Icon,
  className,
  labelClassName,
  valueClassName,
  alwaysStack = false,
}: DetailFieldProps) => {
  const layout = useResponsiveLayout();
  const shouldStack = alwaysStack || layout.isMobile;

  return (
    <div
      className={cn(
        "flex items-center flex-wrap",
        shouldStack ? "flex-col items-start gap-0.5" : "gap-2",
        className
      )}
    >
      <div className={cn("flex items-center gap-1.5", labelClassName)}>
        {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
        <span className="text-sm text-muted-foreground">{label}:</span>
      </div>
      <span className={cn("text-sm font-medium", valueClassName)}>{value}</span>
    </div>
  );
};

export interface DetailSectionProps {
  title?: string;
  icon?: LucideIcon;
  children: React.ReactNode;
  className?: string;
  /** Spacing between items: 'tight' = space-y-1.5, 'normal' = space-y-2, 'loose' = space-y-3 */
  spacing?: 'tight' | 'normal' | 'loose';
}

/**
 * A consistent section wrapper for grouping detail fields.
 */
export const DetailSection = ({
  title,
  icon: Icon,
  children,
  className,
  spacing = 'normal',
}: DetailSectionProps) => {
  const spacingClass = {
    tight: 'space-y-1.5',
    normal: 'space-y-2',
    loose: 'space-y-3',
  }[spacing];

  return (
    <div className={cn(spacingClass, className)}>
      {title && (
        <h4 className="font-medium mb-2 flex items-center gap-2">
          {Icon && (
            <div className="p-1.5 rounded-md bg-muted">
              <Icon className="h-4 w-4 text-muted-foreground" />
            </div>
          )}
          {title}
        </h4>
      )}
      {children}
    </div>
  );
};
