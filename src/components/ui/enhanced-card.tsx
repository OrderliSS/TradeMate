import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { ChevronRight, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { navigateWithEnvironment } from "@/lib/environment-url-helper";

/**
 * Enhanced Card System
 * - Premium feel with refined shadows
 * - Subtle hover states
 * - Consistent spacing
 */
const enhancedCardVariants = cva(
  "rounded-[var(--radius-lg)] border border-border/60 bg-card text-card-foreground shadow-[var(--shadow-card)] transition-all duration-200 ease-out",
  {
    variants: {
      variant: {
        default: "",
        interactive: "cursor-pointer hover:shadow-[var(--shadow-card-hover)] hover:border-border active:scale-[0.995] group",
        navigation: "cursor-pointer hover:shadow-[var(--shadow-card-hover)] hover:border-border active:scale-[0.995] group",
        featured: "border-primary/15 bg-gradient-to-br from-primary/[0.02] to-accent/[0.02] shadow-[var(--shadow-elegant)]",
        orderli: "orderli-card",
      },
      size: {
        default: "p-5",
        sm: "p-4",
        lg: "p-6",
        orderli: "p-3",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface EnhancedCardProps
  extends React.HTMLAttributes<HTMLDivElement>,
  VariantProps<typeof enhancedCardVariants> {
  showChevron?: boolean;
  href?: string;
  onSettingsClick?: (e: React.MouseEvent) => void;
}

const EnhancedCard = React.forwardRef<HTMLDivElement, EnhancedCardProps>(
  ({ className, variant, size, showChevron = false, href, onSettingsClick, children, onClick, ...props }, ref) => {
    const isClickable = !!(onClick || href);

    const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
      if (href) {
        navigateWithEnvironment(href);
      }
      onClick?.(e);
    };

    return (
      <div
        ref={ref}
        className={cn(
          enhancedCardVariants({
            variant: variant || (isClickable ? "interactive" : "default"),
            size
          }),
          className
        )}
        onClick={isClickable ? handleClick : undefined}
        {...props}
      >
        <div className="relative h-full flex flex-col">
          {children}
          {showChevron && isClickable && (
            <ChevronRight className="absolute top-1/2 -translate-y-1/2 right-0 h-4 w-4 text-muted-foreground/60 transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-muted-foreground" />
          )}
        </div>
      </div>
    );
  }
);

EnhancedCard.displayName = "EnhancedCard";

const EnhancedCardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { onSettingsClick?: (e: React.MouseEvent) => void }
>(({ className, onSettingsClick, children, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1 mb-3", className)}
    {...props}
  >
    <div className="flex items-center justify-between w-full">
      <div className="flex flex-col space-y-1 flex-1">
        {children}
      </div>
      {onSettingsClick && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onSettingsClick(e);
          }}
          className="p-1 hover:bg-slate-100 rounded-md transition-colors group/cog"
        >
          <Settings className="w-3.5 h-3.5 text-slate-400 group-hover/cog:text-[#2563EB] transition-colors" />
        </button>
      )}
    </div>
  </div>
));
EnhancedCardHeader.displayName = "EnhancedCardHeader";

const EnhancedCardTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn("text-lg font-semibold leading-tight tracking-tight", className)}
    {...props}
  />
));
EnhancedCardTitle.displayName = "EnhancedCardTitle";

const EnhancedCardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm text-muted-foreground leading-relaxed", className)}
    {...props}
  />
));
EnhancedCardDescription.displayName = "EnhancedCardDescription";

const EnhancedCardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("pt-3", className)} {...props} />
));
EnhancedCardContent.displayName = "EnhancedCardContent";

const EnhancedCardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center pt-4", className)}
    {...props}
  />
));
EnhancedCardFooter.displayName = "EnhancedCardFooter";

export {
  EnhancedCard,
  EnhancedCardHeader,
  EnhancedCardFooter,
  EnhancedCardTitle,
  EnhancedCardDescription,
  EnhancedCardContent,
  enhancedCardVariants
};