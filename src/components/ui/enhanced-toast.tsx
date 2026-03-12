import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Info, 
  X,
  Loader2
} from "lucide-react"

import { cn } from "@/lib/utils"
import { toast as sonnerToast, Toaster } from "sonner"

const enhancedToastVariants = cva(
  "group pointer-events-auto relative flex w-full items-center justify-between space-x-4 overflow-hidden rounded-md border p-6 pr-8 shadow-lg transition-all data-[swipe=cancel]:translate-x-0 data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)] data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[swipe=move]:transition-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[swipe=end]:animate-out data-[state=closed]:fade-out-80 data-[state=closed]:slide-out-to-right-full data-[state=open]:slide-in-from-top-full data-[state=open]:sm:slide-in-from-bottom-full",
  {
    variants: {
      variant: {
        default: "border bg-background text-foreground",
        success: "border-success-border bg-success-bg text-success-text",
        error: "border-danger-border bg-danger-bg text-danger-text",
        warning: "border-warning-border bg-warning-bg text-warning-text",
        info: "border-info-border bg-info-bg text-info-text",
        loading: "border-primary/20 bg-primary/5 text-primary",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

const toastIcons = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
  loading: Loader2,
}

interface EnhancedToastOptions {
  title?: string
  description?: string
  variant?: "default" | "success" | "error" | "warning" | "info" | "loading"
  action?: {
    label: string
    onClick: () => void
  }
  duration?: number
  showIcon?: boolean
  /** If true, this toast will be persisted to the notification center */
  persist?: boolean
}

const enhancedToast = (options: EnhancedToastOptions | string) => {
  if (typeof options === "string") {
    return sonnerToast(options)
  }

  const { 
    title, 
    description, 
    variant = "default", 
    action, 
    duration,
    showIcon = true 
  } = options

  const IconComponent = toastIcons[variant as keyof typeof toastIcons]
  const isLoading = variant === "loading"

  return sonnerToast(
    <div className="flex items-start gap-3">
      {showIcon && IconComponent && (
        <IconComponent 
          className={cn(
            "w-5 h-5 mt-0.5 flex-shrink-0",
            isLoading && "animate-spin",
            variant === "success" && "text-success",
            variant === "error" && "text-danger",
            variant === "warning" && "text-warning",
            variant === "info" && "text-info",
            variant === "loading" && "text-primary"
          )} 
        />
      )}
      <div className="flex-1 space-y-1">
        {title && (
          <div className="font-semibold text-sm">{title}</div>
        )}
        {description && (
          <div className="text-sm opacity-90">{description}</div>
        )}
      </div>
    </div>,
    {
      duration: duration || (variant === "loading" ? Infinity : 4000),
      className: cn(
        enhancedToastVariants({ variant }),
        "border-l-4",
        variant === "success" && "border-l-success",
        variant === "error" && "border-l-danger", 
        variant === "warning" && "border-l-warning",
        variant === "info" && "border-l-info",
        variant === "loading" && "border-l-primary"
      ),
      action: action ? {
        label: action.label,
        onClick: action.onClick,
      } : undefined,
    }
  )
}

// Convenience methods
enhancedToast.success = (title: string, description?: string, options?: Partial<EnhancedToastOptions>) => 
  enhancedToast({ ...options, title, description, variant: "success" })

enhancedToast.error = (title: string, description?: string, options?: Partial<EnhancedToastOptions>) => 
  enhancedToast({ ...options, title, description, variant: "error" })

enhancedToast.warning = (title: string, description?: string, options?: Partial<EnhancedToastOptions>) => 
  enhancedToast({ ...options, title, description, variant: "warning" })

enhancedToast.info = (title: string, description?: string, options?: Partial<EnhancedToastOptions>) => 
  enhancedToast({ ...options, title, description, variant: "info" })

enhancedToast.loading = (title: string, description?: string, options?: Partial<EnhancedToastOptions>) => 
  enhancedToast({ ...options, title, description, variant: "loading" })

enhancedToast.promise = <T,>(
  promise: Promise<T>,
  {
    loading,
    success,
    error,
  }: {
    loading: string
    success: string | ((data: T) => string)
    error: string | ((error: any) => string)
  }
) => {
  return sonnerToast.promise(promise, {
    loading: (
      <div className="flex items-center gap-3">
        <Loader2 className="w-4 h-4 animate-spin text-primary" />
        <span>{loading}</span>
      </div>
    ),
    success: (data) => (
      <div className="flex items-center gap-3">
        <CheckCircle className="w-4 h-4 text-success" />
        <span>{typeof success === "function" ? success(data) : success}</span>
      </div>
    ),
    error: (err) => (
      <div className="flex items-center gap-3">
        <XCircle className="w-4 h-4 text-danger" />
        <span>{typeof error === "function" ? error(err) : error}</span>
      </div>
    ),
  })
}

// Enhanced Toaster component with better styling
const EnhancedToaster = ({ ...props }) => {
  return (
    <Toaster
      position="bottom-right"
      expand={true}
      richColors={true}
      closeButton={true}
      toastOptions={{
        className: "shadow-[var(--shadow-elegant)]",
        style: {
          border: "1px solid hsl(var(--border))",
          backgroundColor: "hsl(var(--background))",
        },
        duration: 4000,
      }}
      {...props}
    />
  )
}

export { enhancedToast, EnhancedToaster, enhancedToastVariants }