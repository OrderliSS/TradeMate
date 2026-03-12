import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

const formFieldVariants = cva(
  "space-y-2 transition-all duration-200",
  {
    variants: {
      variant: {
        default: "",
        floating: "relative",
        focused: "ring-2 ring-primary/20 rounded-lg p-3 bg-background/50",
      },
      state: {
        default: "",
        error: "border-destructive text-destructive",
        success: "border-success text-success",
        warning: "border-warning text-warning",
      }
    },
    defaultVariants: {
      variant: "default",
      state: "default",
    },
  }
)

const floatingLabelVariants = cva(
  "absolute left-3 transition-all duration-200 pointer-events-none",
  {
    variants: {
      state: {
        default: "top-1/2 -translate-y-1/2 text-muted-foreground",
        focused: "top-0 -translate-y-1/2 text-xs text-primary bg-background px-1",
        filled: "top-0 -translate-y-1/2 text-xs text-muted-foreground bg-background px-1",
      }
    },
    defaultVariants: {
      state: "default",
    },
  }
)

export interface EnhancedFormFieldProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof formFieldVariants> {
  label?: string
  error?: string
  success?: string
  warning?: string
  required?: boolean
}

export interface FloatingInputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: string
}

const EnhancedFormField = React.forwardRef<HTMLDivElement, EnhancedFormFieldProps>(
  ({ className, variant, state, label, error, success, warning, required, children, ...props }, ref) => {
    const fieldState = error ? 'error' : success ? 'success' : warning ? 'warning' : state

    return (
      <div
        ref={ref}
        className={cn(formFieldVariants({ variant, state: fieldState, className }))}
        {...props}
      >
        {label && variant !== "floating" && (
          <Label className="text-sm font-medium">
            {label}
            {required && <span className="text-destructive ml-1">*</span>}
          </Label>
        )}
        {children}
        {error && (
          <p className="text-sm text-destructive flex items-center gap-1 animate-fade-in">
            <span className="inline-block w-1 h-1 bg-destructive rounded-full" />
            {error}
          </p>
        )}
        {success && (
          <p className="text-sm text-success flex items-center gap-1 animate-fade-in">
            <span className="inline-block w-1 h-1 bg-success rounded-full" />
            {success}
          </p>
        )}
        {warning && (
          <p className="text-sm text-warning flex items-center gap-1 animate-fade-in">
            <span className="inline-block w-1 h-1 bg-warning rounded-full" />
            {warning}
          </p>
        )}
      </div>
    )
  }
)
EnhancedFormField.displayName = "EnhancedFormField"

const FloatingInput = React.forwardRef<HTMLInputElement, FloatingInputProps>(
  ({ className, label, error, ...props }, ref) => {
    const [focused, setFocused] = React.useState(false)
    const [filled, setFilled] = React.useState(false)

    const handleFocus = () => setFocused(true)
    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      setFocused(false)
      setFilled(!!e.target.value)
      props.onBlur?.(e)
    }

    React.useEffect(() => {
      setFilled(!!props.value || !!props.defaultValue)
    }, [props.value, props.defaultValue])

    const labelState = focused ? 'focused' : filled ? 'filled' : 'default'

    return (
      <div className="relative">
        <Input
          ref={ref}
          className={cn(
            "peer placeholder-transparent focus:border-primary transition-all duration-200",
            error && "border-destructive focus:border-destructive",
            className
          )}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder=" "
          {...props}
        />
        <Label className={cn(floatingLabelVariants({ state: labelState }))}>
          {label}
        </Label>
        {error && (
          <p className="text-sm text-destructive mt-1 animate-fade-in">
            {error}
          </p>
        )}
      </div>
    )
  }
)
FloatingInput.displayName = "FloatingInput"

export {
  EnhancedFormField,
  FloatingInput,
  formFieldVariants,
  floatingLabelVariants,
}