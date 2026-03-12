import * as React from "react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useVisualViewport } from "@/hooks/useVisualViewport";

interface ResponsiveDialogProps {
  children: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

interface ResponsiveDialogContentProps {
  children: React.ReactNode;
  className?: string;
}

interface ResponsiveDialogHeaderProps {
  children: React.ReactNode;
  className?: string;
}

interface ResponsiveDialogFooterProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

interface ResponsiveDialogTitleProps {
  children: React.ReactNode;
  className?: string;
}

interface ResponsiveDialogDescriptionProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * ResponsiveDialog - Centered modal dialog on all devices
 * Provides consistent centered modal experience across mobile and desktop
 */
export function ResponsiveDialog({
  children,
  open,
  onOpenChange,
}: ResponsiveDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange} modal={true}>
      {children}
    </Dialog>
  );
}

export function ResponsiveDialogTrigger({
  children,
  asChild,
}: {
  children: React.ReactNode;
  asChild?: boolean;
}) {
  return <DialogTrigger asChild={asChild}>{children}</DialogTrigger>;
}

export function ResponsiveDialogContent({
  children,
  className,
}: ResponsiveDialogContentProps) {
  // Initialize visual viewport tracking for keyboard awareness
  useVisualViewport();
  
  return (
    <DialogContent
      className={cn(
        "w-[min(92vw,420px)] rounded-xl",
        // Desktop: standard max-height
        "sm:max-h-[85vh]",
        // Mobile: keyboard-aware max-height using CSS variable
        "max-sm:max-h-[calc(var(--visual-viewport-height,85vh)-2rem)]",
        "overflow-y-auto",
        className
      )}
    >
      {children}
    </DialogContent>
  );
}

export function ResponsiveDialogHeader({
  children,
  className,
}: ResponsiveDialogHeaderProps) {
  return <DialogHeader className={className}>{children}</DialogHeader>;
}

export function ResponsiveDialogFooter({
  children,
  className,
  style,
}: ResponsiveDialogFooterProps) {
  return (
    <DialogFooter className={className} style={style}>
      {children}
    </DialogFooter>
  );
}

export function ResponsiveDialogTitle({
  children,
  className,
}: ResponsiveDialogTitleProps) {
  return <DialogTitle className={className}>{children}</DialogTitle>;
}

export function ResponsiveDialogDescription({
  children,
  className,
}: ResponsiveDialogDescriptionProps) {
  return (
    <DialogDescription className={className}>{children}</DialogDescription>
  );
}

export function ResponsiveDialogClose({
  children,
  asChild,
}: {
  children: React.ReactNode;
  asChild?: boolean;
}) {
  return <DialogClose asChild={asChild}>{children}</DialogClose>;
}
