import * as React from "react"
import * as PopoverPrimitive from "@radix-ui/react-popover"

import { cn } from "@/lib/utils"

const Popover = PopoverPrimitive.Root

const PopoverTrigger = PopoverPrimitive.Trigger

const PopoverContent = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(({ className, align = "center", sideOffset = 4, onInteractOutside, onOpenAutoFocus, onPointerDownOutside, ...props }, ref) => (
  <PopoverPrimitive.Portal>
    <PopoverPrimitive.Content
      ref={ref}
      align={align}
      sideOffset={sideOffset}
      onInteractOutside={(e) => {
        e.preventDefault();
        onInteractOutside?.(e);
      }}
      onOpenAutoFocus={(e) => {
        e.preventDefault();
        onOpenAutoFocus?.(e);
      }}
      onPointerDownOutside={(e) => {
        const target = e.target as HTMLElement;
        const isInsidePopover = target.closest('[data-radix-popper-content-wrapper]');
        if (isInsidePopover) {
          e.preventDefault();
        }
        onPointerDownOutside?.(e);
      }}
      className={cn(
        "z-[9999] w-72 rounded-md border bg-popover p-4 text-popover-foreground shadow-md outline-none pointer-events-auto data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[state=closed]:pointer-events-none",
        className
      )}
      {...props}
    />
  </PopoverPrimitive.Portal>
))
PopoverContent.displayName = PopoverPrimitive.Content.displayName

export { Popover, PopoverTrigger, PopoverContent }
