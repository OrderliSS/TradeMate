import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { ChevronRight, Home } from "lucide-react"
import { Link } from "react-router-dom"

const breadcrumbVariants = cva(
  "flex items-center space-x-1 text-sm text-muted-foreground",
  {
    variants: {
      variant: {
        default: "",
        compact: "text-xs",
        spacious: "text-base space-x-2",
      }
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

const breadcrumbItemVariants = cva(
  "flex items-center transition-colors duration-200",
  {
    variants: {
      state: {
        default: "hover:text-foreground",
        current: "text-foreground font-medium",
        disabled: "text-muted-foreground/50 cursor-not-allowed",
      }
    },
    defaultVariants: {
      state: "default",
    },
  }
)

export interface BreadcrumbItem {
  label: string
  href?: string
  current?: boolean
  disabled?: boolean
}

export interface EnhancedBreadcrumbProps
  extends React.HTMLAttributes<HTMLElement>,
    VariantProps<typeof breadcrumbVariants> {
  items: BreadcrumbItem[]
  separator?: React.ReactNode
  showHome?: boolean
}

export interface NavigationButtonProps
  extends React.ComponentProps<typeof Button> {
  icon?: React.ReactNode
  badge?: string | number
  pulse?: boolean
}

const EnhancedBreadcrumb = React.forwardRef<HTMLElement, EnhancedBreadcrumbProps>(
  ({ className, variant, items, separator = <ChevronRight className="h-4 w-4" />, showHome = true, ...props }, ref) => {
    return (
      <nav
        ref={ref}
        aria-label="Breadcrumb"
        className={cn(breadcrumbVariants({ variant, className }))}
        {...props}
      >
        <ol className="flex items-center space-x-1">
          {showHome && (
            <>
              <li>
                <Link to="/" className={cn(breadcrumbItemVariants({ state: "default" }))}>
                  <Home className="h-4 w-4" />
                  <span className="sr-only">Home</span>
                </Link>
              </li>
              {items.length > 0 && (
                <li className="flex items-center">
                  {separator}
                </li>
              )}
            </>
          )}
          {items.map((item, index) => {
            const isLast = index === items.length - 1
            const state = item.current || isLast ? 'current' : item.disabled ? 'disabled' : 'default'

            return (
              <React.Fragment key={index}>
                <li>
                  {item.href && state !== 'disabled' && !item.current ? (
                    <Link
                      to={item.href}
                      className={cn(breadcrumbItemVariants({ state }))}
                    >
                      {item.label}
                    </Link>
                  ) : (
                    <span
                      className={cn(breadcrumbItemVariants({ state }))}
                      aria-current={item.current || isLast ? "page" : undefined}
                    >
                      {item.label}
                    </span>
                  )}
                </li>
                {!isLast && (
                  <li className="flex items-center">
                    {separator}
                  </li>
                )}
              </React.Fragment>
            )
          })}
        </ol>
      </nav>
    )
  }
)
EnhancedBreadcrumb.displayName = "EnhancedBreadcrumb"

const NavigationButton = React.forwardRef<HTMLButtonElement, NavigationButtonProps>(
  ({ className, icon, badge, pulse, children, ...props }, ref) => {
    return (
      <Button
        ref={ref}
        className={cn(
          "relative interactive-scale",
          pulse && "animate-pulse",
          className
        )}
        {...props}
      >
        <div className="flex items-center gap-2">
          {icon && <span className="flex-shrink-0">{icon}</span>}
          {children}
        </div>
        {badge && (
          <span className="absolute -top-2 -right-2 h-5 w-5 bg-destructive text-destructive-foreground text-xs rounded-full flex items-center justify-center animate-scale-in">
            {badge}
          </span>
        )}
      </Button>
    )
  }
)
NavigationButton.displayName = "NavigationButton"

export {
  EnhancedBreadcrumb,
  NavigationButton,
  breadcrumbVariants,
  breadcrumbItemVariants,
}