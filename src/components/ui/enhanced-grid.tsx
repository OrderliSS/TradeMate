import React from "react";
import { cn } from "@/lib/utils";
import { useStaggeredAnimation } from "@/hooks/useStaggeredAnimation";
import { navigateWithEnvironment } from "@/lib/environment-url-helper";

/**
 * Enhanced Grid Components with Animation Support
 */

interface EnhancedGridProps {
  children: React.ReactNode;
  columns?: number | "auto";
  gap?: "sm" | "md" | "lg";
  staggered?: boolean;
  staggerDelay?: number;
  className?: string;
  role?: string;
  "aria-label"?: string;
}

export const EnhancedGrid = ({
  children,
  columns = "auto",
  gap = "md",
  staggered = false,
  staggerDelay = 50,
  className,
  role,
  "aria-label": ariaLabel,
}: EnhancedGridProps) => {
  const childrenArray = React.Children.toArray(children);
  const { getStaggerClass } = useStaggeredAnimation(
    childrenArray.length,
    staggerDelay
  );

  const gridClasses = cn(
    "grid",
    {
      "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4": columns === "auto",
      "grid-cols-1": columns === 1,
      "grid-cols-2": columns === 2,
      "grid-cols-3": columns === 3,
      "grid-cols-4": columns === 4,
      "grid-cols-5": columns === 5,
      "grid-cols-6": columns === 6,
    },
    {
      "gap-2": gap === "sm",
      "gap-4": gap === "md", 
      "gap-6": gap === "lg",
    },
    staggered && "grid-stagger",
    className
  );

  return (
    <div className={gridClasses} role={role} aria-label={ariaLabel}>
      {childrenArray.map((child, index) => (
        <div
          key={index}
          className={cn(
            "gpu-accelerated",
            staggered && getStaggerClass(index)
          )}
        >
          {child}
        </div>
      ))}
    </div>
  );
};

interface EnhancedListProps {
  children: React.ReactNode;
  staggered?: boolean;
  staggerDelay?: number;
  className?: string;
  role?: string;
  "aria-label"?: string;
}

export const EnhancedList = ({
  children,
  staggered = false,
  staggerDelay = 50,
  className,
  role = "list",
  "aria-label": ariaLabel,
}: EnhancedListProps) => {
  const childrenArray = React.Children.toArray(children);
  const { getStaggerClass } = useStaggeredAnimation(
    childrenArray.length,
    staggerDelay
  );

  return (
    <div 
      className={cn("space-y-4 gpu-accelerated", className)} 
      role={role} 
      aria-label={ariaLabel}
    >
      {childrenArray.map((child, index) => (
        <div
          key={index}
          className={cn(
            "gpu-accelerated",
            staggered && getStaggerClass(index)
          )}
          role="listitem"
        >
          {child}
        </div>
      ))}
    </div>
  );
};

interface GridItemProps {
  children: React.ReactNode;
  featured?: boolean;
  interactive?: boolean;
  className?: string;
  onClick?: () => void;
  href?: string;
  "aria-label"?: string;
}

export const GridItem = ({
  children,
  featured = false,
  interactive = false,
  className,
  onClick,
  href,
  "aria-label": ariaLabel,
}: GridItemProps) => {
  const isClickable = !!(onClick || href);
  
  const handleClick = () => {
    if (href) {
      navigateWithEnvironment(href);
    }
    onClick?.();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  };

  return (
    <div
      className={cn(
        "transition-all duration-300 gpu-accelerated",
        featured && "hover-glow",
        interactive && "hover-lift interactive-glow cursor-pointer focus-glow",
        isClickable && "focus:outline-none",
        className
      )}
      onClick={isClickable ? handleClick : undefined}
      onKeyDown={isClickable ? handleKeyDown : undefined}
      tabIndex={isClickable ? 0 : undefined}
      role={isClickable ? "button" : undefined}
      aria-label={ariaLabel}
    >
      {children}
    </div>
  );
};

// Specialized grid layouts
export const MetricsGrid = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <EnhancedGrid
    columns="auto"
    gap="lg"
    staggered
    className={cn("grid-cols-1 md:grid-cols-2 lg:grid-cols-4", className)}
    role="region"
    aria-label="Metrics dashboard"
  >
    {children}
  </EnhancedGrid>
);

export const CardGrid = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <EnhancedGrid
    columns="auto"
    gap="md"
    staggered
    className={cn("grid-cols-1 md:grid-cols-2 lg:grid-cols-3", className)}
    role="region"
    aria-label="Content grid"
  >
    {children}
  </EnhancedGrid>
);

export const ProductGrid = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <EnhancedGrid
    columns="auto"
    gap="lg"
    staggered
    className={cn("grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5", className)}
    role="region"
    aria-label="Products grid"
  >
    {children}
  </EnhancedGrid>
);