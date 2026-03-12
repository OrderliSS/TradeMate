import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { EnhancedTooltip } from "./enhanced-tooltip";

const interactiveIconVariants = cva(
  "inline-flex items-center justify-center transition-all duration-200",
  {
    variants: {
      variant: {
        default: "interactive-icon text-muted-foreground hover:text-foreground",
        accent: "interactive-icon text-accent hover:text-accent-foreground",
        destructive: "interactive-icon text-destructive hover:text-destructive-foreground",
        success: "interactive-icon text-success hover:text-success-text",
        warning: "interactive-icon text-warning hover:text-warning-text",
        navigation: "interactive-icon text-muted-foreground hover:text-accent hover-chevron cursor-pointer",
        financial: "interactive-icon text-financial-profit hover:text-financial-profit-text",
        glow: "interactive-glow text-accent hover:text-accent-foreground",
      },
      size: {
        xs: "h-3 w-3",
        sm: "h-4 w-4",
        md: "h-5 w-5",
        lg: "h-6 w-6",
        xl: "h-8 w-8",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  }
);

export interface InteractiveIconProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof interactiveIconVariants> {
  children: React.ReactNode;
  tooltip?: string;
  disabled?: boolean;
  href?: string;
}

const InteractiveIcon = React.forwardRef<HTMLDivElement, InteractiveIconProps>(
  ({ className, variant, size, children, tooltip, disabled, href, onClick, ...props }, ref) => {
    const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
      if (disabled) return;
      
      if (href) {
        window.open(href, '_blank', 'noopener noreferrer');
      }
      onClick?.(e);
    };

    const iconElement = (
      <div
        ref={ref}
        className={cn(
          interactiveIconVariants({ variant, size }),
          disabled && "opacity-50 cursor-not-allowed pointer-events-none",
          (onClick || href) && "cursor-pointer",
          className
        )}
        onClick={handleClick}
        {...props}
      >
        {children}
      </div>
    );

    if (tooltip) {
      return (
        <EnhancedTooltip content={tooltip} disabled={disabled}>
          {iconElement}
        </EnhancedTooltip>
      );
    }

    return iconElement;
  }
);

InteractiveIcon.displayName = "InteractiveIcon";

export { InteractiveIcon, interactiveIconVariants };