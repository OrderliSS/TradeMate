import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/**
 * Premium Card System
 * - Refined shadows for depth without heaviness
 * - Subtle hover states for interactivity
 * - Consistent corner radius system
 */
const cardVariants = cva(
  "rounded-[var(--radius-lg)] border border-border/60 bg-card text-card-foreground transition-all duration-200 ease-out",
  {
    variants: {
      variant: {
        default: "shadow-[var(--shadow-card)]",
        interactive: "shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-card-hover)] hover:border-border active:scale-[0.995] cursor-pointer",
        elevated: "shadow-[var(--shadow-elegant)] border-border/40",
        premium: "shadow-[var(--shadow-premium)] bg-gradient-to-br from-card via-card to-muted/10 border-border/30",
        glass: "bg-card/90 backdrop-blur-md border-white/30 shadow-[var(--shadow-card)]",
        featured: "shadow-[var(--shadow-elegant)] border-primary/15 bg-gradient-to-br from-primary/[0.02] to-accent/[0.02]",
        subtle: "shadow-[var(--shadow-xs)] border-border/40 hover:shadow-[var(--shadow-sm)] hover:border-border/60",
      },
      size: {
        default: "",
        compact: "p-4",
        spacious: "p-8",
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant, size, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(cardVariants({ variant, size, className }))}
      {...props}
    />
  )
)
Card.displayName = "Card"

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5 p-5 pb-4", className)}
    {...props}
  />
))
CardHeader.displayName = "CardHeader"

const CardTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn(
      "text-lg font-semibold leading-tight tracking-tight text-foreground",
      className
    )}
    {...props}
  />
))
CardTitle.displayName = "CardTitle"

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm text-muted-foreground leading-relaxed", className)}
    {...props}
  />
))
CardDescription.displayName = "CardDescription"

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-5 pt-0", className)} {...props} />
))
CardContent.displayName = "CardContent"

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center p-5 pt-0", className)}
    {...props}
  />
))
CardFooter.displayName = "CardFooter"

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent, cardVariants }
