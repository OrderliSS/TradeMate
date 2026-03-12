import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/**
 * Premium Button System
 * - Calm, intentional hover states
 * - Consistent height and padding
 * - Subtle shadows for depth
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius)] text-sm font-medium ring-offset-background transition-all duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-[var(--shadow-sm)] hover:bg-primary/92 hover:shadow-[var(--shadow-card)] active:scale-[0.98]",
        destructive:
          "bg-destructive text-destructive-foreground shadow-[var(--shadow-sm)] hover:bg-destructive/92 hover:shadow-[var(--shadow-card)] active:scale-[0.98]",
        outline:
          "border border-input bg-background hover:bg-muted/60 hover:border-border active:scale-[0.98]",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/70 active:scale-[0.98]",
        ghost: "hover:bg-muted/80 hover:text-foreground active:bg-muted",
        link: "text-primary underline-offset-4 hover:underline",
        premium: "bg-gradient-to-r from-primary to-accent text-primary-foreground shadow-[var(--shadow-elegant)] hover:shadow-[var(--shadow-premium)] hover:brightness-105 active:scale-[0.98]",
        glow: "bg-primary text-primary-foreground shadow-[var(--shadow-glow)] hover:shadow-[var(--shadow-premium)] active:scale-[0.98]",
        success: "bg-success/90 text-white hover:bg-success shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-card)] active:scale-[0.98]",
        warning: "bg-warning/90 text-white hover:bg-warning shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-card)] active:scale-[0.98]",
      },
      size: {
        default: "h-12 px-6 py-2.5 text-base font-medium",
        sm: "h-10 rounded-[var(--radius-sm)] px-4 text-sm",
        lg: "h-14 rounded-[var(--radius-lg)] px-8 text-lg font-bold",
        xl: "h-16 rounded-[var(--radius-xl)] px-10 text-xl font-bold",
        icon: "h-12 w-12",
        "icon-sm": "h-10 w-10 rounded-[var(--radius-sm)]",
        "icon-lg": "h-14 w-14",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
  VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
