import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { ChevronRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const enhancedButtonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90 transition-colors",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors",
        outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground transition-colors",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors",
        ghost: "hover:bg-accent hover:text-accent-foreground transition-colors",
        link: "text-primary underline-offset-4 hover:underline transition-colors",
        glow: "bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg transition-colors",
        navigation: "bg-background border border-input hover:bg-accent hover-chevron transition-colors",
      },
      size: {
        default: "h-12 px-6 py-2.5",
        sm: "h-10 rounded-md px-4",
        lg: "h-14 rounded-md px-8",
        icon: "h-12 w-12",
      },
      iconPosition: {
        left: "",
        right: "flex-row-reverse",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
      iconPosition: "left",
    },
  }
);

export interface EnhancedButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
  VariantProps<typeof enhancedButtonVariants> {
  asChild?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  showChevron?: boolean;
}

const EnhancedButton = React.forwardRef<HTMLButtonElement, EnhancedButtonProps>(
  ({
    className,
    variant,
    size,
    iconPosition,
    asChild = false,
    loading = false,
    icon,
    showChevron = false,
    children,
    ...props
  }, ref) => {
    const Comp = asChild ? Slot : "button";

    return (
      <Comp
        className={cn(enhancedButtonVariants({ variant, size, iconPosition, className }))}
        ref={ref}
        disabled={loading || props.disabled}
        {...props}
      >
        {loading && <Loader2 className="animate-spin" />}
        {!loading && icon && iconPosition === "left" && icon}
        {children}
        {!loading && icon && iconPosition === "right" && icon}
        {!loading && showChevron && variant === "navigation" && (
          <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
        )}
      </Comp>
    );
  }
);

EnhancedButton.displayName = "EnhancedButton";

export { EnhancedButton, enhancedButtonVariants };